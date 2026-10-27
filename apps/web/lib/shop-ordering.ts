import { getAvailablePaymentMethods, type DeliveryArea, type Fulfilment, type PaymentMethod } from "@khmio/shared";
import type { PublicShop } from "./api";

// Whether a shop takes orders, and which ways to pay fit a buyer's choice —
// the same rules the API checks when the order is placed (apps/api
// orders/place-order.ts), so the shop page never offers what will be refused.

/** Delivery saved at least once, and at least one way to pay at all. */
export function isTakingOrders(shop: PublicShop): boolean {
  // A paused shop takes no orders (its page shows "temporarily closed").
  return shop.open && shop.ordering.deliveryConfigured && (shop.store.allowCod || shop.ordering.khqrReady);
}

/** The payment methods for this buyer's area and delivery/pickup choice (packages/shared getAvailablePaymentMethods). */
export function paymentMethodsFor(shop: PublicShop, area: DeliveryArea, fulfilment: Fulfilment): PaymentMethod[] {
  return getAvailablePaymentMethods({ khqrReady: shop.ordering.khqrReady, payWayReady: false, storeAllowsCod: shop.store.allowCod, area, fulfilment });
}
