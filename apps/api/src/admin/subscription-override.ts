import { type AdminOverride, applyAdminOverride, BILLING_PERIOD_DAYS, DAY_MS, type PlanId, type SubscriptionStatus } from "@khmio/shared";


export interface SubscriptionDates {
  plan: PlanId;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
}

/** The day the shop's trial or paid period ends (or ended). */
export function periodEnd(sub: SubscriptionDates): Date | null {
  return sub.status === "trialing" ? sub.trialEndsAt : sub.currentPeriodEnd;
}

/**
 * An admin's change (packages/shared plans.ts applyAdminOverride, which
 * decides the plan and status) turned into dates for the subscriptions row:
 * - extend: days are added to the trial or period end; a paused or overdue
 *   shop reopens for exactly those days, counted from now;
 * - setPlan: from a trial or a pause, a fresh 30-day paid period starts now;
 *   otherwise only the plan changes.
 */
export function applyOverrideToDates(sub: SubscriptionDates, override: AdminOverride, now = new Date()): SubscriptionDates {
  const end = periodEnd(sub);
  const daysLeft = end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS)) : 0;
  const next = applyAdminOverride({ plan: sub.plan, status: sub.status, daysLeft }, override);

  if (override.kind === "setPlan") {
    if (next.plan === sub.plan) return sub;
    if (sub.status === "trialing" || sub.status === "paused") {
      return { ...sub, plan: next.plan, status: next.status, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + BILLING_PERIOD_DAYS * DAY_MS) };
    }
    return { ...sub, plan: next.plan };
  }

  const reopened = sub.status === "paused" || sub.status === "grace";
  // Reopening counts from now; otherwise the days go on top of what's left (or from now if it already ended).
  const base = reopened || !end || end < now ? now : end;
  const newEnd = new Date(base.getTime() + override.days * DAY_MS);
  return next.status === "trialing"
    ? { ...sub, status: next.status, trialEndsAt: newEnd }
    : { ...sub, status: next.status, currentPeriodEnd: newEnd, ...(reopened ? { currentPeriodStart: now } : {}) };
}
