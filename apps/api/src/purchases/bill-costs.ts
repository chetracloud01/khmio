import type { Tx } from "@khmio/db";
import { itemCostOf, type Currency, type PurchaseInput } from "@khmio/shared";
import { InvalidInputException } from "../errors";
import { readRateBand } from "../store/store";

// A bill's lines in their items' own cost currencies (docs/blueprint.md "Cost
// price", suppliers and bills): each item keeps one cost currency, so a line
// in the other one is turned into it once, at the bill's rate — which must be
// given then, and within the platform's band like the shop's own rate.

/** Each option's cost currency: its own, else one its product's other options already have; null: no cost yet. */
export async function itemCostCurrencies(tx: Tx, variantIds: string[]): Promise<Map<string, Currency | null>> {
  const variants = await tx.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, costCurrency: true, product: { select: { variants: { where: { deletedAt: null, costCurrency: { not: null } }, select: { costCurrency: true }, take: 1 } } } },
  });
  return new Map(variants.map((variant) => [variant.id, variant.costCurrency ?? variant.product.variants[0]?.costCurrency ?? null]));
}

/**
 * Each line's cost of one in its item's currency, and the rate the bill
 * keeps: null when nothing needed turning. A line that needs turning
 * without a rate, or a rate outside the platform's band, is refused.
 */
export async function billItemCosts(tx: Tx, input: Pick<PurchaseInput, "currency" | "exchangeRate" | "lines">): Promise<{ costs: { minor: number; currency: Currency }[]; rateUsed: number | null }> {
  const currencies = await itemCostCurrencies(tx, input.lines.map((line) => line.variantId));
  const needsRate = input.lines.some((line) => {
    const itemCurrency = currencies.get(line.variantId) ?? null;
    return itemCurrency !== null && itemCurrency !== input.currency;
  });
  let rate: number | null = null;
  if (needsRate) {
    if (input.exchangeRate === undefined) throw new InvalidInputException({ exchangeRate: "required" });
    const band = await readRateBand(tx);
    if (input.exchangeRate < band.min || input.exchangeRate > band.max) throw new InvalidInputException({ exchangeRate: "rate_out_of_band" });
    rate = input.exchangeRate;
  }
  const costs = input.lines.map((line, index) => {
    const cost = itemCostOf(line.unitCost, input.currency, currencies.get(line.variantId) ?? null, rate);
    if (!cost) throw new InvalidInputException({ [`lines.${index}.unitCost`]: "rate_invalid" });
    return cost;
  });
  return { costs, rateUsed: rate };
}
