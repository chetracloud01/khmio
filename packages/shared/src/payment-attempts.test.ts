import { describe, expect, it } from "vitest";
import { adminAlertSchema, adminAlertText } from "./notifications";
import { decidePaymentCheck, isPaymentCheckDue, KHQR_CODE_MINUTES, PAYMENT_CHECK_FAST_FOR_MINUTES, PAYMENT_CHECK_FAST_SECONDS, PAYMENT_CHECK_SLOW_SECONDS } from "./payment-attempts";

const expected = { currency: "KHR" as const, amountMinor: 10_800 };
const waiting = { expired: false, orderAwaitingPayment: true };

describe("when a payment is checked again", () => {
  const made = new Date("2026-10-27T03:00:00Z");
  const expiresAt = new Date(made.getTime() + KHQR_CODE_MINUTES * 60_000);
  const at = (seconds: number) => new Date(made.getTime() + seconds * 1000);

  it("checks a new code at once, then every few seconds", () => {
    expect(isPaymentCheckDue({ createdAt: made, lastCheckedAt: null, expiresAt }, at(0))).toBe(true);
    expect(isPaymentCheckDue({ createdAt: made, lastCheckedAt: at(10), expiresAt }, at(10 + PAYMENT_CHECK_FAST_SECONDS - 1))).toBe(false);
    expect(isPaymentCheckDue({ createdAt: made, lastCheckedAt: at(10), expiresAt }, at(10 + PAYMENT_CHECK_FAST_SECONDS))).toBe(true);
  });

  it("slows down after the first minutes", () => {
    const later = PAYMENT_CHECK_FAST_FOR_MINUTES * 60 + 30;
    expect(isPaymentCheckDue({ createdAt: made, lastCheckedAt: at(later), expiresAt }, at(later + PAYMENT_CHECK_FAST_SECONDS))).toBe(false);
    expect(isPaymentCheckDue({ createdAt: made, lastCheckedAt: at(later), expiresAt }, at(later + PAYMENT_CHECK_SLOW_SECONDS))).toBe(true);
  });

  it("always gives an expired code its last check", () => {
    const end = KHQR_CODE_MINUTES * 60;
    expect(isPaymentCheckDue({ createdAt: made, lastCheckedAt: at(end - 1), expiresAt }, at(end))).toBe(true);
  });
});

describe("the admin alert for a payment issue", () => {
  it("names the order and the shop, never the buyer", () => {
    const text = adminAlertText(adminAlertSchema.parse({ reason: "payment_issue", issue: "amount_mismatch", orderNumber: 41, storeSlug: "srey-neang" }));
    expect(text).toContain("#41");
    expect(text).toContain("/s/srey-neang");
    expect(text).toContain("paid a different amount");
  });
});

describe("what a payment check decides", () => {
  it("pays only on the exact amount and currency", () => {
    expect(decidePaymentCheck(expected, { currency: "KHR", amountMinor: 10_800 }, waiting)).toEqual({ kind: "paid" });
    expect(decidePaymentCheck(expected, { currency: "KHR", amountMinor: 10_000 }, waiting)).toEqual({ kind: "issue", issue: "amount_mismatch" });
    expect(decidePaymentCheck(expected, { currency: "USD", amountMinor: 10_800 }, waiting)).toEqual({ kind: "issue", issue: "currency_mismatch" });
  });

  it("waits while nothing is paid, and expires the code when its time is up", () => {
    expect(decidePaymentCheck(expected, null, waiting)).toEqual({ kind: "wait" });
    expect(decidePaymentCheck(expected, null, { ...waiting, expired: true })).toEqual({ kind: "expire" });
  });

  it("pays a code that was paid in time, even when its last check comes just after the end", () => {
    expect(decidePaymentCheck(expected, { currency: "KHR", amountMinor: 10_800 }, { expired: true, orderAwaitingPayment: true })).toEqual({ kind: "paid" });
  });

  it("never pays an order that stopped waiting (cancelled meanwhile): a person looks", () => {
    expect(decidePaymentCheck(expected, { currency: "KHR", amountMinor: 10_800 }, { expired: false, orderAwaitingPayment: false })).toEqual({ kind: "issue", issue: "paid_after_expiry" });
  });

  it("retries an unreachable provider until the code expires, then asks a person", () => {
    expect(decidePaymentCheck(expected, "unreachable", waiting)).toEqual({ kind: "wait" });
    expect(decidePaymentCheck(expected, "unreachable", { ...waiting, expired: true })).toEqual({ kind: "issue", issue: "provider_unreachable" });
  });
});
