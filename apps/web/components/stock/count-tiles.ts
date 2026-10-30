import { addDays, phnomPenhDay, type Currency } from "@khmio/shared";
import type { StockCount, StockPage } from "@/lib/api";
import { listAddress } from "../../lib/list-address";
import type { CountLine } from "./count-draft";

// The Count tab's status tiles (design/screens.md S13 "Count stock"): while a
// count is open, its items by where they stand — not counted yet, lost, found,
// matching; with none open, the shop's past counts — the last one, what was
// lost in 30 days, how many were applied or cancelled. Each tile is also its
// list's chip. Pure, so the sums are tested without a page.

type Item = StockPage["items"][number];
type Money = Record<Currency, number>;

// ── An open count ───────────────────────────────────────────────────────────

export const COUNT_TILES = ["uncounted", "lost", "found", "matches"] as const;
export type CountTile = (typeof COUNT_TILES)[number];

/** Where a counted item stands: less on the shelf, more, or the same (an untracked item starting from its count changes nothing). */
function standingOf(line: CountLine | undefined): CountTile {
  if (!line) return "uncounted";
  if (line.expectedOnHand === null || line.counted === line.expectedOnHand) return "matches";
  return line.counted < line.expectedOnHand ? "lost" : "found";
}

/** Whether an item is in a tile. */
export const inCountTile = (tile: CountTile, line: CountLine | undefined): boolean => standingOf(line) === tile;

/** Each tile's items, and what the lost and found ones are worth at their cost (each currency apart; no cost, not valued). */
export function countTileFigures(inRange: readonly Item[], lines: readonly CountLine[]): Record<CountTile, { count: number; value: Money }> {
  const empty = () => ({ count: 0, value: { USD: 0, KHR: 0 } });
  const figures: Record<CountTile, { count: number; value: Money }> = { uncounted: empty(), lost: empty(), found: empty(), matches: empty() };
  const lineOf = new Map(lines.map((line) => [line.variantId, line]));
  for (const item of inRange) {
    const line = lineOf.get(item.variantId);
    const figure = figures[standingOf(line)];
    figure.count += 1;
    if (line && line.expectedOnHand !== null && line.costMinor !== null && line.costCurrency) figure.value[line.costCurrency] += (line.counted - line.expectedOnHand) * line.costMinor;
  }
  return figures;
}

const isCountTile = (chip: string): chip is CountTile => (COUNT_TILES as readonly string[]).includes(chip);
/** The tile a list chip shows, if it's one. */
export const countTileOf = (chip: string): CountTile | null => (isCountTile(chip) ? chip : null);

// ── Past counts ─────────────────────────────────────────────────────────────

/** "What was lost lately" reads this many days back. */
export const RECENT_COUNT_DAYS = 30;

export const HISTORY_TILES = ["recent", "applied", "cancelled"] as const;
export type HistoryTile = (typeof HISTORY_TILES)[number];

/** Applied within the last RECENT_COUNT_DAYS days (Phnom Penh days, today included). */
const isRecent = (count: StockCount, today: string) => count.status === "applied" && count.appliedAt !== null && phnomPenhDay(count.appliedAt) > addDays(today, -RECENT_COUNT_DAYS);

/** Whether a past count is in a tile. */
export function inHistoryTile(tile: HistoryTile, count: StockCount, today: string): boolean {
  if (tile === "recent") return isRecent(count, today);
  return count.status === tile;
}

/** The last applied count; what the counts applied lately lost (each currency apart); how many were applied and cancelled. */
export function historyFigures(counts: readonly StockCount[], today: string): { last: StockCount | null; recent: { count: number; lost: Money }; applied: number; cancelled: number } {
  const applied = counts.filter((count) => count.status === "applied");
  const last = [...applied].sort((a, b) => (b.appliedAt ?? "").localeCompare(a.appliedAt ?? ""))[0] ?? null;
  const recent = applied.filter((count) => isRecent(count, today));
  return {
    last,
    recent: { count: recent.length, lost: recent.reduce((sum, count) => ({ USD: sum.USD + count.value.lost.USD, KHR: sum.KHR + count.value.lost.KHR }), { USD: 0, KHR: 0 }) },
    applied: applied.length,
    cancelled: counts.filter((count) => count.status === "cancelled").length,
  };
}

const isHistoryTile = (chip: string): chip is HistoryTile => (HISTORY_TILES as readonly string[]).includes(chip);
/** The tile a Past counts chip shows, if it's one. */
export const historyTileOf = (chip: string): HistoryTile | null => (isHistoryTile(chip) ? chip : null);

/** The address a tile writes (lib/list-address.ts): its chip; none, the whole list. */
export const tileChipSearch = (current: string, chip: string | null): string => listAddress(current, chip ? { chip } : null);
