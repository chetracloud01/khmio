import { createSystemDb, type SystemDb } from "@khmio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { beat } from "./heartbeat";

// The heartbeat on the real database: each beat moves worker_seen_at to now,
// which the admin overview reads to show whether the worker is running.

const ownerUrl = process.env.DATABASE_OWNER_URL;

describe.skipIf(!ownerUrl)("worker heartbeat", () => {
  let db: SystemDb;
  beforeAll(() => {
    db = createSystemDb(ownerUrl!);
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it("records when the worker was last alive", async () => {
    const before = Date.now();
    await beat(db);
    const { workerSeenAt } = await db.platformSettings.findUniqueOrThrow({ where: { id: 1 }, select: { workerSeenAt: true } });
    expect(workerSeenAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});
