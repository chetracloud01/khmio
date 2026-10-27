import {
  convertKhrToUsdCents,
  convertUsdCentsToKhr,
  deliveryFeeIn,
  getDeliveryQuote,
  type Currency,
} from "@khmio/shared";
import {
  getDiscountedUnitAmount,
  getUnitAmount,
  lineKey,
  type MockPromoCode,
} from "@/mock/mock-data";
import { useCart } from "./cart-context";
import { useDeliverySettings } from "./delivery-settings-context";
import { useShopProducts } from "./shop-products";
import { useStoreSettings } from "./store-settings-context";

/**
 * The buyer's order total in their chosen currency, following the rule in
 * docs/blueprint.md "Multi-currency pricing and totals": each line uses its
 * native price in that currency, or converts via the store's rate if it has
 * none, rounding each line before summing. Shared by the shop page, cart,
 * checkout and the KHQR payment screen so all show exactly the same amount.
 *
 * The delivery fee follows what the buyer chose at checkout (pickup, or the
 * zone their district is in). Until a district or province is chosen,
 * `deliveryStatus` is "incomplete" and the fee counts as 0 — screens say
 * "choose where" rather than showing a fee that may change.
 */
export function useCheckoutTotal(
  quantities: Record<string, number>,
  locale: string,
  appliedPromo: MockPromoCode | null,
  currency: Currency,
) {
  const { settings, rate } = useStoreSettings();
  const { settings: delivery } = useDeliverySettings();
  const { fulfilment, area, districtId, provinceId } = useCart();

  const { products } = useShopProducts();

  const lines = products.flatMap((product) => {
    const title = locale === "km" ? product.titleKm : product.titleEn;
    if (product.variants?.length) {
      return product.variants.flatMap((variant) => {
        const key = lineKey(product.id, variant.id);
        const qty = quantities[key] ?? 0;
        if (qty === 0) return [];
        const base = getUnitAmount(product, currency, rate, variant) ?? 0;
        const discounted = getDiscountedUnitAmount(product, currency, rate, variant) ?? 0;
        const variantLabel = locale === "km" ? variant.labelKm : variant.labelEn;
        return [{ key, title: `${title} – ${variantLabel}`, qty, base, discounted }];
      });
    }
    const key = lineKey(product.id);
    const qty = quantities[key] ?? 0;
    if (qty === 0) return [];
    const base = getUnitAmount(product, currency, rate) ?? 0;
    const discounted = getDiscountedUnitAmount(product, currency, rate) ?? 0;
    return [{ key, title, qty, base, discounted }];
  });

  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.base * line.qty, 0);
  const afterItemDiscount = lines.reduce((sum, line) => sum + line.discounted * line.qty, 0);
  const itemDiscount = subtotal - afterItemDiscount;

  const promoDiscount = !appliedPromo
    ? 0
    : appliedPromo.type === "percent"
      ? Math.round(afterItemDiscount * (appliedPromo.value / 100))
      : Math.min(
          currency === "USD" ? appliedPromo.value : convertUsdCentsToKhr(appliedPromo.value, rate),
          afterItemDiscount,
        );

  const goodsAfterDiscount = afterItemDiscount - promoDiscount;
  const vat = Math.round(goodsAfterDiscount * (settings.vatPercent / 100));
  const quote = getDeliveryQuote(delivery, {
    fulfilment,
    area,
    districtId: districtId || undefined,
    provinceId: provinceId || undefined,
  });
  const deliveryFee = quote.status === "ok" ? deliveryFeeIn(quote.fee, currency, rate) : 0;
  const total = goodsAfterDiscount + vat + deliveryFee;
  const secondaryTotal = currency === "USD" ? convertUsdCentsToKhr(total, rate) : convertKhrToUsdCents(total, rate);

  return {
    lines,
    itemCount,
    subtotal,
    itemDiscount,
    promoDiscount,
    deliveryFee,
    /** "ok" = fee known; "incomplete" = buyer still has to pick where; "unavailable" = the shop doesn't do this. */
    deliveryStatus: quote.status,
    vat,
    total,
    secondaryTotal,
  };
}
