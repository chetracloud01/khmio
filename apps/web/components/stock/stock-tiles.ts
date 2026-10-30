import type { Currency } from "@khmio/shared";
import type { StockPage } from "@/lib/api";
import { listAddress } from "../../lib/list-address";
import { stockLevelOf, stockValueOf, type StockLevel } from "./stock-levels";

// The Stock page's status tiles and reorder bar (design/screens.md S13
// "Stock"): what each tile counts and is worth, which chip it opens, and what
// ordering everything at or below its reorder point would cost. Pure, so the
// sums are tested without a page. Dollars and riel are never added together.

type Item = StockPage["items"][number];

/** The tiles, most urgent first; each opens the list's chip of the same name. */
export const STOCK_TILES = ["out", "low", "ok", "untracked"] as const satisfies readonly StockLevel[];
export type StockTile = (typeof STOCK_TILES)[number];

const isStockTile = (chip: string): chip is StockTile => (STOCK_TILES as readonly string[]).includes(chip);

/** The tile a list chip shows, if it's one. */
export const stockTileOf = (chip: string): StockTile | null => (isStockTile(chip) ? chip : null);

/** The address a tile writes (lib/list-address.ts); none: every item. */
export const stockTileSearch = (current: string, tile: StockTile | null): string => listAddress(current, tile ? { chip: tile } : null);

/** Each tile's items and what they're worth on the shelf (on hand × cost), each currency apart. */
export function stockTileFigures(items: readonly Item[]): Record<StockTile, { count: number; value: Record<Currency, number> }> {
  const empty = () => ({ count: 0, value: { USD: 0, KHR: 0 } });
  const figures: Record<StockTile, { count: number; value: Record<Currency, number> }> = { out: empty(), low: empty(), ok: empty(), untracked: empty() };
  for (const item of items) {
    const tile = figures[stockLevelOf(item)];
    tile.count += 1;
    const worth = stockValueOf(item);
    if (worth) tile.value[worth.currency] += worth.amount;
  }
  return figures;
}

/** Tracked and at or below its reorder point (sold out included): the reorder bar and an item's Order button. */
export const toReorder = (item: Item): boolean => item.onHand !== null && item.low;

/**
 * Ordering everything to reorder at its suggested quantity (one when it has
 * no levels): how many items, what that costs at their last cost, each
 * currency apart, and how many have no cost to count.
 */
export function reorderFigures(items: readonly Item[]): { items: Item[]; cost: Record<Currency, number>; withoutCost: number } {
  const picked = items.filter(toReorder);
  const cost: Record<Currency, number> = { USD: 0, KHR: 0 };
  let withoutCost = 0;
  for (const item of picked) {
    if (item.costMinor !== null && item.costCurrency) cost[item.costCurrency] += (item.suggested ?? 1) * item.costMinor;
    else withoutCost += 1;
  }
  return { items: picked, cost, withoutCost };
}
