import { convertKhrToUsdCents, formatKhr, formatUsd } from "@khmio/shared";
import type { Product, ProductVariant } from "./api";

// Prices as the dashboard list and the shop page show them. Display only:
// the order total (one currency, each line rounded then summed) is worked
// out at checkout — docs/blueprint.md "Multi-currency pricing and totals".

/** A price after the product's discount, rounded to a whole cent or riel. */
export function discounted(price: number, discountPercent: number | null): number {
  return discountPercent ? Math.round(price * (1 - discountPercent / 100)) : price;
}

/** For sorting and "from" prices: the variant's price in USD cents, converting a riel-only price at the store's rate. */
export function usdValue(variant: ProductVariant, usdToKhrRate: number): number {
  if (variant.priceUsdCents != null) return variant.priceUsdCents;
  return variant.priceKhr != null ? convertKhrToUsdCents(variant.priceKhr, usdToKhrRate) : 0;
}

/** The cheapest option (or the only variant of a product without options). */
export function startingVariant(product: Product, usdToKhrRate: number): ProductVariant | undefined {
  return product.variants.reduce<ProductVariant | undefined>(
    (cheapest, variant) => (!cheapest || usdValue(variant, usdToKhrRate) < usdValue(cheapest, usdToKhrRate) ? variant : cheapest),
    undefined,
  );
}

/** "$8.50", "5,000៛" or "$1.25 · 5,000៛" when both are set; the discount already taken off. */
export function priceText(variant: ProductVariant | undefined, discountPercent: number | null, original = false): string {
  if (!variant) return "—";
  const percent = original ? null : discountPercent;
  const parts = [
    variant.priceUsdCents != null ? formatUsd(discounted(variant.priceUsdCents, percent)) : null,
    variant.priceKhr != null ? formatKhr(discounted(variant.priceKhr, percent)) : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(" · ") : "—";
}
