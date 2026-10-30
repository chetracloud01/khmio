import type { Tx } from "@khmio/db";
import { phnomPenhDay, type PurchasePaymentInput } from "@khmio/shared";
import { nextDocumentNumber } from "../documents/next-number";
import { AppException, InvalidInputException } from "../errors";
import { readBillBalances } from "./bill-balances";
import { dateOf } from "./purchase-days";
import type { Context } from "./purchases";

// Paying supplier bills (docs/blueprint.md "Cost price", suppliers and bills),
// inside the seller's withContext: a payment against one bill, in the bill's
// currency (never converted), never more than it still owes. A payment is
// never edited or deleted; one made by mistake is voided, once (the database
// allows the app to change nothing else, and only from not voided to voided).

/** Records a payment (PAY-…) against a bill. Returns the bill's id. */
export async function recordPurchasePayment(tx: Tx, context: Context, purchaseId: string, input: PurchasePaymentInput, now = new Date()): Promise<string> {
  const { storeId } = context;
  // First: taking the number holds the shop's payment counter until this
  // transaction ends, so two payments at once can't both read the old
  // "still owed" and pay more than the bill.
  const number = await nextDocumentNumber(tx, storeId, "payment");
  const [balance] = await readBillBalances(tx, storeId, phnomPenhDay(now), purchaseId);
  if (!balance) throw new AppException(404, "action_not_allowed");
  if (input.amount > balance.owed) throw new InvalidInputException({ amount: "payment_above_owed" });
  await tx.purchasePayment.create({
    data: { storeId, purchaseId, number, paidOn: dateOf(input.paidOn), amountMinor: input.amount, method: input.method, note: input.note, createdById: context.merchantId },
  });
  return purchaseId;
}

/** Voids one payment made by mistake; it stays in the bill's history, crossed out. Returns its bill's id. */
export async function voidPurchasePayment(tx: Tx, context: Context, paymentId: string): Promise<string> {
  const payment = await tx.purchasePayment.findFirst({ where: { id: paymentId, storeId: context.storeId, voidedAt: null }, select: { purchaseId: true } });
  if (!payment) throw new AppException(404, "action_not_allowed");
  await tx.purchasePayment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidedById: context.merchantId }, select: { id: true } });
  return payment.purchaseId;
}
