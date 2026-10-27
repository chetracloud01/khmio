import { merchantActor, writeAudit, type Tx } from "@khmio/db";
import { hasModule, type BusinessModule, type StoreModulesInput } from "@khmio/shared";
import { AppException } from "../errors";
import type { MerchantStore } from "../merchant/store.guard";

// A shop's modules (packages/shared business-modules.ts): which of the
// business-specific parts it uses. Read inside withContext (the seller) or
// withPublicStore (the shop page): row-level security shows only that shop.

export async function readStoreModules(tx: Tx, storeId: string): Promise<BusinessModule[]> {
  return (await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { modules: true } })).modules;
}

/** Refuses a write that needs a module the shop switched off (403 module_off), whatever the screen showed. */
export async function assertModule(tx: Tx, storeId: string, module: BusinessModule): Promise<void> {
  if (!hasModule(await readStoreModules(tx, storeId), module)) throw new AppException(403, "module_off");
}

/** Switching modules on or off never deletes what they hold: switched back on, it's all there. */
export async function saveStoreModules(tx: Tx, context: MerchantStore, input: StoreModulesInput): Promise<BusinessModule[]> {
  const before = await readStoreModules(tx, context.storeId);
  const { modules } = await tx.store.update({ where: { id: context.storeId }, data: { modules: input.modules }, select: { modules: true } });
  await writeAudit(tx, merchantActor(context), { action: "store.modules_saved", entity: "store", entityId: context.storeId, before: { modules: before }, after: { modules } });
  return modules;
}
