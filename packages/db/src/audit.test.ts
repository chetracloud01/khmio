import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSystemDb, merchantActor, writeAudit, type SystemDb } from "./index";

// The one way the API, the worker and the tools write the audit log, on the
// real database: who acted, for which shop, and what changed.

const ownerUrl = process.env.DATABASE_OWNER_URL;
/** Every row this test writes points at this made-up record, so cleanup takes only those. */
const entityId = `audit-test-${randomUUID()}`;

describe.skipIf(!ownerUrl)("writeAudit", () => {
  let system: SystemDb;

  beforeAll(() => {
    system = createSystemDb(ownerUrl!);
  });

  afterAll(async () => {
    await system.auditLog.deleteMany({ where: { entityId } });
    await system.$disconnect();
  });

  it("records a merchant's change in their own shop, with before and after", async () => {
    const merchantId = randomUUID();
    const storeId = randomUUID();
    await writeAudit(system, merchantActor({ merchantId, storeId }), { action: "order.confirm", entity: "order", entityId, before: { status: "new" }, after: { status: "confirmed" } });
    const row = await system.auditLog.findFirstOrThrow({ where: { entityId, action: "order.confirm" } });
    expect(row).toMatchObject({ actorType: "merchant", actorId: merchantId, storeId, entity: "order", before: { status: "new" }, after: { status: "confirmed" } });
  });

  it("records a system change with no person behind it", async () => {
    await writeAudit(system, { actorType: "system" }, { action: "admin.owner_added", entity: "admin_user", entityId });
    const row = await system.auditLog.findFirstOrThrow({ where: { entityId, action: "admin.owner_added" } });
    expect(row).toMatchObject({ actorType: "system", actorId: null, storeId: null, before: null, after: null });
  });

  it("writes inside the change's own transaction, so a change that fails leaves no record", async () => {
    await expect(
      system.$transaction(async (tx) => {
        await writeAudit(tx, { actorType: "system" }, { action: "backup.started", entity: "backup_run", entityId });
        throw new Error("the change itself failed");
      }),
    ).rejects.toThrow("the change itself failed");
    expect(await system.auditLog.count({ where: { entityId, action: "backup.started" } })).toBe(0);
  });
});
