import type { SystemDb } from "@khmio/db";
import type { FileStorage } from "../files/storage";

// Deleting a whole shop, for the development scripts only (pnpm demo:garage
// --reset/--remove, pnpm data:garage-only): never from the app, where data is
// locked, never deleted (docs/blueprint.md "Subscription tiers").

/**
 * Deletes the shop and everything it owns — all or nothing — then, when a
 * storage is given, its whole photo folder, and says how many files went.
 * In this order: job cards first (a handed-over card must keep the sale that
 * billed it, so deleting that sale under it is refused), then orders (an
 * order's customer can't be deleted under it, RESTRICT), then the shop,
 * whose cascade takes the rest.
 */
export async function removeStore(db: SystemDb, storeId: string, storage: FileStorage | null): Promise<number> {
  await db.$transaction(async (tx) => {
    await tx.jobCard.deleteMany({ where: { storeId } });
    await tx.order.deleteMany({ where: { storeId } });
    await tx.outboxEvent.deleteMany({ where: { storeId } });
    await tx.store.delete({ where: { id: storeId } });
  });
  // After the database: a file left behind by a failed delete is harmless; a photo deleted under a live shop isn't.
  return storage ? storage.removeStoreFiles(storeId) : 0;
}
