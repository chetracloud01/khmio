import { z } from "zod";
import type { Currency } from "./money";

// Every try to pay for a buyer's order — the payment_attempts table in
// docs/blueprint.md. The rule the whole app keeps: an attempt is paid only
// when the provider's own status API reports the exact currency and amount.
// Nobody — not a callback, not an admin — can mark one paid another way.

export const paymentProviderSchema = z.enum(["bakong_khqr", "aba_payway"]);
export type PaymentProvider = z.infer<typeof paymentProviderSchema>;

export const paymentAttemptStatusSchema = z.enum(["pending", "paid", "expired", "failed"]);
export type PaymentAttemptStatus = z.infer<typeof paymentAttemptStatusSchema>;

/** Why a status check needs a person to look. */
export const paymentCheckIssueSchema = z.enum([
  /** The provider's status API kept failing, so we don't know if the buyer paid. */
  "provider_unreachable",
  /** The provider says paid, but for a different amount. */
  "amount_mismatch",
  /** The provider says paid, but in the other currency. */
  "currency_mismatch",
  /** The money arrived after the code expired and the order was cancelled. */
  "paid_after_expiry",
]);
export type PaymentCheckIssue = z.infer<typeof paymentCheckIssueSchema>;

export interface PaymentAmount {
  currency: Currency;
  amountMinor: number;
}

/** Integer match on both currency and amount — never "close enough", never converted. */
export function isExactPaymentMatch(expected: PaymentAmount, reported: PaymentAmount): boolean {
  return expected.currency === reported.currency && expected.amountMinor === reported.amountMinor;
}

/**
 * What one status check found.
 * reported = what the provider says was paid; null = it says nothing was paid yet;
 * "unreachable" = the provider didn't answer.
 */
export function evaluatePaymentCheck(
  expected: PaymentAmount,
  reported: PaymentAmount | null | "unreachable",
  attemptExpired: boolean,
): { outcome: "paid" } | { outcome: "not_paid" } | { outcome: "issue"; issue: PaymentCheckIssue } {
  if (reported === "unreachable") return { outcome: "issue", issue: "provider_unreachable" };
  if (reported === null) return { outcome: "not_paid" };
  if (reported.currency !== expected.currency) return { outcome: "issue", issue: "currency_mismatch" };
  if (reported.amountMinor !== expected.amountMinor) return { outcome: "issue", issue: "amount_mismatch" };
  if (attemptExpired) return { outcome: "issue", issue: "paid_after_expiry" };
  return { outcome: "paid" };
}

/** A KHQR code is valid this long (NBC's maximum); unpaid by then, the order is cancelled and its stock let go. */
export const KHQR_CODE_MINUTES = 10;
/** A fresh code is checked this often: most buyers pay within the first minutes. */
export const PAYMENT_CHECK_FAST_SECONDS = 5;
/** …for this long after it was made; then less often, to spare the provider. */
export const PAYMENT_CHECK_FAST_FOR_MINUTES = 2;
export const PAYMENT_CHECK_SLOW_SECONDS = 15;

/** Whether a pending attempt is due for another status check now. Expired ones always are: their last check decides. */
export function isPaymentCheckDue(attempt: { createdAt: Date; lastCheckedAt: Date | null; expiresAt: Date }, now: Date): boolean {
  if (attempt.lastCheckedAt === null || now >= attempt.expiresAt) return true;
  const fast = now.getTime() - attempt.createdAt.getTime() < PAYMENT_CHECK_FAST_FOR_MINUTES * 60_000;
  const every = (fast ? PAYMENT_CHECK_FAST_SECONDS : PAYMENT_CHECK_SLOW_SECONDS) * 1000;
  return now.getTime() - attempt.lastCheckedAt.getTime() >= every;
}

/**
 * What a status check means for the attempt and its order.
 * - "paid": the order is paid (and its held stock sold).
 * - "wait": nothing yet; check again later.
 * - "expire": the code ran out unpaid; the order is cancelled (payment_timeout) if it still waits.
 * - "issue": a person must look; the order, if it still waits, is cancelled like an expiry.
 * An unreachable provider is retried until the code expires, and only then becomes an issue.
 */
export type PaymentCheckDecision = { kind: "paid" } | { kind: "wait" } | { kind: "expire" } | { kind: "issue"; issue: PaymentCheckIssue };

export function decidePaymentCheck(
  expected: PaymentAmount,
  reported: PaymentAmount | null | "unreachable",
  facts: { expired: boolean; orderAwaitingPayment: boolean },
): PaymentCheckDecision {
  if (reported === "unreachable" && !facts.expired) return { kind: "wait" };
  // Money that arrives for an order no longer waiting for it (cancelled meanwhile) is never "paid".
  const result = evaluatePaymentCheck(expected, reported, !facts.orderAwaitingPayment);
  if (result.outcome === "paid") return { kind: "paid" };
  if (result.outcome === "issue") return { kind: "issue", issue: result.issue };
  return facts.expired ? { kind: "expire" } : { kind: "wait" };
}

/** Closing a failed check by hand: say what was done about it (refund arranged, buyer paid again…). */
export const failedCheckCloseSchema = z.object({
  note: z.string().trim().min(5, "too_short").max(300, "too_long"),
});
export type FailedCheckClose = z.infer<typeof failedCheckCloseSchema>;
