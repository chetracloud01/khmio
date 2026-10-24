import { z } from "zod";
import type { DeliveryFee } from "./delivery";
import { deliveryFeeIn } from "./delivery";
import { convertKhrToUsdCents, convertUsdCentsToKhr, type Currency } from "./money";

// The money of an order (docs/blueprint.md "Multi-currency pricing and
// totals"). One function, used by the cart and checkout in the browser and
// again by the API, which never trusts a total the browser sends:
// - the buyer picks one currency for the whole order;
// - a line with no price in that currency is converted at the store's rate;
// - each line is rounded first, then the rounded lines are summed;
// - VAT is worked out on the goods after discounts; the delivery fee is added last.

/** Most of one thing a buyer can put in one cart line. */
export const MAX_LINE_QUANTITY = 99;
/** Most lines in one order. */
export const MAX_ORDER_LINES = 50;

/** A variant's own prices; either can be missing, never both (the database checks that). */
export interface VariantPrices {
  priceUsdCents: number | null;
  priceKhr: number | null;
}

/**
 * One unit's price in the order currency, before any discount: the native
 * price if the variant has one, else the other currency converted at the
 * store's rate. undefined = the variant has no price at all.
 */
export function unitPriceIn(prices: VariantPrices, currency: Currency, usdToKhrRate: number): number | undefined {
  if (currency === "USD") {
    if (prices.priceUsdCents !== null) return prices.priceUsdCents;
    return prices.priceKhr !== null ? convertKhrToUsdCents(prices.priceKhr, usdToKhrRate) : undefined;
  }
  if (prices.priceKhr !== null) return prices.priceKhr;
  return prices.priceUsdCents !== null ? convertUsdCentsToKhr(prices.priceUsdCents, usdToKhrRate) : undefined;
}

/** A unit price after the product's discount, rounded to a whole cent or riel. */
export function applyDiscount(price: number, discountPercent: number | null): number {
  return discountPercent ? Math.round(price * (1 - discountPercent / 100)) : price;
}

export interface OrderLineInput extends VariantPrices {
  /** The caller's own key for the line (the variant id), handed back unchanged. */
  key: string;
  quantity: number;
  discountPercent: number | null;
}

export interface OrderTotalInput {
  lines: OrderLineInput[];
  currency: Currency;
  usdToKhrRate: number;
  vatPercent: number;
  /** The delivery fee as the shop set it; null = no fee known yet (counts as 0). */
  deliveryFee: DeliveryFee | null;
}

export interface OrderTotalLine {
  key: string;
  quantity: number;
  /** One unit before the discount, in the order currency. */
  baseUnitPrice: number;
  /** One unit after the discount — what the buyer pays per unit. */
  unitPrice: number;
  /** unitPrice × quantity. */
  lineTotal: number;
}

export interface OrderTotal {
  lines: OrderTotalLine[];
  itemCount: number;
  /** Every line at its price before discounts. */
  subtotal: number;
  /** What the product discounts took off. */
  discount: number;
  /** subtotal − discount: the goods the buyer pays for. */
  goods: number;
  vat: number;
  deliveryFee: number;
  /** goods + VAT + delivery: the one amount the buyer pays. */
  total: number;
}

export class UnpricedLineError extends Error {
  constructor(public readonly key: string) {
    super(`line ${key} has no price`);
    this.name = "UnpricedLineError";
  }
}

/** The order's money, all in `currency`, all whole cents or riel. Throws UnpricedLineError for a line with no price. */
export function computeOrderTotal(input: OrderTotalInput): OrderTotal {
  const lines = input.lines.map((line): OrderTotalLine => {
    const baseUnitPrice = unitPriceIn(line, input.currency, input.usdToKhrRate);
    if (baseUnitPrice === undefined) throw new UnpricedLineError(line.key);
    const unitPrice = applyDiscount(baseUnitPrice, line.discountPercent);
    return { key: line.key, quantity: line.quantity, baseUnitPrice, unitPrice, lineTotal: unitPrice * line.quantity };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.baseUnitPrice * line.quantity, 0);
  const goods = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const vat = Math.round(goods * (input.vatPercent / 100));
  const deliveryFee = input.deliveryFee ? deliveryFeeIn(input.deliveryFee, input.currency, input.usdToKhrRate) : 0;
  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    discount: subtotal - goods,
    goods,
    vat,
    deliveryFee,
    total: goods + vat + deliveryFee,
  };
}

/** The other currency, for the small "≈" figure under a total. Display only — never used to check a payment. */
export function approximateIn(amount: number, from: Currency, usdToKhrRate: number): number {
  return from === "USD" ? convertUsdCentsToKhr(amount, usdToKhrRate) : convertKhrToUsdCents(amount, usdToKhrRate);
}

export const orderLineRequestSchema = z.object({
  variantId: z.string().uuid("product_unavailable"),
  quantity: z
    .number({ invalid_type_error: "quantity_invalid" })
    .int("quantity_invalid")
    .min(1, "quantity_invalid")
    .max(MAX_LINE_QUANTITY, "quantity_invalid"),
});

/** The lines of an order or a counter sale: each product option once. */
export const orderLinesRequestSchema = z
  .array(orderLineRequestSchema)
  .min(1, "cart_empty")
  .max(MAX_ORDER_LINES, "too_long")
  .refine((lines) => new Set(lines.map((line) => line.variantId)).size === lines.length, "product_unavailable");

/**
 * What the shop page sends to place an order. `checkout` is the buyer's form,
 * checked by checkoutInputSchema once the API adds the store's own settings;
 * `idempotencyKey` is made once per checkout, so sending it twice (a double
 * tap, a retry on bad signal) gives back the same order.
 */
export const placeOrderRequestSchema = z.object({
  idempotencyKey: z.string().uuid("required"),
  lines: orderLinesRequestSchema,
  checkout: z.record(z.unknown()),
  /** Cloudflare Turnstile's token from the checkout page; the API checks it when Turnstile is set up. */
  botCheck: z.string().max(4096).optional(),
});
export type PlaceOrderRequest = z.infer<typeof placeOrderRequestSchema>;
