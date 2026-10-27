import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppDb, createSystemDb, type AppDb, type SystemDb } from "./index";

// Go-live step B1's rate-limit counters on the real database: the API's
// user can count a hit through app_rate_limit_hit() and nothing more — it
// can't read, change or empty the counters.

const appUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_OWNER_URL;

describe.skipIf(!appUrl || !ownerUrl)("rate-limit counters", () => {
  let app: AppDb;
  let system: SystemDb;
  const bucket = `test:${randomUUID()}`;
  const hit = async (key: string, windowSeconds = 600) => (await app.$queryRaw<{ hits: number }[]>`SELECT app_rate_limit_hit(${key}, ${windowSeconds}::int) AS hits`)[0]?.hits;

  beforeAll(() => {
    app = createAppDb(appUrl!);
    system = createSystemDb(ownerUrl!);
  });

  afterAll(async () => {
    await system.rateLimitHit.deleteMany({ where: { bucket: { startsWith: "test:" } } });
    await Promise.all([app.$disconnect(), system.$disconnect()]);
  });

  it("counts each hit in the same window", async () => {
    expect(await hit(bucket)).toBe(1);
    expect(await hit(bucket)).toBe(2);
    expect(await hit(bucket)).toBe(3);
    expect(await hit(`test:${randomUUID()}`)).toBe(1);
  });

  it("keeps the counters away from the app user", async () => {
    await expect(app.rateLimitHit.findMany()).rejects.toThrow();
    await expect(app.rateLimitHit.deleteMany()).rejects.toThrow();
    await expect(app.$executeRaw`UPDATE rate_limit_hits SET hits = 0`).rejects.toThrow();
  });

  it("refuses an over-long key", async () => {
    await expect(hit("x".repeat(101))).rejects.toThrow();
  });
});
