"use client";

import {
  computeOrderTotal,
  currencySchema,
  deliveryAreaSchema,
  fulfilmentSchema,
  MAX_LINE_QUANTITY,
  maxOrderQuantity,
  parseCartLineKey,
  pickChoices,
  type Currency,
  type OrderTotal,
} from "@khmio/shared";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import type { ChoiceGroup, Product, ProductVariant, PublicShop } from "./api";
import { variantStock } from "./shop-stock";
import { readStored, writeStored } from "./device-storage";

// The buyer's cart and details, kept on their phone (no buyer login). One
// cart per shop; the buyer's name, phone and address are kept only when they
// tick "Remember my details" (docs/blueprint.md "Buyer checkout"). The order
// itself is priced again by the API — these totals are for showing only.

const cartKey = (slug: string) => `khmio:cart:${slug}`;
const BUYER_KEY = "khmio:buyer";

const storedCartSchema = z.object({
  /** line key (packages/shared cartLineKey: the variant, or the variant with its choices) → how many. */
  quantities: z.record(z.number()),
  /** line key → the buyer's note on that item. */
  notes: z.record(z.string()).catch({}).default({}),
  currency: currencySchema.nullable().catch(null),
});
export type StoredCart = z.infer<typeof storedCartSchema>;

/** The cart for one shop. `ready` is false until it has been read from the phone. */
export function useShopCart(slug: string) {
  const [cart, setCart] = useState<StoredCart>({ quantities: {}, notes: {}, currency: null });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStored(cartKey(slug), storedCartSchema);
    if (stored) setCart(stored);
    setReady(true);
  }, [slug]);

  const update = useCallback(
    (change: (previous: StoredCart) => StoredCart) => {
      setCart((previous) => {
        const next = change(previous);
        writeStored(cartKey(slug), next);
        return next;
      });
    },
    [slug],
  );

  /** Sets how many of a line (a variant, or a variant with choices: cartLineKey) are in the cart; 0 removes it and its note. */
  const setQuantity = useCallback(
    (lineKey: string, quantity: number) =>
      update((previous) => {
        const quantities = { ...previous.quantities };
        const notes = { ...previous.notes };
        const clamped = Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.round(quantity)));
        if (clamped === 0) {
          delete quantities[lineKey];
          delete notes[lineKey];
        } else quantities[lineKey] = clamped;
        return { ...previous, quantities, notes };
      }),
    [update],
  );

  /** Adds to a line (from the product sheet), with the buyer's note if they wrote one. */
  const addLine = useCallback(
    (lineKey: string, quantity: number, note: string) =>
      update((previous) => ({
        ...previous,
        quantities: { ...previous.quantities, [lineKey]: Math.min(MAX_LINE_QUANTITY, (previous.quantities[lineKey] ?? 0) + quantity) },
        notes: note.trim() ? { ...previous.notes, [lineKey]: note.trim() } : previous.notes,
      })),
    [update],
  );

  const setCurrency = useCallback((currency: Currency) => update((previous) => ({ ...previous, currency })), [update]);
  const clear = useCallback(() => update((previous) => ({ ...previous, quantities: {}, notes: {} })), [update]);
  /** Swaps in quantities already checked against the shop (fitCartToShop). */
  const replaceQuantities = useCallback((quantities: Record<string, number>) => update((previous) => ({ ...previous, quantities })), [update]);

  return { ready, quantities: cart.quantities, notes: cart.notes, currency: cart.currency, setQuantity, addLine, setCurrency, clear, replaceQuantities };
}

/** How many of one variant the cart holds, whatever choices each line has (stock counts them together). */
export function variantQuantity(quantities: Record<string, number>, variantId: string): number {
  return Object.entries(quantities).reduce((sum, [key, quantity]) => (parseCartLineKey(key).variantId === variantId ? sum + quantity : sum), 0);
}

/**
 * "Order again": puts an earlier order's options back in that shop's cart, on
 * top of what's there. The cart page then drops anything the shop no longer
 * sells and works out today's prices.
 */
export function addToShopCart(slug: string, lines: { variantId: string; quantity: number }[]) {
  const stored = readStored(cartKey(slug), storedCartSchema);
  const quantities = { ...stored?.quantities };
  for (const line of lines) quantities[line.variantId] = Math.min(MAX_LINE_QUANTITY, (quantities[line.variantId] ?? 0) + line.quantity);
  writeStored(cartKey(slug), { quantities, notes: stored?.notes ?? {}, currency: stored?.currency ?? null });
}

export interface CartLine {
  /** cartLineKey: the variant, with its choices if any. */
  key: string;
  product: Product;
  variant: ProductVariant;
  /** The choices picked, in the product's own order. */
  choices: { group: ChoiceGroup; value: ChoiceGroup["values"][number] }[];
  choiceIds: string[];
  quantity: number;
  note: string;
}

/** A cart line's choices if they're all still offered and fit the product's rules; null = the line can't be sold as it is. */
function lineChoices(product: { choiceGroups?: ChoiceGroup[] }, choiceIds: string[]): CartLine["choices"] | null {
  const groups = product.choiceGroups ?? [];
  const picked = pickChoices(groups, choiceIds);
  return picked.ok ? picked.picked.map(({ group, value }) => ({ group: groups.find((entry) => entry.id === group.id) ?? group, value })) : null;
}

