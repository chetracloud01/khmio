import type { PurchaseDetail } from "@/lib/api";

/**
 * What's left to pay after each payment, oldest first: the bill's total less
 * its returns less every payment so far (a voided one counts for nothing and
 * shows none).
 */
export function leftAfterEach(purchase: Pick<PurchaseDetail, "totalMinor" | "payments" | "payment">): Map<string, number> {
  const left = new Map<string, number>();
  let owed = purchase.totalMinor - (purchase.payment?.returned ?? 0);
  for (const entry of purchase.payments) {
    if (entry.voided) continue;
    owed -= entry.amountMinor;
    left.set(entry.id, owed);
  }
  return left;
}

/**
 * A payment voucher's figures (design/screens.md S13 "Printing"): what the
 * bill comes to after its returns, paid by earlier payments (voided ones
 * don't count), this payment, and what's left after it — null for a voided
 * payment, which settled nothing. null when the bill has no such payment.
 */
export function voucherFigures(
  purchase: Pick<PurchaseDetail, "totalMinor" | "payments" | "payment">,
  paymentId: string,
): { billDue: number; paidBefore: number; amount: number; leftAfter: number | null; voided: boolean } | null {
  const index = purchase.payments.findIndex((entry) => entry.id === paymentId);
  const entry = purchase.payments[index];
  if (!entry) return null;
  const billDue = purchase.totalMinor - (purchase.payment?.returned ?? 0);
  const paidBefore = purchase.payments.slice(0, index).reduce((sum, earlier) => sum + (earlier.voided ? 0 : earlier.amountMinor), 0);
  return { billDue, paidBefore, amount: entry.amountMinor, leftAfter: entry.voided ? null : (leftAfterEach(purchase).get(entry.id) ?? null), voided: entry.voided };
}
