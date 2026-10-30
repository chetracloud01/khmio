import type { Currency } from "./money";
import { reportRange, reportSeries, seriesKeyOf, type ReportPeriod, type ReportQuery, type SeriesUnit } from "./report-period";

// The stock report (design/screens.md S17 "Stock"; the ERP stock movement
// summary): for a period, each item's opening, what went in and out, and its
// closing; what came in and went out day by day (or month by month), in units;
// why stock went down; what the shelf is worth now, by category; the items
// out, low or tracked; and the slow movers — items on the shelf with no sale
// in the period. Money is at each item's cost today (an estimate: the cost a
// unit came in at isn't kept per unit), dollars and riel apart. Pure, so the
// sums are tested without a database.

type Money = Record<Currency, number>;
const zero = (): Money => ({ USD: 0, KHR: 0 });

/** One item as the report reads it (the Stock list's row). */
export interface StockReportItem {
  variantId: string;
  categoryId: string;
  /** null = not tracked. */
  onHand: number | null;
  low: boolean;
  costMinor: number | null;
  costCurrency: Currency | null;
}

/** What a movement was, as the report groups it: bought, sold, or its reason (opening_stock, damaged, returned, …). */
export type StockMoveKind = string;

/** Movements of one item on one Phnom Penh day of one kind, added up (always positive; `direction` says which way). */
export interface StockReportMove {
  variantId: string;
  day: string;
  direction: "in" | "out";
  kind: StockMoveKind;
  quantity: number;
}

/** A movement's way and kind from its type and reason (transfers between branches aren't the shop's in or out). */
export function moveKindOf(type: string, reason: string | null): { direction: "in" | "out"; kind: StockMoveKind } | null {
  if (type === "purchase") return { direction: "in", kind: "bought" };
  if (type === "sale") return { direction: "out", kind: "sold" };
  if (type === "adjust_in") return { direction: "in", kind: reason ?? "other" };
  if (type === "adjust_out") return { direction: "out", kind: reason ?? "other" };
  return null;
}

export interface StockReportRow {
  variantId: string;
  opening: number;
  in: number;
  out: number;
  closing: number;
  /** Closing × cost today; null when untracked or without a cost. */
  value: { amount: number; currency: Currency } | null;
}

export interface StockReport {
  period: ReportPeriod;
  /** The days read; null with "all" (from the first movement to today). */
  days: { from: string; to: string } | null;
  unit: SeriesUnit;
  /** Units in and out per day or month. */
  series: { key: string; in: number; out: number }[];
  figures: {
    /** What the shelf is worth now (on hand × cost). */
    value: Money;
    /** Tracked items without a cost: not in the value. */
    withoutCost: number;
    inUnits: number;
    outUnits: number;
    inValue: Money;
    outValue: Money;
  };
  /** How many items at each level. */
  levels: { out: number; low: number; ok: number; untracked: number };
  /** What the shelf is worth by category, most first (dollars, then riel). */
  byCategory: { categoryId: string; value: Money; units: number }[];
  /** Each kind of change in the period: units and their worth, most units first. */
  kinds: { kind: StockMoveKind; direction: "in" | "out"; units: number; value: Money }[];
  /** On the shelf, with no sale in the period: most worth first. */
  slowMovers: { variantId: string; onHand: number; value: { amount: number; currency: Currency } | null; lastSoldOn: string | null }[];
  rows: StockReportRow[];
}

const worth = (item: StockReportItem, units: number) => (item.costMinor !== null && item.costCurrency ? { amount: units * item.costMinor, currency: item.costCurrency } : null);
const byMoney = (a: Money, b: Money) => b.USD - a.USD || b.KHR - a.KHR;

/**
 * The report for a period. `moves` are every movement from the period's
 * first day on (those after its last day turn today's count back to the
 * closing); `lastSold` is each item's last sale ever.
 */
