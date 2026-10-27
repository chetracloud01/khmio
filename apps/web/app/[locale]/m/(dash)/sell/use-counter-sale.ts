"use client";

import { approximateIn, canAddMore, computeOrderTotal, formatKhr, formatUsd, parseCartLineKey, pickChoices, type Currency } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import type { CounterCartLine, CounterCartTotals } from "@/components/counter/counter-cart";
import { formatMoney } from "@/components/order-ui";
import type { Product, ProductVariant } from "@/lib/api";
import { variantQuantity } from "@/lib/cart";
import { variantStock } from "@/lib/shop-stock";

/** One product option's price in the sale's currency, after the product's discount — the same rule as the sale's total. */
export function salePrice(product: Product, variant: ProductVariant, currency: Currency, usdToKhrRate: number): number {
  const line = { key: variant.id, quantity: 1, priceUsdCents: variant.priceUsdCents, priceKhr: variant.priceKhr, discountPercent: product.discountPercent };
  return computeOrderTotal({ lines: [line], currency, usdToKhrRate, vatPercent: 0, deliveryFee: null }).total;
}

/** The sale's lines as the API takes them: each option with its choices and note (keys are packages/shared cartLineKey). */
export function saleRequestLines(quantities: Record<string, number>, notes: Record<string, string>) {
  return Object.entries(quantities).map(([key, quantity]) => ({ ...parseCartLineKey(key), quantity, note: notes[key] ?? "" }));
}

/**
 * The sale on screen (design/screens.md P1–P2), by the same rule the server
 * uses to save it (packages/shared computeOrderTotal; no delivery). Only a
 * preview: the server works it out again from the catalog. Lines are keyed
 * like the shop's cart: an option, or an option with its choices.
 */
export function useCounterSale(
  products: Product[],
  quantities: Record<string, number>,
  notes: Record<string, string>,
  currency: Currency,
  store: { usdToKhrRate: number; vatPercent: number },
  stock: Record<string, number>,
) {
  const t = useTranslations("Counter");
  const locale = useLocale();
  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);

  const picked = Object.entries(quantities).flatMap(([key, quantity]) => {
    const { variantId, choiceIds } = parseCartLineKey(key);
    const product = products.find((item) => item.variants.some((variant) => variant.id === variantId));
    const variant = product?.variants.find((item) => item.id === variantId);
    const choices = product ? pickChoices(product.choiceGroups, choiceIds) : null;
    if (!product || !variant || !choices?.ok || quantity <= 0) return [];
    return [{ key, product, variant, choices: choices.picked.map(({ value }) => value), quantity }];
  });
  const total = computeOrderTotal({
    lines: picked.map(({ key, product, variant, choices, quantity }) => ({
      key,
      quantity,
      priceUsdCents: variant.priceUsdCents,
      priceKhr: variant.priceKhr,
      discountPercent: product.discountPercent,
      extras: choices.map((value) => ({ priceUsdCents: value.extraUsdCents, priceKhr: value.extraKhr })),
    })),
    currency,
    usdToKhrRate: store.usdToKhrRate,
    vatPercent: store.vatPercent,
    deliveryFee: null,
  });
  const approx = approximateIn(total.total, currency, store.usdToKhrRate);

  const lines: CounterCartLine[] = picked.map(({ key, product, variant, choices, quantity }, index) => ({
    key,
    title: text(product.titleKm, product.titleEn),
    // The option, then the choices and the note, on the line under the name.
    option: [product.hasOptions ? text(variant.labelKm, variant.labelEn) : "", ...choices.map((value) => text(value.labelKm, value.labelEn)), notes[key] ? `“${notes[key]}”` : ""].filter(Boolean).join(" · ") || undefined,
    quantity,
    lineTotal: formatMoney(total.lines[index]?.lineTotal ?? 0, currency),
    // Stock counts every line of this option together, whatever its choices.
    canIncrease: canAddMore(variantStock({ stock }, variant.id), variantQuantity(quantities, variant.id)),
  }));
  const totals: CounterCartTotals = {
    subtotal: formatMoney(total.subtotal, currency),
    discount: total.discount > 0 ? `−${formatMoney(total.discount, currency)}` : undefined,
    vat: store.vatPercent > 0 ? { label: t("vat", { percent: store.vatPercent }), amount: formatMoney(total.vat, currency) } : undefined,
    total: formatMoney(total.total, currency),
    approx: `≈ ${currency === "USD" ? formatKhr(approx) : formatUsd(approx)}`,
  };
  return { total, lines, totals };
}
