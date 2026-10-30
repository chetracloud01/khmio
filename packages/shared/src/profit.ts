import { convertKhrToUsdCents, convertUsdCentsToKhr, type Currency } from "./money";

// Cost price (docs/blueprint.md "Cost price"): an item's cost in an order's
// currency, frozen on each order line when it's sold; the average cost after
// a purchase; and what the shelf is worth. Dollars and riel are kept apart,
// never converted except at an order's own rate (docs/blueprint.md
// "Multi-currency pricing and totals"). A cost not known is never guessed.
// The profit itself is the profit and loss report's (profit-loss.ts).

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
