import { randomUUID } from "node:crypto";
import { createSystemDb, type SystemDb } from "@khmio/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanUpOnce } from "./cleanup";

// The hourly cleanup on the real database: rate-limit counters older than
// two days go; recent ones stay (they may still be counting).

const ownerUrl = process.env.DATABASE_OWNER_URL;

describe.skipIf(!ownerUrl)("cleanup", () => {
  let db: SystemDb;
  const run = randomUUID();

  beforeAll(() => {
    db = createSystemDb(ownerUrl!);
  });

  afterAll(async () => {
    await db.rateLimitHit.deleteMany({ where: { bucket: { startsWith: `test:${run}` } } });
    await db.$disconnect();
  });

  it("removes old rate-limit counters and keeps recent ones", async () => {
    const hour = 3_600_000;
    await db.rateLimitHit.createMany({
      data: [
        { bucket: `test:${run}:old`, windowStart: new Date(Date.now() - 49 * hour) },
        { bucket: `test:${run}:recent`, windowStart: new Date(Date.now() - 2 * hour) },
      ],
    });
    expect(await cleanUpOnce(db)).toBeGreaterThanOrEqual(1);
    const left = await db.rateLimitHit.findMany({ where: { bucket: { startsWith: `test:${run}` } }, select: { bucket: true } });
    expect(left.map((row) => row.bucket)).toEqual([`test:${run}:recent`]);
  });
});
