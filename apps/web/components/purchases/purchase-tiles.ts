import type { Currency, ListQuery } from "@khmio/shared";
import type { PayablesReport } from "@/lib/api";
import { listAddress } from "../../lib/list-address";

// The Purchases page's status tiles (design/screens.md S13 "Purchases"): what
// each counts and adds up, over every bill as of today, and which list filter
// it opens. Pure, so the sums are tested without a page.

export const PURCHASE_TILES = ["overdue", "due_soon", "open", "not_received", "paid"] as const;
export type PurchaseTile = (typeof PURCHASE_TILES)[number];

/** The list each tile opens: its filter, or the Not received chip. */
export const TILE_FILTERS: Record<PurchaseTile, { filter?: { key: string; value: string }; chip?: string }> = {
  overdue: { filter: { key: "payment", value: "overdue" } },
  due_soon: { filter: { key: "due", value: "due_soon" } },
  open: { filter: { key: "payment", value: "open" } },
  not_received: { chip: "not_received" },
  paid: { filter: { key: "payment", value: "paid" } },
};

/** The tile a list query shows, if it shows one. */
export function tileOf(query: Pick<ListQuery, "chip" | "filters">): PurchaseTile | null {
  return (
    PURCHASE_TILES.find((tile) => {
      const { filter, chip } = TILE_FILTERS[tile];
      return filter ? query.filters[filter.key] === filter.value : query.chip === chip;
    }) ?? null
  );
}

/** The address a tile writes (lib/list-address.ts); none: every bill. */
export const tileSearch = (current: string, tile: PurchaseTile | null): string => listAddress(current, tile ? TILE_FILTERS[tile] : null);

/** Each tile's bills (both currencies) and amount in one currency: what's owed, or for Paid and Not received what was bought. */
export function tileFigures(report: Pick<PayablesReport, "currencies">, currency: Currency): Record<PurchaseTile, { count: number; amount: number }> {
  const { figures, status } = report.currencies[currency];
  const counts = (pick: (side: PayablesReport["currencies"][Currency]) => number) => pick(report.currencies.USD) + pick(report.currencies.KHR);
  const both = <S extends keyof PayablesReport["currencies"][Currency]["status"]>(state: S, field: "count" | "owed" | "bought", side = report.currencies[currency]) => side.status[state].received[field] + side.status[state].not_received[field];
  return {
    overdue: { count: counts((side) => both("overdue", "count", side)), amount: figures.overdue },
    due_soon: { count: counts((side) => side.figures.dueSoonCount), amount: figures.dueSoon },
    open: { count: counts((side) => both("unpaid", "count", side) + both("part", "count", side)), amount: both("unpaid", "owed") + both("part", "owed") },
    not_received: { count: counts((side) => side.figures.notReceived.count), amount: figures.notReceived.bought },
    paid: { count: counts((side) => both("paid", "count", side)), amount: status.paid.received.bought + status.paid.not_received.bought },
  };
}
