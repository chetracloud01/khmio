"use client";

import { canShareShop, getMissingForSharing, type BusinessType, type ShopReadinessFacts } from "@khmio/shared";
import { mockBusinessTypeDefaults, mockUoms } from "@/mock/mock-data";
import { useCart } from "./cart-context";
import { useDeliverySettings } from "./delivery-settings-context";
import { useMerchantInventory } from "./merchant-inventory-context";
import { useMerchantProducts } from "./merchant-products-context";
import { useMerchantProfile } from "./merchant-profile-context";
import { useOrders } from "./orders-context";
import { useStorePayments, useStoreSettings } from "./store-settings-context";

/**
 * Wipes the sample shop's data when a seller finishes onboarding, so their
 * shop starts empty — no coffee products, sample orders or other people's
 * drivers. The sample shop is only for demos before anyone has onboarded.
 */
export function useStartNewShop() {
  const products = useMerchantProducts();
  const inventory = useMerchantInventory();
  const orders = useOrders();
  const delivery = useDeliverySettings();
  const store = useStoreSettings();
  const { clearCart } = useCart();

  return (businessType: BusinessType) => {
    // Every unit stays on offer; the product form picks the business type's own (mockBusinessTypeDefaults.uomId) first.
    products.startNewShop({ categories: mockBusinessTypeDefaults[businessType].categories, uoms: mockUoms });
    inventory.startNewShop();
    orders.startNewShop();
    delivery.startNewShop();
    store.startNewShop();
    clearCart();
  };
}

/** The facts packages/shared needs to say whether the shop link can be shared yet. */
export function useShopReadiness() {
  const { products } = useMerchantProducts();
  const profile = useMerchantProfile();
  const { configured } = useDeliverySettings();
  const { settings } = useStoreSettings();
  const { khqrReady } = useStorePayments();
  const visible = products.filter((product) => !product.isHidden);
  const facts: ShopReadinessFacts = {
    businessType: profile.businessType,
    visibleProducts: visible.length,
    productsWithPhoto: visible.filter((product) => (product.photoDataUrls?.length ?? 0) > 0).length,
    shopPhone: profile.phone,
    deliveryConfigured: configured,
    khqrReady: profile.hasProfile && khqrReady,
    codEnabled: settings.allowCod,
  };
  return { facts, missing: getMissingForSharing(facts), ready: canShareShop(facts) };
}
