"use client";

import { computeOrderTotal, MAX_LINE_QUANTITY, type Currency, type DeliveryArea, type Fulfilment, type OrderTotal } from "@khmio/shared";
import { useCallback, useEffect, useState } from "react";
import type { Product, ProductVariant, PublicShop } from "./api";

// The buyer's cart and details, kept on their phone (no buyer login). One
// cart per shop; the buyer's name, phone and address are kept only when they
// tick "Remember my details" (docs/blueprint.md "Buyer checkout"). The order
// itself is priced again by the API — these totals are for showing only.

const cartKey = (slug: string) => `khmio:cart:${slug}`;
const BUYER_KEY = "khmio:buyer";

export interface StoredCart {
  /** variant id → how many. */
  quantities: Record<string, number>;
  currency: Currency | null;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable (private browsing): the cart just lives for this page.
  }
}

/** The cart for one shop. `ready` is false until it has been read from the phone. */
export function useShopCart(slug: string) {
  const [cart, setCart] = useState<StoredCart>({ quantities: {}, currency: null });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readJson<StoredCart>(cartKey(slug));
    if (stored && typeof stored.quantities === "object") setCart({ quantities: stored.quantities, currency: stored.currency ?? null });
    setReady(true);
  }, [slug]);

  const update = useCallback(
    (change: (previous: StoredCart) => StoredCart) => {
      setCart((previous) => {
        const next = change(previous);
        writeJson(cartKey(slug), next);
        return next;
      });
    },
    [slug],
  );

  /** Sets how many of a variant are in the cart; 0 removes it. */
  const setQuantity = useCallback(
    (variantId: string, quantity: number) =>
      update((previous) => {
        const quantities = { ...previous.quantities };
        const clamped = Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.round(quantity)));
        if (clamped === 0) delete quantities[variantId];
        else quantities[variantId] = clamped;
        return { ...previous, quantities };
      }),
    [update],
  );

  const setCurrency = useCallback((currency: Currency) => update((previous) => ({ ...previous, currency })), [update]);
  const clear = useCallback(() => update((previous) => ({ ...previous, quantities: {} })), [update]);
  /** Drops lines the shop no longer sells (hidden, deleted, or the option removed). */
  const keepOnly = useCallback(
    (variantIds: Set<string>) =>
      update((previous) => ({ ...previous, quantities: Object.fromEntries(Object.entries(previous.quantities).filter(([id]) => variantIds.has(id))) })),
    [update],
  );

  return { ready, quantities: cart.quantities, currency: cart.currency, setQuantity, setCurrency, clear, keepOnly };
}

/**
 * "Order again": puts an earlier order's options back in that shop's cart, on
 * top of what's there. The cart page then drops anything the shop no longer
 * sells and works out today's prices.
 */
export function addToShopCart(slug: string, lines: { variantId: string; quantity: number }[]) {
  const stored = readJson<StoredCart>(cartKey(slug));
  const quantities = { ...(stored && typeof stored.quantities === "object" ? stored.quantities : {}) };
  for (const line of lines) quantities[line.variantId] = Math.min(MAX_LINE_QUANTITY, (quantities[line.variantId] ?? 0) + line.quantity);
  writeJson(cartKey(slug), { quantities, currency: stored?.currency ?? null });
}

export interface CartLine {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

/** The cart's lines, in the shop's product order, for the variants the shop still sells. */
export function cartLines(shop: PublicShop, quantities: Record<string, number>): CartLine[] {
  return shop.products.flatMap((product) =>
    product.variants.flatMap((variant) => {
      const quantity = quantities[variant.id] ?? 0;
      return quantity > 0 ? [{ product, variant, quantity }] : [];
    }),
  );
}

/** Every variant id the shop sells right now — to spot cart lines that are gone. */
export function sellableVariantIds(shop: PublicShop): Set<string> {
  return new Set(shop.products.flatMap((product) => product.variants.map((variant) => variant.id)));
}

/** The same total the API will charge (packages/shared computeOrderTotal), for showing before the order is placed. */
export function cartTotal(shop: PublicShop, lines: CartLine[], currency: Currency, deliveryFee: Parameters<typeof computeOrderTotal>[0]["deliveryFee"]): OrderTotal {
  return computeOrderTotal({
    lines: lines.map((line) => ({
      key: line.variant.id,
      quantity: line.quantity,
      priceUsdCents: line.variant.priceUsdCents,
      priceKhr: line.variant.priceKhr,
      discountPercent: line.product.discountPercent,
    })),
    currency,
    usdToKhrRate: shop.store.usdToKhrRate,
    vatPercent: shop.store.vatPercent,
    deliveryFee,
  });
}

export interface BuyerDetails {
  name: string;
  phone: string;
  fulfilment: Fulfilment;
  area: DeliveryArea;
  districtId: string;
  provinceId: string;
  landmark: string;
}

const EMPTY_BUYER: BuyerDetails = { name: "", phone: "", fulfilment: "delivery", area: "phnom_penh", districtId: "", provinceId: "", landmark: "" };

/** The buyer's details from their last order on this phone, if they asked us to remember them. */
export function readBuyerDetails(): { details: BuyerDetails; remembered: boolean } {
  const stored = readJson<Partial<BuyerDetails>>(BUYER_KEY);
  if (!stored) return { details: EMPTY_BUYER, remembered: false };
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    details: {
      name: text(stored.name),
      phone: text(stored.phone),
      fulfilment: stored.fulfilment === "pickup" ? "pickup" : "delivery",
      area: stored.area === "province" ? "province" : "phnom_penh",
      districtId: text(stored.districtId),
      provinceId: text(stored.provinceId),
      landmark: text(stored.landmark),
    },
    remembered: true,
  };
}

/** Keeps the details for next time, or forgets them when the buyer unticked "Remember". */
export function saveBuyerDetails(details: BuyerDetails, remember: boolean) {
  writeJson(BUYER_KEY, remember ? details : null);
}
