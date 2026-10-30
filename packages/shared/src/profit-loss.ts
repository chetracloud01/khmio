import type { Currency } from "./money";
import { reportRange, reportSeries, seriesKeyOf, type ReportPeriod, type ReportQuery, type SeriesUnit } from "./report-period";

// The profit and loss report (design/screens.md S17 "Profit & loss"; Pro):
// for a period, the shop's statement — sales before discounts, discounts,
// goods sold, delivery fees, net sales; the cost of what was sold (frozen on
// each line when sold); gross profit; stock lost (damaged, expired, lost, own
// use, given away, short in a count, other) less stock found in counts; and
// the profit. Sales without a cost price are taken out of the profit, never
// guessed. VAT collected is kept apart: it isn't the shop's. Orders count
// as sales by the home page's rule (the API reads only those). Dollars and
// riel are never added together here. Pure, so it's tested without a
// database. Running costs (rent, wages) aren't in the app yet: the profit is
// before them.

type Money = Record<Currency, number>;
const zero = (): Money => ({ USD: 0, KHR: 0 });

/** Below this margin a product's profit is "low" (the report's Low margin chip). */
export const LOW_MARGIN_PERCENT = 15;

/** The reasons stock going down is a loss (a supplier return isn't: the supplier pays it back). */
export const LOSS_REASONS = ["damaged", "expired", "lost", "own_use", "given_away", "count_correction", "other"] as const;
export type LossReason = (typeof LOSS_REASONS)[number];
const isLossReason = (reason: string): reason is LossReason => (LOSS_REASONS as readonly string[]).includes(reason);

/** One day's sales in one currency (orders that count as sales). */
export interface ProfitLossOrderDay {
  day: string;
  currency: Currency;
  orders: number;
  /** Before discounts. */
  subtotal: number;
  discount: number;
  deliveryFee: number;
  vat: number;
}

/** One product's lines on one day in one currency. */
export interface ProfitLossItem {
  day: string;
  productId: string;
  nameKm: string;
  nameEn: string;
  currency: Currency;
  quantity: number;
  sales: number;
  /** The part of `sales` whose lines have a cost. */
  costedSales: number;
  cost: number;
}

/** Stock taken off (out) or found (in, a count only) on one day, worth `value` in `currency` (null: no cost price). */
export interface ProfitLossMove {
  day: string;
  direction: "in" | "out";
  reason: string;
  units: number;
  currency: Currency | null;
  value: number;
  /** Units without a cost price, so not valued. */
  unvalued: number;
  /** Valued at the cost a count fixed (true), or at today's cost (false: an estimate). */
  fixed: boolean;
}

export interface ProfitLossStatement {
  grossSales: Money;
  discounts: Money;
  goods: Money;
  deliveryFees: Money;
  netSales: Money;
  cost: Money;
  /** Sales whose lines have no cost price: their profit isn't known, so they're taken out of the profit (never guessed). */
  missingCostSales: Money;
  /** Net sales less the cost and the sales without a cost. */
  grossProfit: Money;
  /** Below zero. */
  losses: Money;
  found: Money;
  profit: Money;
  vat: Money;
  orders: number;
  /** Some losses are at today's cost, not the cost when they happened. */
  lossesEstimated: boolean;
  /** Units lost or found without a cost price. */
  unvaluedUnits: number;
}

export interface ProfitLossReport {
  period: ReportPeriod;
  days: { from: string; to: string } | null;
  unit: SeriesUnit;
  statement: ProfitLossStatement;
  /** `costedSales`: the goods sold with a cost price, what each bar's margin is of. */
  series: { key: string; netSales: Money; costedSales: Money; cost: Money; losses: Money; profit: Money }[];
  /** Stock lost or found, by reason: most worth first. */
  moves: { reason: LossReason; direction: "in" | "out"; units: number; value: Money }[];
  /** Every product sold: profit and margin from the lines with a cost (each bar's profit leaves out sales without a cost too). */
  products: { productId: string; nameKm: string; nameEn: string; quantity: number; sales: Money; cost: Money; profit: Money; missingCostSales: Money }[];
}

const add = (into: Money, currency: Currency, amount: number) => {
  into[currency] += amount;
};
const minus = (a: Money, b: Money): Money => ({ USD: a.USD - b.USD, KHR: a.KHR - b.KHR });
const plus = (...all: Money[]): Money => all.reduce((sum, money) => ({ USD: sum.USD + money.USD, KHR: sum.KHR + money.KHR }), zero());

/** A margin in whole percent: profit of sales; null without sales. */
export const marginPercent = (profit: number, sales: number): number | null => (sales > 0 ? Math.round((profit / sales) * 100) : null);

