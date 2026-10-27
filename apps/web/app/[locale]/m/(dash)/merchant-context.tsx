"use client";

import { createContext, useContext } from "react";
import type { ShopState } from "@/components/seller-home";
import type { Me, SellerSummary, StoreDetails } from "@/lib/api";

export interface MerchantContextValue {
  me: Me;
  /** GET /store: the shop's details, plan and setup facts. */
  store: StoreDetails;
  /** Reads the shop again after something changed it (a product added, details saved). */
  refreshStore: () => Promise<void>;
  /** GET /orders/summary: the home page's numbers and the Orders badge; null until the first answer. Refreshed every minute. */
  summary: SellerSummary | null;
  /** Reads the numbers again now (after an order moved on). */
  refreshSummary: () => Promise<void>;
}

export const MerchantContext = createContext<MerchantContextValue | null>(null);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the shop stands, for the home page's pill and the sidebar's plan box: paused first, then payment due, then the trial's days left. */
export function shopStateOf(me: Me, store: StoreDetails, now = Date.now()): ShopState {
  const subscription = me.store?.subscription;
  if (store.paused || subscription?.status === "paused") return { kind: "paused" };
  if (subscription?.status === "grace") return { kind: "due" };
  if (subscription?.status === "trialing" && subscription.trialEndsAt) {
    return { kind: "trial", daysLeft: Math.max(0, Math.ceil((Date.parse(subscription.trialEndsAt) - now) / DAY_MS)) };
  }
  return { kind: "open" };
}

/** The signed-in merchant and their shop, loaded once by the dashboard layout. */
export function useMerchant(): MerchantContextValue {
  const value = useContext(MerchantContext);
  if (!value) throw new Error("useMerchant must be used inside the dashboard layout");
  return value;
}
