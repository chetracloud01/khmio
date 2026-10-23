import { merchantActor, writeAudit, type Tx } from "@khmio/db";
import type { MerchantStore } from "../merchant/store.guard";

// The shop's staff Telegram groups: they get the same order alerts as the
// seller. The worker links a group when its one-time code is used
// (apps/worker telegram-links.ts); the seller sees and removes them here.

export function readStaffGroups(tx: Tx) {
  return tx.storeAlertChat.findMany({ select: { id: true, title: true, createdAt: true }, orderBy: { createdAt: "asc" } });
}

/** Saves the hash of a one-time "add the bot to your group" code. createMany: the API may write codes but never read them back. */
export async function addGroupLinkCode(tx: Tx, context: MerchantStore, codeHash: string, expiresAt: Date): Promise<void> {
  await tx.telegramLinkCode.createMany({ data: [{ kind: "group_link", codeHash, storeId: context.storeId, createdBy: context.merchantId, expiresAt }] });
}

/** Stops alerts to one group; false when the shop has no such group. */
export async function unlinkStaffGroup(tx: Tx, context: MerchantStore, id: string): Promise<boolean> {
  const { count } = await tx.storeAlertChat.deleteMany({ where: { id } });
  if (count === 0) return false;
  await writeAudit(tx, merchantActor(context), { action: "store.telegram_group_unlinked", entity: "store", entityId: context.storeId });
  return true;
}
