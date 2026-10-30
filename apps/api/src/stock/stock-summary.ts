import type { Tx } from "@khmio/db";
import { needsReorder, phnomPenhDay } from "@khmio/shared";
import { readBillBalances } from "../purchases/bill-balances";
import { mainLocationId } from "./stock";

// What needs attention in each part of the Stock area (design/screens.md S13,
// the tab row's badges): items to reorder, bills not fully paid (and how many
// of them are overdue), and suppliers in use. Numbers only.

export async function readStockSummary(tx: Tx, storeId: string, now = new Date()) {
  const locationId = await mainLocationId(tx, storeId);
  const [levels, balances, suppliers] = await Promise.all([
    // Live items only: a deleted product or a service has nothing to reorder.
    tx.stockLevel.findMany({ where: { locationId, variant: { deletedAt: null, product: { deletedAt: null, kind: "item" } } }, select: { onHand: true, reserved: true, reorderMin: true } }),
    readBillBalances(tx, storeId, phnomPenhDay(now)),
    tx.supplier.count({ where: { storeId, archivedAt: null } }),
  ]);
  return {
    toReorder: levels.filter((level) => needsReorder(level.onHand - level.reserved, level.reorderMin)).length,
    unpaidBills: balances.filter((balance) => balance.state !== "paid").length,
    overdueBills: balances.filter((balance) => balance.state === "overdue").length,
    suppliers,
  };
}
