import { createSystemDb, type SystemDb } from "@khmio/db";
import pino from "pino";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { manualBackupOnce, markInterrupted, nightlyBackup, type BackupSteps } from "./backup";

// Backup runs recorded on the real database (admin A13), with stand-ins for
// pg_dump and the bucket: nightly and manual runs, failures with their
// reason and an admin alert, one at a time, and files removed after the
// days kept.

const ownerUrl = process.env.DATABASE_OWNER_URL;
const logger = pino({ level: "silent" });
const testStart = new Date();

const works = (key: string, removed: string[] = []): BackupSteps => ({
  make: async () => ({ key, bytes: 1234 }),
  prune: async () => removed,
});

describe.skipIf(!ownerUrl)("backup runs", () => {
  let db: SystemDb;
  let adminId: string;
  const made: string[] = [];

  beforeAll(async () => {
    db = createSystemDb(ownerUrl!);
    adminId = (await db.adminUser.create({ data: { name: "Backup test", telegramId: `bt${Date.now()}`, role: "support" } })).id;
  });

  afterEach(async () => {
    const rows = await db.backupRun.findMany({ where: { createdAt: { gte: testStart } }, select: { id: true } });
    made.push(...rows.map((row) => row.id));
    await db.backupRun.deleteMany({ where: { id: { in: made } } });
  });

  afterAll(async () => {
    await db.outboxEvent.deleteMany({ where: { kind: "admin_alert", createdAt: { gte: testStart }, payload: { path: ["detail"], string_contains: "test: no connection" } } });
    await db.adminUser.delete({ where: { id: adminId } });
    await db.$disconnect();
  });

  it("records a nightly backup with its file and size", async () => {
    expect(await nightlyBackup(db, logger, works("daily/test-nightly.dump"))).toBe("done");
    const run = await db.backupRun.findFirstOrThrow({ where: { objectKey: "daily/test-nightly.dump" } });
    expect(run).toMatchObject({ kind: "nightly", status: "done", sizeBytes: 1234n, failure: null, startedById: null });
    expect(run.finishedAt).not.toBeNull();
  });

  it("records a failure with its reason, and tells the admins", async () => {
    const failing: BackupSteps = { make: async () => Promise.reject(new Error("pg_dump failed (exit 1): test: no connection")), prune: async () => [] };
    await nightlyBackup(db, logger, failing);
    const run = await db.backupRun.findFirstOrThrow({ where: { createdAt: { gte: testStart }, status: "failed" } });
    expect(run.failure).toBe("dump_failed");
    const alerts = await db.outboxEvent.count({ where: { kind: "admin_alert", createdAt: { gte: testStart }, payload: { path: ["reason"], equals: "backup_failed" } } });
    expect(alerts).toBeGreaterThanOrEqual(1);
  });

  it("runs a waiting Backup now, once", async () => {
    const queued = await db.backupRun.create({ data: { kind: "manual", status: "queued", startedById: adminId } });
    expect(await manualBackupOnce(db, logger, works("daily/test-manual.dump"))).toBe(true);
    expect(await db.backupRun.findUniqueOrThrow({ where: { id: queued.id } })).toMatchObject({ status: "done", objectKey: "daily/test-manual.dump" });
    expect(await manualBackupOnce(db, logger, works("daily/test-again.dump"))).toBe(false);
  });

  it("allows one backup at a time: the nightly run waits its turn", async () => {
    await db.backupRun.create({ data: { kind: "manual", status: "queued", startedById: adminId } });
    await expect(db.backupRun.create({ data: { kind: "manual", status: "queued", startedById: adminId } })).rejects.toThrow();
    expect(await nightlyBackup(db, logger, works("daily/test-skipped.dump"))).toBe("skipped");
  });

  it("marks files removed after the days kept, and keeps the row", async () => {
    await nightlyBackup(db, logger, works("daily/test-old.dump"));
    await nightlyBackup(db, logger, works("daily/test-new.dump", ["daily/test-old.dump"]));
    const old = await db.backupRun.findFirstOrThrow({ where: { objectKey: "daily/test-old.dump" } });
    expect(old.fileDeletedAt).not.toBeNull();
  });

  it("marks a run cut off by a stop as interrupted", async () => {
    const running = await db.backupRun.create({ data: { kind: "nightly", status: "running", startedAt: new Date() } });
    expect(await markInterrupted(db)).toBeGreaterThanOrEqual(1);
    expect(await db.backupRun.findUniqueOrThrow({ where: { id: running.id } })).toMatchObject({ status: "failed", failure: "interrupted" });
  });

  it("refuses rows that don't say how they ended", async () => {
    await expect(db.backupRun.create({ data: { kind: "nightly", status: "done" } })).rejects.toThrow();
    await expect(db.backupRun.create({ data: { kind: "nightly", status: "failed" } })).rejects.toThrow();
    await expect(db.backupRun.create({ data: { kind: "manual", status: "queued" } })).rejects.toThrow();
    await expect(db.backupRun.create({ data: { kind: "weekly", status: "queued" } })).rejects.toThrow();
  });
});
