import { z } from "zod";
import { currencySchema, type Currency } from "./money";
import { orderLinesRequestSchema } from "./order-total";
import { optionalKhmerPhoneSchema } from "./store";

// Selling at the counter (design/screens.md P1–P4): the cash a buyer hands
// over and the change to give back, in the sale's one currency. Amounts are
// in the smallest unit: US cents or riel.

/** Notes buyers hand over, smallest first: $1 … $100, and 1,000៛ … 100,000៛. */
export const CASH_NOTES: Record<Currency, readonly number[]> = {
  USD: [100, 500, 1000, 2000, 5000, 10000],
  KHR: [1000, 2000, 5000, 10000, 20000, 50000, 100000],
};

/** How many "the buyer gave …" buttons the cash screen shows, the exact amount first. */
export const QUICK_CASH_COUNT = 4;

/** Change to give back, or null when the buyer hasn't given enough. */
export function cashChange(total: number, received: number): number | null {
  return received >= total ? received - total : null;
}

/**
 * One-tap amounts for the cash screen: the exact total, then the smallest
 * single notes and round sums of the biggest note that cover it — what a
 * buyer usually hands over.
 */
export function quickCashAmounts(total: number, currency: Currency): number[] {
  const notes = CASH_NOTES[currency];
  const biggest = notes[notes.length - 1] ?? 1;
  const roundUp = (step: number) => Math.ceil(total / step) * step;
  const candidates = [total, ...notes.map(roundUp), roundUp(biggest) + biggest];
  return [...new Set(candidates)].filter((amount) => amount >= total && amount > 0).sort((a, b) => a - b).slice(0, QUICK_CASH_COUNT);
}

/**
 * How the buyer paid at the counter. Cash: what they handed over (checked
 * against the total the server works out). Shop QR: the seller's tick that
 * the money shows in their own bank app — Khmio never sees that payment.
 */
export const counterPaymentSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("cash"), receivedMinor: z.number({ invalid_type_error: "price_invalid" }).int("price_invalid").min(0, "price_invalid") }),
  z.object({ method: z.literal("shop_qr"), sellerConfirmed: z.literal(true, { errorMap: () => ({ message: "required" }) }) }),
]);
export type CounterPayment = z.infer<typeof counterPaymentSchema>;

/**
 * A sale at the counter (POST /counter/sales). Prices are never sent: the
 * server works the total out from the catalog. `idempotencyKey` is made once
 * per sale, so a double tap or a retry gives back the same sale.
 */
export const counterSaleInputSchema = z.object({
  idempotencyKey: z.string().uuid("required"),
  currency: currencySchema,
  lines: orderLinesRequestSchema,
  payment: counterPaymentSchema,
  buyerName: z.string().trim().max(60, "too_long"),
  buyerPhone: optionalKhmerPhoneSchema,
  /** Dine-in (Features › tables): the table this sale is for. */
  tableId: z.string().uuid("required").optional(),
  /** A garage (Features › jobCards): the job card this sale bills; the card is then handed over. */
  jobCardId: z.string().uuid("required").optional(),
});
export type CounterSaleInput = z.infer<typeof counterSaleInputSchema>;
