"use client";

import { approximateIn, computeOrderTotal, type Currency, type OrderLineInput } from "@khmio/shared";
import { useLocale } from "next-intl";
import { getUnitKhr, getUnitUsdCents, parseLineKey } from "@/mock/mock-data";
import { useShopProducts } from "../../shop-products";
import { useStoreSettings } from "../../store-settings-context";

/**
 * The sale at the counter in its one currency, by the same rule as online
 * checkout (packages/shared computeOrderTotal: each line rounded, then
 * summed; VAT on the goods; no delivery). Lines whose product was hidden or
 * deleted meanwhile drop out.
 */
export function useCounterTotal(quantities: Record<string, number>, currency: Currency) {
  const locale = useLocale();
  const { products } = useShopProducts();
  const { settings, rate } = useStoreSettings();

  const picked = Object.entries(quantities).flatMap(([key, quantity]) => {
    if (quantity <= 0) return [];
    const { productId, variantId } = parseLineKey(key);
    const product = products.find((item) => item.id === productId);
    const variant = variantId ? product?.variants?.find((item) => item.id === variantId) : undefined;
    if (!product || (variantId && !variant)) return [];
    const input: OrderLineInput = {
      key,
      quantity,
      priceUsdCents: getUnitUsdCents(product, variant) ?? null,
      priceKhr: getUnitKhr(product, variant) ?? null,
      discountPercent: product.discountPercent ?? null,
    };
    const title = locale === "km" ? product.titleKm : product.titleEn;
    const option = variant ? (locale === "km" ? variant.labelKm : variant.labelEn) : undefined;
    return [{ input, title, option }];
  });

  const total = computeOrderTotal({ lines: picked.map((line) => line.input), currency, usdToKhrRate: rate, vatPercent: settings.vatPercent, deliveryFee: null });
  const lines = picked.map((line, index) => ({ ...line, totalLine: total.lines[index] }));
  return { total, lines, rate, vatPercent: settings.vatPercent, approx: approximateIn(total.total, currency, rate) };
}
