import { convertKhrToUsdCents, convertUsdCentsToKhr, type Currency } from "./money";

// The profit report (Reports, design/screens.md S17; plan feature
// "profitReport"): sales, what they cost the shop, and the difference, from
// the cost frozen on each order line. Dollars and riel are kept apart, never
// converted (docs/blueprint.md "Multi-currency pricing and totals"). A line
// sold without a known cost is counted as "cost missing", never guessed.
// Sales are the goods after product discounts — no VAT, no delivery fees.

/** The report's periods (and the home page's sales card), in days back from today (Phnom Penh). */
export const SALES_PERIODS = { today: 1, week: 7, month: 30 } as const;
export type SalesPeriod = keyof typeof SALES_PERIODS;

/** A product option's cost as saved: one amount in one currency (docs/blueprint.md "Cost price"); null = not known. */
export interface VariantCost {
  costMinor: number | null;
  costCurrency: Currency | null;
}

/**
 * One item's cost in the order's currency, to freeze on its line: as saved
 * when the currencies match, else converted at the order's rate and rounded
 * like a price. undefined = no cost known.
 */
export function unitCostIn(cost: VariantCost, currency: Currency, usdToKhrRate: number): number | undefined {
  if (cost.costMinor === null || cost.costCurrency === null) return undefined;
  if (cost.costCurrency === currency) return cost.costMinor;
  return currency === "USD" ? convertKhrToUsdCents(cost.costMinor, usdToKhrRate) : convertUsdCentsToKhr(cost.costMinor, usdToKhrRate);
}

/**
 * A product option's cost after a purchase — the moving weighted average
 * (docs/blueprint.md "Cost price", level 2): what's on hand at the old cost
 * and what arrived at the new one, rounded to a whole cent or riel. No cost
 * typed: the cost stays. Nothing on hand, or no cost yet: the purchase's
 * cost becomes the cost. Returns never call this: they keep the average.
 */
export function movingAverageCost(onHand: number, currentCost: number | null, bought: number, purchaseCost: number | null): number | null {
  if (purchaseCost === null) return currentCost;
  if (currentCost === null || onHand <= 0) return purchaseCost;
  return Math.round((onHand * currentCost + bought * purchaseCost) / (onHand + bought));
}

/** One tracked product option, for the stock value. */
export interface StockValueRow {
  onHand: number;
  costMinor: number | null;
  costCurrency: Currency | null;
}

/**
 * How much money sits on the shelves: on hand × cost, dollars and riel apart
 * (never converted), and how many options in stock have no cost yet (left out).
 */
export function stockValue(rows: readonly StockValueRow[]): { USD: number; KHR: number; withoutCost: number } {
  const value = { USD: 0, KHR: 0, withoutCost: 0 };
  for (const row of rows) {
    if (row.onHand <= 0) continue;
    if (row.costMinor === null || row.costCurrency === null) value.withoutCost += 1;
    else value[row.costCurrency] += row.onHand * row.costMinor;
  }
  return value;
}

/** Most products the report lists per period. */
export const PROFIT_REPORT_PRODUCTS = 20;

/** One product's sales on one Phnom Penh day in one currency, as the database adds them up. */
export interface ProfitRow {
  day: string;
  nameKm: string;
  nameEn: string;
  currency: Currency;
  quantity: number;
  /** Line totals. */
  sales: number;
  /** Of those, the lines with a cost, and what they cost. */
  costedSales: number;
  cost: number;
}

export interface ProfitFigures {
  sales: number;
  /** Sales whose cost is known… */
  costedSales: number;
  /** …what they cost, and the profit on them. */
  cost: number;
  profit: number;
  /** profit ÷ costedSales, in whole percent; null when nothing with a cost was sold. */
  marginPercent: number | null;
  /** Sales whose cost isn't known: left out of the profit. */
  missingCostSales: number;
}

export interface ProfitProduct {
  nameKm: string;
  nameEn: string;
  quantity: number;
  USD: ProfitFigures;
  KHR: ProfitFigures;
}

export interface ProfitPeriod {
  USD: ProfitFigures;
  KHR: ProfitFigures;
  /** Most profit first in the shop's main currency, then the other. */
  products: ProfitProduct[];
}

const empty = (): ProfitFigures => ({ sales: 0, costedSales: 0, cost: 0, profit: 0, marginPercent: null, missingCostSales: 0 });

function add(into: ProfitFigures, row: ProfitRow): void {
  into.sales += row.sales;
  into.costedSales += row.costedSales;
  into.cost += row.cost;
  into.profit = into.costedSales - into.cost;
  into.missingCostSales = into.sales - into.costedSales;
  into.marginPercent = into.costedSales > 0 ? Math.round((into.profit / into.costedSales) * 100) : null;
}

/** One period of the report: from `since` (a Phnom Penh date, "2026-10-01") on. */
export function profitSince(rows: readonly ProfitRow[], since: string, mainCurrency: Currency): ProfitPeriod {
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";
  const totals = { USD: empty(), KHR: empty() };
  const byName = new Map<string, ProfitProduct>();
  for (const row of rows) {
    if (row.day < since) continue;
    add(totals[row.currency], row);
    const key = JSON.stringify([row.nameKm, row.nameEn]);
    const product = byName.get(key) ?? { nameKm: row.nameKm, nameEn: row.nameEn, quantity: 0, USD: empty(), KHR: empty() };
    product.quantity += row.quantity;
    add(product[row.currency], row);
    byName.set(key, product);
  }
  const products = [...byName.values()]
    .sort((a, b) => b[mainCurrency].profit - a[mainCurrency].profit || b[other].profit - a[other].profit || b.quantity - a.quantity)
    .slice(0, PROFIT_REPORT_PRODUCTS);
  return { ...totals, products };
}
