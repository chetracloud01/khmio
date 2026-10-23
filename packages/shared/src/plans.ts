import { z } from "zod";
import type { Currency } from "./money";

// The single source of truth for what each subscription plan allows.
// The dashboard, API, storefront and admin panel all read from here — see
// docs/blueprint.md "Subscription tiers".

export const planIdSchema = z.enum(["free", "basic", "pro", "advance"]);
export type PlanId = z.infer<typeof planIdSchema>;

/** Lowest to highest — used to tell an upgrade from a downgrade. */
export const PLAN_ORDER: readonly PlanId[] = planIdSchema.options;

export const subscriptionStatusSchema = z.enum(["trialing", "active", "grace", "paused"]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export type PlanFeature = "stock" | "wholesalePrice" | "warehouses";

export interface PlanDefinition {
  id: PlanId;
  /** Fixed per currency by the platform, never converted at runtime. */
  monthlyPrice: { usdCents: number; khr: number };
  /** null = unlimited. */
  maxProducts: number | null;
  /** Only the Free plan is time-limited. */
  trialDays: number | null;
  features: Record<PlanFeature, boolean>;
}

/** A new shop's Free trial: every shop starts on it (apps/api create-store.ts). */
export const FREE_TRIAL_DAYS = 14;

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    monthlyPrice: { usdCents: 0, khr: 0 },
    maxProducts: 10,
    trialDays: FREE_TRIAL_DAYS,
    features: { stock: false, wholesalePrice: false, warehouses: false },
  },
  basic: {
    id: "basic",
    monthlyPrice: { usdCents: 500, khr: 20000 },
    maxProducts: null,
    trialDays: null,
    features: { stock: false, wholesalePrice: false, warehouses: false },
  },
  pro: {
    id: "pro",
    monthlyPrice: { usdCents: 1200, khr: 48000 },
    maxProducts: null,
    trialDays: null,
    features: { stock: true, wholesalePrice: true, warehouses: false },
  },
  advance: {
    id: "advance",
    monthlyPrice: { usdCents: 2900, khr: 116000 },
    maxProducts: null,
    trialDays: null,
    features: { stock: true, wholesalePrice: true, warehouses: true },
  },
};

export const BILLING_PERIOD_DAYS = 30;
export const GRACE_PERIOD_DAYS = 7;
/** An invoice is created this many days before the current period ends. */
export const INVOICE_LEAD_DAYS = 7;

export function planHasFeature(plan: PlanId, feature: PlanFeature): boolean {
  return PLANS[plan].features[feature];
}

/** The cheapest plan that includes a feature — what an upgrade prompt should offer. */
export function getMinimumPlanFor(feature: PlanFeature): PlanId {
  const plan = PLAN_ORDER.find((id) => PLANS[id].features[feature]);
  if (!plan) throw new Error(`No plan includes ${feature}`);
  return plan;
}

/**
 * The plan whose features and limits apply. During the Release 1 beta the
 * platform setting "every shop counts as Basic" is on, so a Free trial shop
 * gets Basic's limits; it is switched off at Release 2, when billing starts.
 */
export function effectivePlan(plan: PlanId, betaAllBasic: boolean): PlanId {
  return betaAllBasic && plan === "free" ? "basic" : plan;
}

export function canAddProduct(plan: PlanId, currentProductCount: number): boolean {
  const max = PLANS[plan].maxProducts;
  return max === null || currentProductCount < max;
}

/** The cheapest plan with room for one more product. */
export function getMinimumPlanForProductCount(currentProductCount: number): PlanId {
  const plan = PLAN_ORDER.find((id) => canAddProduct(id, currentProductCount));
  if (!plan) throw new Error("No plan allows more products");
  return plan;
}

export function getPlanPrice(plan: PlanId, currency: Currency): number {
  const price = PLANS[plan].monthlyPrice;
  return currency === "USD" ? price.usdCents : price.khr;
}

export function isUpgrade(from: PlanId, to: PlanId): boolean {
  return PLAN_ORDER.indexOf(to) > PLAN_ORDER.indexOf(from);
}

/** Paid stores can't go back to Free, and Free can't be restarted. */
export function canChangePlan(from: PlanId, to: PlanId): boolean {
  return from !== to && to !== "free";
}

export interface SubscriptionState {
  plan: PlanId;
  status: SubscriptionStatus;
  /** Trial days left, days left in the paid period, or grace days left. 0 when paused. */
  daysLeft: number;
}

/** Super-admin changes. No invoice is created; every one is written to audit_logs. */
export type AdminOverride = { kind: "setPlan"; plan: PlanId } | { kind: "extend"; days: number };

export const MAX_ADMIN_EXTENSION_DAYS = 365;

/**
 * - setPlan: paid plans only (Free is a one-time trial). A trialing or paused
 *   store starts a fresh period on the new plan; an active or overdue store
 *   keeps its current period and status.
 * - extend: adds days. A paused or overdue store reopens for exactly those days.
 */
export function applyAdminOverride(state: SubscriptionState, override: AdminOverride): SubscriptionState {
  if (override.kind === "setPlan") {
    if (override.plan === "free") throw new RangeError("Admins can't move a store to Free");
    if (override.plan === state.plan) return state;
    if (state.status === "trialing" || state.status === "paused") {
      return { plan: override.plan, status: "active", daysLeft: BILLING_PERIOD_DAYS };
    }
    return { ...state, plan: override.plan };
  }

  const { days } = override;
  if (!Number.isInteger(days) || days < 1 || days > MAX_ADMIN_EXTENSION_DAYS) {
    throw new RangeError(`days must be a whole number from 1 to ${MAX_ADMIN_EXTENSION_DAYS}`);
  }
  if (state.status === "paused" || state.status === "grace") {
    return { ...state, status: state.plan === "free" ? "trialing" : "active", daysLeft: days };
  }
  return { ...state, daysLeft: state.daysLeft + days };
}

/** A paused store's shop link shows "temporarily closed" to buyers. */
export function isStorefrontOpen(status: SubscriptionStatus): boolean {
  return status !== "paused";
}

/**
 * What the merchant pays now to upgrade mid-period: the price difference for
 * the days left, rounded to a whole cent or riel. Downgrades wait for the
 * period to end, so they cost nothing now.
 */
export function getUpgradeProrationAmount(
  from: PlanId,
  to: PlanId,
  currency: Currency,
  daysLeft: number,
): number {
  if (!Number.isInteger(daysLeft) || daysLeft < 0 || daysLeft > BILLING_PERIOD_DAYS) {
    throw new RangeError(`daysLeft must be a whole number from 0 to ${BILLING_PERIOD_DAYS}`);
  }
  if (!isUpgrade(from, to)) return 0;
  const difference = getPlanPrice(to, currency) - getPlanPrice(from, currency);
  return Math.round((difference * daysLeft) / BILLING_PERIOD_DAYS);
}

/**
 * What the merchant must pay now to change plan. Leaving the Free trial has
 * no paid period to prorate against, so it's the full month and a new
 * 30-day period starts once paid.
 */
export function getAmountDueForPlanChange(
  from: PlanId,
  to: PlanId,
  currency: Currency,
  daysLeft: number,
): number {
  if (!canChangePlan(from, to)) return 0;
  if (from === "free") return getPlanPrice(to, currency);
  return getUpgradeProrationAmount(from, to, currency, daysLeft);
}