export function stockReport(items: readonly StockReportItem[], moves: readonly StockReportMove[], lastSold: ReadonlyMap<string, string>, query: ReportQuery, today: string): StockReport {
  const days = reportRange(query, today);
  const first = moves.reduce((oldest, move) => (move.day < oldest ? move.day : oldest), today);
  const from = days?.from ?? first;
  const to = days?.to ?? today;
  const { unit, keys } = reportSeries(from, to);
  const series = keys.map((key) => ({ key, in: 0, out: 0 }));
  const bar = new Map(series.map((point) => [point.key, point]));
  const itemOf = new Map(items.map((item) => [item.variantId, item]));
  const flow = new Map<string, { in: number; out: number; after: number; sold: boolean }>();
  const kinds = new Map<string, { kind: StockMoveKind; direction: "in" | "out"; units: number; value: Money }>();
  const figures = { value: zero(), withoutCost: 0, inUnits: 0, outUnits: 0, inValue: zero(), outValue: zero() };

  for (const move of moves) {
    if (move.day < from) continue;
    const entry = flow.get(move.variantId) ?? { in: 0, out: 0, after: 0, sold: false };
    flow.set(move.variantId, entry);
    const signed = move.direction === "in" ? move.quantity : -move.quantity;
    // After the period: undone from today's count to find the closing.
    if (move.day > to) {
      entry.after += signed;
      continue;
    }
    entry[move.direction] += move.quantity;
    if (move.kind === "sold") entry.sold = true;
    const point = bar.get(seriesKeyOf(move.day, unit));
    if (point) point[move.direction] += move.quantity;
    const kindKey = `${move.direction}:${move.kind}`;
    const kind = kinds.get(kindKey) ?? { kind: move.kind, direction: move.direction, units: 0, value: zero() };
    kind.units += move.quantity;
    const item = itemOf.get(move.variantId);
    const money = item ? worth(item, move.quantity) : null;
    if (money) kind.value[money.currency] += money.amount;
    kinds.set(kindKey, kind);
    figures[move.direction === "in" ? "inUnits" : "outUnits"] += move.quantity;
    if (money) figures[move.direction === "in" ? "inValue" : "outValue"][money.currency] += money.amount;
  }

  const levels = { out: 0, low: 0, ok: 0, untracked: 0 };
  const categories = new Map<string, { categoryId: string; value: Money; units: number }>();
  const slowMovers: StockReport["slowMovers"] = [];
  const rows: StockReportRow[] = [];
  for (const item of items) {
    if (item.onHand === null) {
      levels.untracked += 1;
      continue;
    }
    levels[item.onHand === 0 ? "out" : item.low ? "low" : "ok"] += 1;
    const now = worth(item, item.onHand);
    if (now) figures.value[now.currency] += now.amount;
    else if (item.onHand > 0) figures.withoutCost += 1;
    const category = categories.get(item.categoryId) ?? { categoryId: item.categoryId, value: zero(), units: 0 };
    category.units += item.onHand;
    if (now) category.value[now.currency] += now.amount;
    categories.set(item.categoryId, category);
    const moved = flow.get(item.variantId) ?? { in: 0, out: 0, after: 0, sold: false };
    const closing = item.onHand - moved.after;
    rows.push({ variantId: item.variantId, opening: closing - moved.in + moved.out, in: moved.in, out: moved.out, closing, value: worth(item, closing) });
    if (item.onHand > 0 && !moved.sold) slowMovers.push({ variantId: item.variantId, onHand: item.onHand, value: now, lastSoldOn: lastSold.get(item.variantId) ?? null });
  }

  const valueOf = (money: { amount: number; currency: Currency } | null): Money => (money ? { ...zero(), [money.currency]: money.amount } : zero());
  return {
    period: query.period,
    days,
    unit,
    series,
    figures,
    levels,
    byCategory: [...categories.values()].sort((a, b) => byMoney(a.value, b.value) || b.units - a.units),
    kinds: [...kinds.values()].sort((a, b) => b.units - a.units),
    slowMovers: slowMovers.sort((a, b) => byMoney(valueOf(a.value), valueOf(b.value)) || b.onHand - a.onHand),
    rows,
  };
}
