"use client";

import {
  applyAdminOverride,
  BILLING_PERIOD_DAYS,
  canChangePlan,
  getAmountDueForPlanChange,
  getPlanPrice,
  isUpgrade,
  type AdminOverride,
  type Currency,
  type PlanId,
} from "@khmio/shared";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { mockSubscription, type MockSubscription, type MockSubscriptionInvoice } from "@/mock/mock-data";

/** Dev-only previews of each life-cycle state, so every banner can be reviewed. */
export type SubscriptionPreview = "trial" | "active" | "grace" | "paused";

interface MerchantSubscriptionContextValue {
  hydrated: boolean;
  subscription: MockSubscription;
  setBillingCurrency: (currency: Currency) => void;
  /** Upgrades bill now (and apply now, except leaving Free, which applies once paid); downgrades wait for period end. */
  changePlan: (to: PlanId) => void;
  cancelPendingDowngrade: () => void;
  payInvoice: (invoiceId: string) => void;
  preview: (state: SubscriptionPreview) => void;
  /** Super-admin change from the admin panel — no invoice, same rules as every other store. */
  applyAdminChange: (override: AdminOverride) => void;
}

const MerchantSubscriptionContext = createContext<MerchantSubscriptionContextValue | null>(null);

// Switching locale changes the [locale] URL segment, which remounts this
// provider — localStorage is what survives that (and a page refresh).
const STORAGE_KEY = "khmio:mockup-merchant-subscription";

let invoiceCounter = 0;
function newInvoice(
  plan: PlanId,
  reason: MockSubscriptionInvoice["reason"],
  currency: Currency,
  amountMinor: number,
): MockSubscriptionInvoice {
  invoiceCounter += 1;
  return { id: `inv-${Date.now()}-${invoiceCounter}`, plan, reason, currency, amountMinor, status: "open", createdDaysAgo: 0 };
}

function withOpenRenewal(sub: MockSubscription): MockSubscriptionInvoice[] {
  if (sub.invoices.some((invoice) => invoice.status === "open")) return sub.invoices;
  const renewal = newInvoice(sub.plan, "renewal", sub.billingCurrency, getPlanPrice(sub.plan, sub.billingCurrency));
  return [renewal, ...sub.invoices];
}

export function MerchantSubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<MockSubscription>(mockSubscription);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSubscription({ ...mockSubscription, ...(JSON.parse(raw) as Partial<MockSubscription>) });
    } catch {
      // Corrupt or inaccessible storage (e.g. private browsing) — keep the seed default.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subscription));
    } catch {
      // Storage full or unavailable — changes just won't persist this time.
    }
  }, [subscription, hydrated]);

  function setBillingCurrency(currency: Currency) {
    setSubscription((prev) => ({ ...prev, billingCurrency: currency }));
  }

  function changePlan(to: PlanId) {
    setSubscription((prev) => {
      if (!canChangePlan(prev.plan, to)) return prev;
      const currency = prev.billingCurrency;

      if (prev.plan === "free") {
        // Plan starts once paid — replace any earlier unpaid "new plan" invoice.
        const others = prev.invoices.filter((invoice) => !(invoice.reason === "new" && invoice.status === "open"));
        const due = getAmountDueForPlanChange(prev.plan, to, currency, prev.daysLeft);
        return { ...prev, invoices: [newInvoice(to, "new", currency, due), ...others] };
      }

      if (!isUpgrade(prev.plan, to)) return { ...prev, pendingPlan: to };

      const due = getAmountDueForPlanChange(prev.plan, to, currency, prev.daysLeft);
      const invoices = due > 0 ? [newInvoice(to, "upgrade", currency, due), ...prev.invoices] : prev.invoices;
      return { ...prev, plan: to, pendingPlan: null, invoices };
    });
  }

  function cancelPendingDowngrade() {
    setSubscription((prev) => ({ ...prev, pendingPlan: null }));
  }

  function payInvoice(invoiceId: string) {
    setSubscription((prev) => {
      const invoice = prev.invoices.find((item) => item.id === invoiceId);
      if (!invoice || invoice.status === "paid") return prev;
      const invoices = prev.invoices.map((item) => (item.id === invoiceId ? { ...item, status: "paid" as const } : item));
      const stillOwing = invoices.some((item) => item.status === "open");

      if (invoice.reason === "new") {
        return { ...prev, invoices, plan: invoice.plan, status: "active", daysLeft: BILLING_PERIOD_DAYS, pendingPlan: null };
      }
      if ((prev.status === "grace" || prev.status === "paused") && !stillOwing) {
        return { ...prev, invoices, status: "active", daysLeft: BILLING_PERIOD_DAYS };
      }
      return { ...prev, invoices };
    });
  }

  function applyAdminChange(override: AdminOverride) {
    setSubscription((prev) => {
      const next = applyAdminOverride({ plan: prev.plan, status: prev.status, daysLeft: prev.daysLeft }, override);
      return { ...prev, ...next, pendingPlan: override.kind === "setPlan" ? null : prev.pendingPlan };
    });
  }

  function preview(state: SubscriptionPreview) {
    setSubscription((prev) => {
      const paidPlan: PlanId = prev.plan === "free" ? "pro" : prev.plan;
      if (state === "trial") return { ...prev, plan: "free", status: "trialing", daysLeft: 9, pendingPlan: null };
      if (state === "active") return { ...prev, plan: paidPlan, status: "active", daysLeft: 18 };
      if (state === "grace") {
        const next = { ...prev, plan: paidPlan, status: "grace" as const, daysLeft: 5 };
        return { ...next, invoices: withOpenRenewal(next) };
      }
      const paused = { ...prev, status: "paused" as const, daysLeft: 0 };
      return prev.plan === "free" ? paused : { ...paused, invoices: withOpenRenewal(paused) };
    });
  }

  return (
    <MerchantSubscriptionContext.Provider
      value={{
        hydrated,
        subscription,
        setBillingCurrency,
        changePlan,
        cancelPendingDowngrade,
        payInvoice,
        preview,
        applyAdminChange,
      }}
    >
      {children}
    </MerchantSubscriptionContext.Provider>
  );
}

export function useMerchantSubscription(): MerchantSubscriptionContextValue {
  const ctx = useContext(MerchantSubscriptionContext);
  if (!ctx) throw new Error("useMerchantSubscription must be used within a MerchantSubscriptionProvider");
  return ctx;
}
