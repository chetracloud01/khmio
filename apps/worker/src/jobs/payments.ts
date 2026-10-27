import { queueAdminAlert, type Prisma, type SystemDb } from "@khmio/db";
import type { PaymentProvider } from "@khmio/payments";
import { decidePaymentCheck, isPaymentCheckDue, type PaymentCheckDecision } from "@khmio/shared";
import type { Logger } from "pino";

// Checking KHQR payments (roadmap step 5, docs/blueprint.md "Flow A"): every
// pending attempt is asked about through the provider's own status API —
// never a callback, never the browser — and paid only on an exact match of
// currency and amount (packages/shared decidePaymentCheck). Each result is
// written in one transaction that only changes an attempt still pending and
// an order still waiting, so the same answer twice changes nothing.

/** How often the worker looks for attempts due a check; each one is paced by isPaymentCheckDue. */
export const PAYMENT_CHECK_LOOP_MS = 1_000;
/** At most this many attempts per round, the soonest to expire first. */
const PAYMENTS_PER_ROUND = 50;

const pendingAttemptSelect = {
  id: true,
  storeId: true,
  orderId: true,
  providerRef: true,
  amountMinor: true,
  currency: true,
  createdAt: true,
  lastCheckedAt: true,
  expiresAt: true,
  order: { select: { status: true, orderNumber: true, store: { select: { slug: true } } } },
} satisfies Prisma.PaymentAttemptSelect;
type PendingAttempt = Prisma.PaymentAttemptGetPayload<{ select: typeof pendingAttemptSelect }>;

/** One round: asks about every attempt that's due. Returns how many were asked about. */
export async function checkPaymentsOnce(deps: { db: SystemDb; provider: PaymentProvider; logger: Logger; now?: Date }): Promise<number> {
  const now = deps.now ?? new Date();
  const pending = await deps.db.paymentAttempt.findMany({ where: { status: "pending" }, select: pendingAttemptSelect, orderBy: { expiresAt: "asc" }, take: PAYMENTS_PER_ROUND });
  const due = pending.filter((attempt) => isPaymentCheckDue(attempt, now));
  for (const attempt of due) {
    const report = await deps.provider.checkPayment(attempt.providerRef, { storeId: attempt.storeId });
    const decision = decidePaymentCheck({ currency: attempt.currency, amountMinor: attempt.amountMinor }, report.reported, {
      expired: now >= attempt.expiresAt,
      orderAwaitingPayment: attempt.order.status === "awaiting_payment",
    });
    await applyPaymentDecision(deps.db, attempt, decision, report.raw, now);
    if (decision.kind !== "wait") deps.logger.info({ orderNumber: attempt.order.orderNumber, decision: decision.kind }, "payment check");
  }
  return due.length;
}

/** Writes what one check decided: the attempt, and its order if it still waits. */
export async function applyPaymentDecision(
  db: SystemDb,
  attempt: Pick<PendingAttempt, "id" | "storeId" | "orderId" | "order">,
  decision: PaymentCheckDecision,
  raw: Prisma.InputJsonObject,
  now: Date,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const checked = { checkCount: { increment: 1 }, lastCheckedAt: now, rawResponse: raw };
    const stillPending = { id: attempt.id, status: "pending" as const };
    if (decision.kind === "wait") {
      await tx.paymentAttempt.updateMany({ where: stillPending, data: checked });
      return;
    }
    if (decision.kind === "paid") {
      const { count } = await tx.paymentAttempt.updateMany({ where: stillPending, data: { ...checked, status: "paid", paidAt: now } });
      if (count === 0) return;
      const moved = await tx.order.updateMany({ where: { id: attempt.orderId, status: "awaiting_payment" }, data: { status: "paid" } });
      if (moved.count === 0) return;
      // What it held becomes a sale; the seller hears about the order only now ("Paid by KHQR").
      await tx.$executeRaw`SELECT app_settle_reserved_stock(${attempt.orderId}::uuid)`;
      await tx.orderStatusEvent.create({ data: { storeId: attempt.storeId, orderId: attempt.orderId, status: "paid", actor: "system" } });
      await tx.outboxEvent.create({ data: { storeId: attempt.storeId, kind: "order_placed", payload: { orderId: attempt.orderId } } });
      return;
    }
    const ended = decision.kind === "issue" ? { status: "failed" as const, issue: decision.issue, issueStatus: "open" as const } : { status: "expired" as const };
    const { count } = await tx.paymentAttempt.updateMany({ where: stillPending, data: { ...checked, ...ended } });
    if (count === 0) return;
    if (decision.kind === "issue") {
      await queueAdminAlert(tx, { reason: "payment_issue", issue: decision.issue, orderNumber: attempt.order.orderNumber, storeSlug: attempt.order.store.slug });
    }
    // Unpaid in time (or not payable as it stands): the order, if it still waits, is cancelled and lets go of its stock.
    const cancelled = await tx.order.updateMany({ where: { id: attempt.orderId, status: "awaiting_payment" }, data: { status: "cancelled", cancelReason: "payment_timeout" } });
    if (cancelled.count === 0) return;
    await tx.$executeRaw`SELECT app_release_reserved_stock(${attempt.orderId}::uuid)`;
    await tx.orderStatusEvent.create({ data: { storeId: attempt.storeId, orderId: attempt.orderId, status: "cancelled", actor: "system" } });
    await tx.outboxEvent.create({ data: { storeId: attempt.storeId, kind: "order_status_changed", payload: { orderId: attempt.orderId, status: "cancelled" } } });
  });
}
