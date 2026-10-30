import type { Tx } from "@khmio/db";
import type { Currency } from "@khmio/shared";
import { AppException } from "../errors";
import { applyPurchaseCost, mainLocationId } from "../stock/stock";
import type { Context } from "./purchases";

// Receiving a bill's goods (docs/blueprint.md "Cost price", suppliers and
// bills): stock goes up for every line, each item's average cost moves (at
// that moment, from what's on hand then), an item not tracked yet starts
// tracking, and each line's movement names the bill — all in the caller's
// transaction. A bill is received once: saved as received, or later with
// "Received" (receivePurchase); never undone.

export interface ReceivedLine {
  variantId: string;
  quantity: number;
  /** The cost of one in the item's own currency (the bill line's item cost). */
  itemCostMinor: number;
  itemCostCurrency: Currency;
}

/** Adds a bill's lines to stock at the main branch (see above). Each line's errors are named by its place on the bill. */
export async function addBillToStock(tx: Tx, context: Context, bill: { id: string; note: string; supplierName: string; lines: ReceivedLine[] }): Promise<void> {
  const { storeId } = context;
  const locationId = await mainLocationId(tx, storeId);
  for (const [index, line] of bill.lines.entries()) {
    // Before the count goes up: the average weighs what was on hand before.
    await applyPurchaseCost(tx, line.variantId, locationId, line.quantity, line.itemCostMinor, line.itemCostCurrency, `lines.${index}.unitCost`);
    const { count } = await tx.stockLevel.updateMany({ where: { variantId: line.variantId, locationId }, data: { onHand: { increment: line.quantity } } });
    if (count === 0) await tx.stockLevel.create({ data: { storeId, variantId: line.variantId, locationId, onHand: line.quantity } });
    await tx.stockMovement.create({
      data: {
        storeId,
        variantId: line.variantId,
        locationId,
        type: "purchase",
        quantity: line.quantity,
        // What went into the average: in the item's own currency.
        unitCostMinor: line.itemCostMinor,
        costCurrency: line.itemCostCurrency,
        supplier: bill.supplierName,
        purchaseId: bill.id,
        note: bill.note,
        actorMerchantId: context.merchantId,
      },
    });
  }
}

/**
 * "Received": the goods of a bill saved before they arrived are here — its
 * lines go into stock now. Marked received first, in one statement that only
 * a bill not received yet passes, so two people pressing it at once add the
 * stock once. A bill already received, a return, or another shop's bill is
 * refused. Returns the bill's id.
 */
export async function receivePurchase(tx: Tx, context: Context, purchaseId: string): Promise<string> {
  const { count } = await tx.purchase.updateMany({
    where: { id: purchaseId, storeId: context.storeId, kind: "purchase", receivedAt: null },
    data: { receivedAt: new Date(), receivedById: context.merchantId },
  });
  if (count === 0) throw new AppException(409, "action_not_allowed");
  const bill = await tx.purchase.findFirstOrThrow({
    where: { id: purchaseId },
    select: { id: true, note: true, currency: true, supplier: { select: { name: true } }, lines: { select: { variantId: true, quantity: true, unitCostMinor: true, itemCostMinor: true, itemCostCurrency: true }, orderBy: { id: "asc" } } },
  });
  await addBillToStock(tx, context, {
    id: bill.id,
    note: bill.note,
    supplierName: bill.supplier?.name ?? "",
    // Lines from before item costs were kept are in the bill's own currency.
    lines: bill.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, itemCostMinor: line.itemCostMinor ?? line.unitCostMinor, itemCostCurrency: line.itemCostCurrency ?? bill.currency })),
  });
  return bill.id;
}
