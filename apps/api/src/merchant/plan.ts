import type { Tx } from "@khmio/db";
import { effectivePlan, planHasFeature, type PlanFeature, type PlanId, type SubscriptionStatus } from "@khmio/shared";
import { AppException } from "../errors";

/**
 * The plan whose limits apply to this store right now (packages/shared
 * plans.ts), and whether the store may be changed at all. Read inside the
 * store's own context, so it's always this merchant's store.
 */
export async function storePlan(tx: Tx, storeId: string): Promise<{ plan: PlanId; paused: boolean }> {
  const [subscription, settings] = await Promise.all([
    tx.subscription.findUnique({ where: { storeId }, select: { plan: true, status: true } }),
    tx.platformSettings.findUnique({ where: { id: 1 }, select: { betaAllBasic: true } }),
  ]);
  return planInForce(subscription, settings);
}

/** No subscription row counts as Free; the beta switch lifts Free to Basic; only a paused subscription locks the store. */
export function planInForce(subscription: { plan: PlanId; status: SubscriptionStatus } | null, settings: { betaAllBasic: boolean } | null): { plan: PlanId; paused: boolean } {
  return {
    plan: effectivePlan(subscription?.plan ?? "free", settings?.betaAllBasic ?? false),
    paused: subscription?.status === "paused",
  };
}

/** A paused store keeps all its data, readable — but nothing can be changed until it pays (blueprint "Subscription life cycle"). */
export async function assertStoreWritable(tx: Tx, storeId: string): Promise<PlanId> {
  const { plan, paused } = await storePlan(tx, storeId);
  if (paused) throw new AppException(403, "store_paused");
  return plan;
}

/** A feature the plan in force doesn't include (packages/shared plans.ts) is refused here, not only hidden on screen. */
export function assertPlanFeature(plan: PlanId, feature: PlanFeature): void {
  if (!planHasFeature(plan, feature)) throw new AppException(403, "plan_limit");
}