/** The cart's lines, in the shop's product order, for what the shop still sells as it is. */
export function cartLines(shop: PublicShop, quantities: Record<string, number>, notes: Record<string, string> = {}): CartLine[] {
  const keys = Object.keys(quantities).map((key) => ({ key, ...parseCartLineKey(key) }));
  return shop.products.flatMap((product) =>
    product.variants.flatMap((variant) =>
      keys.flatMap(({ key, variantId, choiceIds }) => {
        const quantity = quantities[key] ?? 0;
        const choices = variantId === variant.id && quantity > 0 ? lineChoices(product, choiceIds) : null;
        return choices ? [{ key, product, variant, choices, choiceIds, quantity, note: notes[key] ?? "" }] : [];
      }),
    ),
  );
}

/**
 * The cart as the shop can sell it now: options no longer sold (hidden,
 * deleted, removed) and choices no longer offered taken out, and tracked
 * ones cut to the stock left — all lines of one variant together (sold out =
 * taken out). `changed` says whether the buyer should be told.
 */
export function fitCartToShop(
  shop: { products: { variants: { id: string }[]; choiceGroups?: ChoiceGroup[] }[]; stock: PublicShop["stock"] },
  quantities: Record<string, number>,
): { quantities: Record<string, number>; changed: boolean } {
  const productOf = new Map(shop.products.flatMap((product) => product.variants.map((variant) => [variant.id, product] as const)));
  const left = new Map<string, number | null>();
  const fitted = Object.fromEntries(
    Object.entries(quantities).flatMap(([key, quantity]) => {
      const { variantId, choiceIds } = parseCartLineKey(key);
      const product = productOf.get(variantId);
      if (!product || !lineChoices(product, choiceIds)) return [];
      if (!left.has(variantId)) left.set(variantId, maxOrderQuantity(variantStock(shop, variantId)));
      const max = left.get(variantId) ?? null;
      const kept = max === null ? quantity : Math.min(quantity, max);
      if (max !== null) left.set(variantId, max - kept);
      return kept > 0 ? [[key, kept]] : [];
    }),
  );
  const changed = Object.keys(quantities).length !== Object.keys(fitted).length || Object.entries(fitted).some(([key, quantity]) => quantities[key] !== quantity);
  return { quantities: fitted, changed };
}

/**
 * Keeps a shop's cart sellable while its page is open (cart, checkout): what
 * changed is put right at once, and `adjusted` turns on so the page can say so.
 */
export function useCartFitsShop(shop: PublicShop | null, cart: ReturnType<typeof useShopCart>): boolean {
  const [adjusted, setAdjusted] = useState(false);
  const { ready, quantities, replaceQuantities } = cart;
  useEffect(() => {
    if (!shop || !ready) return;
    const fitted = fitCartToShop(shop, quantities);
    if (fitted.changed) {
      replaceQuantities(fitted.quantities);
      setAdjusted(true);
    }
  }, [shop, ready, quantities, replaceQuantities]);
  return adjusted;
}

/** The same total the API will charge (packages/shared computeOrderTotal), for showing before the order is placed. */
export function cartTotal(shop: PublicShop, lines: CartLine[], currency: Currency, deliveryFee: Parameters<typeof computeOrderTotal>[0]["deliveryFee"]): OrderTotal {
  return computeOrderTotal({
    lines: lines.map((line) => ({
      key: line.key,
      quantity: line.quantity,
      priceUsdCents: line.variant.priceUsdCents,
      priceKhr: line.variant.priceKhr,
      discountPercent: line.product.discountPercent,
      extras: line.choices.map(({ value }) => ({ priceUsdCents: value.extraUsdCents, priceKhr: value.extraKhr })),
    })),
    currency,
    usdToKhrRate: shop.store.usdToKhrRate,
    vatPercent: shop.store.vatPercent,
    deliveryFee,
  });
}

/** Each field falls back on its own, so details kept by an older version still fill in what they can. */
const text = z.string().catch("");
const buyerDetailsSchema = z.object({
  name: text,
  phone: text,
  fulfilment: fulfilmentSchema.catch("delivery"),
  area: deliveryAreaSchema.catch("phnom_penh"),
  districtId: text,
  provinceId: text,
  landmark: text,
});
export type BuyerDetails = z.infer<typeof buyerDetailsSchema>;

const EMPTY_BUYER: BuyerDetails = { name: "", phone: "", fulfilment: "delivery", area: "phnom_penh", districtId: "", provinceId: "", landmark: "" };

/** The buyer's details from their last order on this phone, if they asked us to remember them. */
export function readBuyerDetails(): { details: BuyerDetails; remembered: boolean } {
  const stored = readStored(BUYER_KEY, buyerDetailsSchema);
  return stored ? { details: stored, remembered: true } : { details: EMPTY_BUYER, remembered: false };
}

/** Keeps the details for next time, or forgets them when the buyer unticked "Remember". */
export function saveBuyerDetails(details: BuyerDetails, remember: boolean) {
  writeStored(BUYER_KEY, remember ? details : null);
}
