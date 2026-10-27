import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppDb, createSystemDb, type AppDb, type SystemDb } from "./index";

// Backup runs (admin A13) are platform data that only SystemDb touches: the
// API's everyday user can't read, start or remove them.

const appUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_OWNER_URL;

describe.skipIf(!appUrl || !ownerUrl)("backup runs", () => {
  let app: AppDb;
  let system: SystemDb;

  beforeAll(() => {
    app = createAppDb(appUrl!);
    system = createSystemDb(ownerUrl!);
  });

  afterAll(async () => {
    await Promise.all([app.$disconnect(), system.$disconnect()]);
  });

  it("keeps the backup runs away from the app user", async () => {
    await expect(app.backupRun.findMany()).rejects.toThrow();
    await expect(app.backupRun.create({ data: { kind: "nightly", status: "running" } })).rejects.toThrow();
    await expect(app.backupRun.deleteMany()).rejects.toThrow();
    await expect(system.backupRun.count()).resolves.toBeGreaterThanOrEqual(0);
  });
});
