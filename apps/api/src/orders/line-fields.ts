import { merchantActor, writeAudit, type Tx } from "@khmio/db";
import type { CustomValue } from "@khmio/shared";
import { NotFoundException } from "@nestjs/common";
import { checkCustomValues, readCustomFields } from "../custom-fields/custom-fields";
import type { MerchantStore } from "../merchant/store.guard";

/**
 * The shop's own fields for one item of one of its orders (target
 * "orderLine"), checked against the shop's definitions and audited: the IMEI
 * of the phone handed over is what a warranty claim is checked against.
 */
export async function saveLineFields(tx: Tx, context: MerchantStore, at: { orderId: string; itemId: string }, values: Record<string, CustomValue>): Promise<void> {
  const customValues = checkCustomValues(await readCustomFields(tx, "orderLine"), values);
  // Order lines are otherwise unchangeable: only this database function may write their own fields.
  const [row] = await tx.$queryRaw<{ saved: boolean }[]>`SELECT app_set_order_line_values(${at.itemId}::uuid, ${at.orderId}::uuid, ${JSON.stringify(customValues)}::jsonb) AS saved`;
  if (!row?.saved) throw new NotFoundException();
  await writeAudit(tx, merchantActor(context), { action: "order.line_fields_saved", entity: "order", entityId: at.orderId });
}
