import { Prisma, queueAdminAlert, type SystemDb } from "@khmio/db";
import type { AdminAlert, BackupFailure, WorkerEnv } from "@khmio/shared";
import type PgBoss from "pg-boss";
import type { Logger } from "pino";
import { pgDumpCommand, pruneBackups, runBackup, s3Client, type BackupResult } from "../backup/backup";

export const BACKUP_QUEUE = "backup";
/** How often a "Backup now" from the admin is looked for. */
export const MANUAL_BACKUP_EVERY_MS = 5_000;

/** The S3 client and bucket for backups (the schema has checked they're set when BACKUPS=on). */
export function backupTarget(env: WorkerEnv) {
  const { S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BACKUP_BUCKET } = env;
  if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BACKUP_BUCKET) throw new Error("backup settings missing");
  return { client: s3Client({ endpoint: S3_ENDPOINT, region: env.S3_REGION, accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY }), bucket: S3_BACKUP_BUCKET };
}

/** The two things a backup does, apart so the tests can stand in for pg_dump and the bucket. */
export interface BackupSteps {
  make(): Promise<BackupResult>;
  /** Removes old backup files; returns the keys removed. */
  prune(): Promise<string[]>;
}

export function realBackupSteps(env: WorkerEnv): BackupSteps {
  const { client, bucket } = backupTarget(env);
  return {
    make: () => runBackup(client, bucket, pgDumpCommand(env.PG_DUMP_PATH, env.DATABASE_OWNER_URL)),
    prune: () => pruneBackups(client, bucket, env.BACKUP_KEEP_DAYS),
  };
}

/** runBackup's own errors start with "pg_dump"; anything else came from the bucket. */
function failureOf(error: unknown): BackupFailure {
  return error instanceof Error && error.message.startsWith("pg_dump") ? "dump_failed" : "storage_unreachable";
}

/**
 * Makes the backup for a run already marked running, and records how it
 * ended (admin A13). A failure goes to the admins' Telegram; the next run
 * tries again.
 */
export async function recordBackup(db: SystemDb, logger: Logger, runId: string, steps: BackupSteps): Promise<void> {
  let result: BackupResult;
  try {
    result = await steps.make();
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 200) : "unknown error";
    logger.error({ detail }, "database backup failed");
    await db.backupRun.update({ where: { id: runId }, data: { status: "failed", failure: failureOf(error), finishedAt: new Date() } });
    const alert: AdminAlert = { reason: "backup_failed", detail };
    await queueAdminAlert(db, alert).catch(() => undefined);
    return;
  }
  await db.backupRun.update({
    where: { id: runId },
    data: { status: "done", objectKey: result.key, sizeBytes: BigInt(result.bytes), finishedAt: new Date() },
  });
  // Clean-up trouble never makes a good backup count as failed: the next run prunes again.
  try {
    const removed = await steps.prune();
    if (removed.length) await db.backupRun.updateMany({ where: { objectKey: { in: removed }, fileDeletedAt: null }, data: { fileDeletedAt: new Date() } });
    logger.info({ key: result.key, bytes: result.bytes, removed: removed.length }, "database backup done");
  } catch (error) {
    logger.warn({ detail: error instanceof Error ? error.message.slice(0, 200) : "unknown error" }, "old backups not removed");
  }
}

/** The nightly run. Skipped, not failed, when a manual backup is already going (one at a time, by the database). */
export async function nightlyBackup(db: SystemDb, logger: Logger, steps: BackupSteps): Promise<"done" | "skipped"> {
  let runId: string;
  try {
    runId = (await db.backupRun.create({ data: { kind: "nightly", status: "running", startedAt: new Date() }, select: { id: true } })).id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      logger.info("nightly backup skipped: another backup is running");
      return "skipped";
    }
    throw error;
  }
  await recordBackup(db, logger, runId, steps);
  return "done";
}

/** Runs a waiting "Backup now", if there is one. Returns whether it did. */
export async function manualBackupOnce(db: SystemDb, logger: Logger, steps: BackupSteps): Promise<boolean> {
  const waiting = await db.backupRun.findFirst({ where: { status: "queued" }, select: { id: true } });
  if (!waiting) return false;
  // Claimed only if still waiting, so a second worker could never run it twice.
  const claimed = await db.backupRun.updateMany({ where: { id: waiting.id, status: "queued" }, data: { status: "running", startedAt: new Date() } });
  if (claimed.count === 0) return false;
  await recordBackup(db, logger, waiting.id, steps);
  return true;
}

/** At start-up: a run left "running" was cut off by a stop or crash (the worker never overlaps itself). */
export async function markInterrupted(db: SystemDb): Promise<number> {
  const { count } = await db.backupRun.updateMany({ where: { status: "running" }, data: { status: "failed", failure: "interrupted", finishedAt: new Date() } });
  return count;
}

/** Every night at 03:00 Phnom Penh time, when shops are quiet. */
export async function registerBackup(boss: PgBoss, env: WorkerEnv, db: SystemDb, logger: Logger): Promise<BackupSteps> {
  const steps = realBackupSteps(env);
  const interrupted = await markInterrupted(db);
  if (interrupted) logger.warn({ interrupted }, "backups cut off by the last stop marked failed");
  await boss.createQueue(BACKUP_QUEUE);
  await boss.schedule(BACKUP_QUEUE, "0 3 * * *", {}, { tz: "Asia/Phnom_Penh" });
  await boss.work(BACKUP_QUEUE, async () => {
    await nightlyBackup(db, logger, steps);
  });
  return steps;
}
