"use client";

import { approximateIn, canAddMore, computeOrderTotal, formatKhr, formatUsd, type Currency } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import type { CounterCartLine, CounterCartTotals } from "@/components/counter/counter-cart";
import { formatMoney } from "@/components/order-ui";
import type { Product, ProductVariant } from "@/lib/api";
import { variantStock } from "@/lib/shop-stock";

/** One product option's price in the sale's currency, after the product's discount — the same rule as the sale's total. */
export function salePrice(product: Product, variant: ProductVariant, currency: Currency, usdToKhrRate: number): number {
  const line = { key: variant.id, quantity: 1, priceUsdCents: variant.priceUsdCents, priceKhr: variant.priceKhr, discountPercent: product.discountPercent };
  return computeOrderTotal({ lines: [line], currency, usdToKhrRate, vatPercent: 0, deliveryFee: null }).total;
}

/**
 * The sale on screen (design/screens.md P1–P2), by the same rule the server
 * uses to save it (packages/shared computeOrderTotal; no delivery). Only a
 * preview: the server works it out again from the catalog.
 */
export function useCounterSale(
  products: Product[],
  quantities: Record<string, number>,
  currency: Currency,
  store: { usdToKhrRate: number; vatPercent: number },
  stock: Record<string, number>,
) {
  const t = useTranslations("Counter");
  const locale = useLocale();
  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);

  const picked = Object.entries(quantities).flatMap(([variantId, quantity]) => {
    const product = products.find((item) => item.variants.some((variant) => variant.id === variantId));
    const variant = product?.variants.find((item) => item.id === variantId);
    if (!product || !variant || quantity <= 0) return [];
    return [{ product, variant, quantity }];
  });
  const total = computeOrderTotal({
    lines: picked.map(({ product, variant, quantity }) => ({ key: variant.id, quantity, priceUsdCents: variant.priceUsdCents, priceKhr: variant.priceKhr, discountPercent: product.discountPercent })),
    currency,
    usdToKhrRate: store.usdToKhrRate,
    vatPercent: store.vatPercent,
    deliveryFee: null,
  });
  const approx = approximateIn(total.total, currency, store.usdToKhrRate);

  const lines: CounterCartLine[] = picked.map(({ product, variant, quantity }, index) => ({
    key: variant.id,
    title: text(product.titleKm, product.titleEn),
    option: product.hasOptions ? text(variant.labelKm, variant.labelEn) : undefined,
    quantity,
    lineTotal: formatMoney(total.lines[index]?.lineTotal ?? 0, currency),
    canIncrease: canAddMore(variantStock({ stock }, variant.id), quantity),
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
