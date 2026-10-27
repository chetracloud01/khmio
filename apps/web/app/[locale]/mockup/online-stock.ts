"use client";

import {
  getBuyerStockState,
  maxOrderQuantity,
  planHasFeature,
  type BuyerStockState,
  type PlanId,
  type StoreSettings,
} from "@khmio/shared";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  getStockLevel,
  parseLineKey,
  type MockBranch,
  type MockStockLocationType,
  type MockWarehouse,
} from "@/mock/mock-data";
import { useMerchantInventory } from "./merchant-inventory-context";
import { useShopProducts } from "./shop-products";
import { useMerchantSubscription } from "./merchant-subscription-context";
import { useStoreSettings } from "./store-settings-context";

export interface StockLocationRef {
  type: MockStockLocationType;
  id: string;
}

/**
 * The one location online orders take stock from. Advance can choose it in
 * Store settings; otherwise (and on Pro, which has one location) it's the
 * main branch — the first branch, or the first warehouse if there's no branch.
 */
export function resolveOnlineStockLocation(
  plan: PlanId,
  settings: Pick<StoreSettings, "onlineStockLocation">,
  warehouses: MockWarehouse[],
  branches: MockBranch[],
): StockLocationRef | undefined {
  const chosen = settings.onlineStockLocation;
  if (chosen && planHasFeature(plan, "warehouses")) {
    const exists =
      chosen.type === "branch"
        ? branches.some((branch) => branch.id === chosen.id)
        : warehouses.some((warehouse) => warehouse.id === chosen.id);
    if (exists) return chosen;
  }
  const mainBranch = branches[0];
  if (mainBranch) return { type: "branch", id: mainBranch.id };
  const mainWarehouse = warehouses[0];
  return mainWarehouse ? { type: "warehouse", id: mainWarehouse.id } : undefined;
}

/**
 * Stock as the buyer's shop sees it: sold out / only N left on Pro and
 * Advance, never limited on Free and Basic. The real API checks the same
 * thing again when it reserves stock at checkout (blueprint "Stock without
 * overselling"), so this is guidance for the buyer, not the only guard.
 */
export function useOnlineStock() {
  const { subscription, hydrated: subscriptionReady } = useMerchantSubscription();
  const { transactions, warehouses, branches, hydrated: inventoryReady } = useMerchantInventory();
  const { settings, hydrated: settingsReady } = useStoreSettings();
  const tracksStock = planHasFeature(subscription.plan, "stock");
  const location = resolveOnlineStockLocation(subscription.plan, settings, warehouses, branches);

  function stateFor(productId: string, variantId?: string): BuyerStockState {
    const onHand = location
      ? getStockLevel(transactions, { productId, variantId, locationType: location.type, locationId: location.id })
      : 0;
    return getBuyerStockState(tracksStock, onHand);
  }

  return {
    hydrated: subscriptionReady && inventoryReady && settingsReady,
    tracksStock,
    location,
    stateFor,
  };
}

/**
 * Stock can drop after something was put in the cart (another buyer, the
 * merchant's own correction), and the merchant can hide or delete a product.
 * Brings any line above what's left back down — removing sold-out lines and
 * lines the shop no longer sells — and reports that it did, so the buyer is told.
 */
export function useClampCartToStock(
  quantities: Record<string, number>,
  setQuantities: Dispatch<SetStateAction<Record<string, number>>>,
) {
  const { hydrated, stateFor } = useOnlineStock();
  const { hydrated: productsReady, isOnSale } = useShopProducts();
  const [adjusted, setAdjusted] = useState(false);

  useEffect(() => {
    if (!hydrated || !productsReady) return;
    const limits = Object.entries(quantities).flatMap(([key, qty]) => {
      if (qty === 0) return [];
      const { productId, variantId } = parseLineKey(key);
      if (!isOnSale(productId, variantId)) return [[key, 0] as const];
      const max = maxOrderQuantity(stateFor(productId, variantId));
      return max !== null && qty > max ? [[key, max] as const] : [];
    });
    if (limits.length === 0) return;
    setQuantities((prev) => {
      const next = { ...prev };
      for (const [key, max] of limits) next[key] = max;
      return next;
    });
    setAdjusted(true);
  }, [hydrated, productsReady, quantities, setQuantities, stateFor, isOnSale]);

  return { adjusted, dismiss: () => setAdjusted(false) };
}
