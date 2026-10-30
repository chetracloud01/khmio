import type { Tx } from "@khmio/db";
import type { PlanId } from "@khmio/shared";
import { mainLocationId, readLastBought, RECENT_MOVEMENTS, stockMovementSelect, stockVariantSelect, toStockPage } from "./stock";

// One item's stock page (design/screens.md S13 "Item"): the same item row as
// the Stock list, what's held for unpaid orders, its own history, and the
// supplier bills that brought it in, newest first.

/** Most bill lines an item's page lists. */
export const ITEM_BILLS = 50;

/** One live item of the shop (a service has nothing to count), or null: another shop's item isn't found under row-level security. */
export async function readStockItem(tx: Tx, storeId: string, variantId: string, plan: PlanId) {
  const variant = await tx.productVariant.findFirst({ where: { id: variantId, deletedAt: null, product: { deletedAt: null, kind: "item" } }, select: stockVariantSelect });
  if (!variant) return null;
  const locationId = await mainLocationId(tx, storeId);
  const [levels, movements, lastBought, bills] = await Promise.all([
    tx.stockLevel.findMany({ where: { locationId, variantId }, select: { variantId: true, onHand: true, reserved: true, reorderMin: true, reorderMax: true } }),
    tx.stockMovement.findMany({ where: { locationId, variantId }, select: stockMovementSelect, orderBy: { createdAt: "desc" }, take: RECENT_MOVEMENTS }),
    readLastBought(tx, storeId),
    tx.purchaseLine.findMany({
      where: { variantId, purchase: { kind: "purchase" } },
      select: { quantity: true, unitCostMinor: true, lineTotalMinor: true, itemCostMinor: true, itemCostCurrency: true, purchase: { select: { id: true, number: true, purchasedOn: true, currency: true, exchangeRateUsed: true, supplier: { select: { name: true } } } } },
      orderBy: [{ purchase: { purchasedOn: "desc" } }, { purchase: { number: "desc" } }],
      take: ITEM_BILLS,
    }),
  ]);
  const page = toStockPage(
    [variant],
    levels,
    movements,
    plan,
    lastBought.filter((entry) => entry.variantId === variantId),
  );
  const [item] = page.items;
  if (!item) return null;
  return {
    tracksStock: page.tracksStock,
    item,
    /** Held for orders waiting to be paid by KHQR: on the shelf, but not free to sell. */
    held: levels[0]?.reserved ?? 0,
    movements: page.movements,
    bills: bills.map(({ purchase, ...line }) => ({
      ...line,
      purchaseId: purchase.id,
      number: purchase.number,
      purchasedOn: purchase.purchasedOn.toISOString().slice(0, 10),
      currency: purchase.currency,
      exchangeRateUsed: purchase.exchangeRateUsed,
      supplierName: purchase.supplier?.name ?? "",
    })),
  };
}
