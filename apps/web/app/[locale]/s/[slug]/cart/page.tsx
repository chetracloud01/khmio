"use client";

import { approximateIn, canAddMore, type Currency } from "@khmio/shared";
import { Button, Notice } from "@khmio/ui";
import { ImageOff, Plus, ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BuyerBottomBar, BuyerColumns, BuyerShell, BuyerSteps, BuyerTopBar } from "@/components/buyer-shell";
import { CurrencyChoice } from "@/components/buyer/currency-choice";
import { QuantityStepper } from "@/components/buyer/quantity-control";
import { formatMoney, LineDetails } from "@/components/order-ui";
import { cartLines, cartTotal, useCartFitsShop, useShopCart, variantQuantity } from "@/lib/cart";
import { variantStock } from "@/lib/shop-stock";
import { isTakingOrders } from "@/lib/shop-ordering";
import { usePublicShop } from "@/lib/use-public-shop";
import { BuyerLoading, BuyerProblem } from "../buyer-states";
import { PhotoThumb } from "@/components/photo-thumb";

// The cart (design/screens.md B3), from the cart kept on the buyer's phone and
// the shop's current products and prices. Lines the shop no longer sells are
// dropped with a notice. Delivery and the final total come at checkout.
export default function CartPage() {
  const t = useTranslations("Cart");
  const tStore = useTranslations("Storefront");
  const tCheckout = useTranslations("Checkout");
  const locale = useLocale();
  const { slug } = useParams<{ slug: string }>();
  const { shop, state, reload } = usePublicShop(slug);
  const cart = useShopCart(slug);
  // Something in the cart is no longer sold, or there's less stock left: put it right and say so.
  const dropped = useCartFitsShop(shop, cart);

  if (state === "loading" || !cart.ready) return <BuyerLoading />;
  if (state !== "ready" || !shop) return <BuyerProblem kind={state === "not_found" ? "not_found" : "offline"} onRetry={reload} />;

  const shopHref = `/${locale}/s/${slug}`;
  const currency: Currency = cart.currency ?? shop.store.defaultCurrency;
  const lines = cartLines(shop, cart.quantities, cart.notes);
  const total = lines.length ? cartTotal(shop, lines, currency, null) : null;
  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);
  const lineTitle = (line: (typeof lines)[number]) => {
    const title = text(line.product.titleKm, line.product.titleEn);
    return line.product.hasOptions ? `${title} – ${text(line.variant.labelKm, line.variant.labelEn)}` : title;
  };
  const ordering = isTakingOrders(shop);
  const checkoutHref = `/${locale}/s/${slug}/checkout`;

  const summary = total && (
            <dl className="flex flex-col gap-1 rounded-2xl border border-border bg-bg p-4 text-sm">
              <div className="flex items-center justify-between text-muted">
                <dt>{tStore("subtotal")}</dt>
                <dd className="tabular-nums">{formatMoney(total.subtotal, currency)}</dd>
              </div>
              {total.discount > 0 && (
                <div className="flex items-center justify-between text-success">
                  <dt>{tStore("itemDiscount")}</dt>
                  <dd className="tabular-nums">-{formatMoney(total.discount, currency)}</dd>
                </div>
              )}
              {total.vat > 0 && (
                <div className="flex items-center justify-between text-muted">
                  <dt>{tStore("vat", { percent: shop.store.vatPercent })}</dt>
                  <dd className="tabular-nums">{formatMoney(total.vat, currency)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between text-muted">
                <dt>{tCheckout("deliveryFee")}</dt>
                <dd>{tCheckout("feeAfterChoice")}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <dt className="font-semibold">{tStore("totalToPay")}</dt>
                <dd className="text-right">
                  <span className="block text-lg font-bold tabular-nums">{formatMoney(total.total, currency)}</span>
                  <span className="block text-xs text-muted">≈ {formatMoney(approximateIn(total.total, currency, shop.store.usdToKhrRate), currency === "USD" ? "KHR" : "USD")}</span>
                </dd>
              </div>
            </dl>
  );
  const checkoutButton = (
    <Link href={checkoutHref} className="block">
      <Button variant="primary" className="w-full">
        {t("reviewPayment")}
      </Button>
    </Link>
  );

  return (
    <BuyerShell wide className="pb-32 lg:pb-0">
      <BuyerColumns
        aside={
          total ? (
            <>
              {summary}
              {ordering && checkoutButton}
            </>
          ) : undefined
        }
      >
      <BuyerTopBar backHref={shopHref} backLabel={t("stepMenu")} title={t("title")} subtitle={shop.store.name}>
        <BuyerSteps steps={[t("stepCart"), t("stepCheckout"), t("stepPay")]} current={0} />
      </BuyerTopBar>

      <main className="flex flex-col gap-4 p-4">
        {dropped && (
          <Notice tone="warning" role="status">
            {t("stockAdjusted")}
          </Notice>
        )}
        {!ordering && (
          <Notice tone="warning" role="status">
            {tCheckout("noPaymentMethods")}
          </Notice>
        )}

        {!total ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-border/30">
              <ShoppingBag className="h-8 w-8 text-muted" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted">{t("empty")}</p>
            <Link href={shopHref} className="block">
              <Button variant="primary">{t("browseMenu")}</Button>
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex flex-col">
              {lines.map((line, index) => {
                const title = lineTitle(line);
                const priced = total.lines[index];
                return (
                  <li key={line.key} className="flex items-center gap-3 border-b border-border py-3 first:pt-0">
                    {line.product.photos[0] ? (
                      <PhotoThumb photo={line.product.photos[0]} className="h-16 w-16 shrink-0 rounded-DEFAULT object-cover" />
                    ) : (
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-DEFAULT bg-border/30">
                        <ImageOff className="h-5 w-5 text-muted" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-normal">{title}</p>
                      <LineDetails choices={line.choices.map(({ value }) => text(value.labelKm, value.labelEn))} note={line.note} />
                      <p className="text-sm font-semibold">{priced ? formatMoney(priced.lineTotal, currency) : ""}</p>
                    </div>
                    <QuantityStepper
                      quantity={line.quantity}
                      binAtOne
                      decreaseLabel={line.quantity === 1 ? tStore("remove") : tStore("decrease", { title })}
                      increaseLabel={tStore("increase", { title })}
                      onDecrease={() => cart.setQuantity(line.key, line.quantity - 1)}
                      onIncrease={() => cart.setQuantity(line.key, line.quantity + 1)}
                      // Stock counts every line of this option together, whatever its choices.
                      increaseDisabled={!canAddMore(variantStock(shop, line.variant.id), variantQuantity(cart.quantities, line.variant.id))}
                      className="shrink-0"
                    />
                  </li>
                );
              })}
            </ul>
            <Link href={shopHref} className="flex min-h-touch items-center gap-2 self-start text-sm font-medium text-brand">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addMoreItems")}
            </Link>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{tCheckout("payIn")}</span>
              <CurrencyChoice label={tCheckout("payIn")} value={currency} onChange={cart.setCurrency} />
            </div>

            <div className="lg:hidden">{summary}</div>
          </>
        )}
      </main>
      </BuyerColumns>

      {total && ordering && <BuyerBottomBar wide>{checkoutButton}</BuyerBottomBar>}
    </BuyerShell>
  );
}