/** The report for a period. Rows are from the period's first day on (all, for everything). */
export function profitLossReport(orderDays: readonly ProfitLossOrderDay[], items: readonly ProfitLossItem[], moves: readonly ProfitLossMove[], query: ReportQuery, today: string): ProfitLossReport {
  const days = reportRange(query, today);
  const inPeriod = <T extends { day: string }>(row: T) => !days || (row.day >= days.from && row.day <= days.to);
  const sold = orderDays.filter(inPeriod);
  const lines = items.filter(inPeriod);
  const stock = moves.filter(inPeriod).filter((move) => isLossReason(move.reason) && (move.direction === "out" || move.reason === "count_correction"));
  const first = [...sold, ...stock].reduce((oldest, row) => (row.day < oldest ? row.day : oldest), today);
  const { unit, keys } = reportSeries(days?.from ?? first, days?.to ?? today);
  const bars = keys.map((key) => ({ key, netSales: zero(), costedSales: zero(), cost: zero(), unknown: zero(), losses: zero() }));
  const bar = new Map(bars.map((point) => [point.key, point]));

  const grossSales = zero();
  const discounts = zero();
  const deliveryFees = zero();
  const vat = zero();
  let orders = 0;
  for (const row of sold) {
    add(grossSales, row.currency, row.subtotal);
    add(discounts, row.currency, -row.discount);
    add(deliveryFees, row.currency, row.deliveryFee);
    add(vat, row.currency, row.vat);
    orders += row.orders;
    const point = bar.get(seriesKeyOf(row.day, unit));
    if (point) add(point.netSales, row.currency, row.subtotal - row.discount + row.deliveryFee);
  }

  const cost = zero();
  const missingCostSales = zero();
  const products = new Map<string, ProfitLossReport["products"][number]>();
  for (const row of lines) {
    add(cost, row.currency, row.cost);
    add(missingCostSales, row.currency, row.sales - row.costedSales);
    const point = bar.get(seriesKeyOf(row.day, unit));
    if (point) {
      add(point.cost, row.currency, row.cost);
      add(point.costedSales, row.currency, row.costedSales);
      add(point.unknown, row.currency, row.sales - row.costedSales);
    }
    const product = products.get(row.productId) ?? { productId: row.productId, nameKm: row.nameKm, nameEn: row.nameEn, quantity: 0, sales: zero(), cost: zero(), profit: zero(), missingCostSales: zero() };
    product.quantity += row.quantity;
    add(product.sales, row.currency, row.sales);
    add(product.cost, row.currency, row.cost);
    add(product.profit, row.currency, row.costedSales - row.cost);
    add(product.missingCostSales, row.currency, row.sales - row.costedSales);
    products.set(row.productId, product);
  }

  const losses = zero();
  const found = zero();
  let lossesEstimated = false;
  let unvaluedUnits = 0;
  const byReason = new Map<string, ProfitLossReport["moves"][number]>();
  for (const move of stock) {
    if (!isLossReason(move.reason)) continue;
    const sign = move.direction === "out" ? -1 : 1;
    unvaluedUnits += move.unvalued;
    const key = `${move.direction}:${move.reason}`;
    const entry = byReason.get(key) ?? { reason: move.reason, direction: move.direction, units: 0, value: zero() };
    entry.units += move.units;
    byReason.set(key, entry);
    if (!move.currency) continue;
    if (!move.fixed && move.value > 0) lossesEstimated = true;
    add(move.direction === "out" ? losses : found, move.currency, sign * move.value);
    add(entry.value, move.currency, sign * move.value);
    const point = bar.get(seriesKeyOf(move.day, unit));
    if (point) add(point.losses, move.currency, sign * move.value);
  }
  const series = bars.map(({ unknown, ...point }) => ({ ...point, profit: plus(minus(minus(point.netSales, point.cost), unknown), point.losses) }));

  const goods = plus(grossSales, discounts);
  const netSales = plus(goods, deliveryFees);
  const grossProfit = minus(minus(netSales, cost), missingCostSales);
  return {
    period: query.period,
    days,
    unit,
    statement: { grossSales, discounts, goods, deliveryFees, netSales, cost, grossProfit, losses, found, profit: plus(grossProfit, losses, found), vat, orders, missingCostSales, lossesEstimated, unvaluedUnits },
    series,
    moves: [...byReason.values()].sort((a, b) => Math.abs(b.value.USD) + Math.abs(b.value.KHR) - (Math.abs(a.value.USD) + Math.abs(a.value.KHR)) || b.units - a.units),
    products: [...products.values()].sort((a, b) => b.profit.USD - a.profit.USD || b.profit.KHR - a.profit.KHR),
  };
}
