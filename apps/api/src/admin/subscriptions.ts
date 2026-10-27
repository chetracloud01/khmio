import { writeAudit, type SystemDb } from "@khmio/db";
import type { AdminOverride, PlanId, SubscriptionStatus } from "@khmio/shared";
import { applyOverrideToDates, periodEnd } from "./subscription-override";

// An admin's "Unblock" (add days) or plan change on one shop (design/screens.md A3).

export type SubscriptionChange =
  | { done: true; plan: PlanId; status: SubscriptionStatus; endsAt: Date | null }
  /** missing: no such shop; refused: the change doesn't apply, or someone changed it meanwhile. */
  | { done: false; reason: "missing" | "refused" };

export async function changeSubscription(
  db: SystemDb,
  change: { adminId: string; storeId: string; override: AdminOverride; action: "subscription.extended" | "subscription.plan_changed"; note: string },
  now = new Date(),
): Promise<SubscriptionChange> {
  return db.$transaction(async (tx): Promise<SubscriptionChange> => {
    const sub = await tx.subscription.findUnique({ where: { storeId: change.storeId } });
    if (!sub) return { done: false, reason: "missing" };
    let next;
    try {
      next = applyOverrideToDates(sub, change.override, now);
    } catch {
      return { done: false, reason: "refused" };
    }
    const data = { plan: next.plan, status: next.status, trialEndsAt: next.trialEndsAt, currentPeriodStart: next.currentPeriodStart, currentPeriodEnd: next.currentPeriodEnd };
    // Only if nobody changed it meanwhile (another admin, the billing job later).
    const { count } = await tx.subscription.updateMany({ where: { id: sub.id, updatedAt: sub.updatedAt }, data });
    if (count === 0) return { done: false, reason: "refused" };
    const before = { plan: sub.plan, status: sub.status, endsAt: periodEnd(sub) };
    const after = { plan: next.plan, status: next.status, endsAt: periodEnd(next), note: change.note, ...change.override };
    await writeAudit(tx, { actorType: "admin", actorId: change.adminId, storeId: change.storeId }, { action: change.action, entity: "subscription", entityId: sub.id, before, after });
    return { done: true, plan: next.plan, status: next.status, endsAt: periodEnd(next) };
  });
}
