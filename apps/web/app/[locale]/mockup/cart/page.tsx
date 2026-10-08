"use client";

import { formatKhr, formatUsd, maxOrderQuantity, type Currency } from "@khmio/shared";
import { Button, cn } from "@khmio/ui";
import { AlertTriangle, ChevronDown, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { mockPromoCodes, parseLineKey } from "@/mock/mock-data";
import { BuyerBottomBar, BuyerColumns, BuyerShell, BuyerSteps, BuyerTopBar } from "@/components/buyer-shell";
import { useCart } from "../cart-context";
import { useClampCartToStock, useOnlineStock } from "../online-stock";
import { useShopIdentity } from "../shop-identity";
import { useShopProducts } from "../shop-products";
import { canAddMore, StockNote } from "../shared-ui";
import { useStoreSettings } from "../store-settings-context";
import { useCheckoutTotal } from "../use-checkout-total";

export default function CartMockupPage() {
  const t = useTranslations("Cart");
  const tStore = useTranslations("Storefront");
  const tCheckout = useTranslations("Checkout");
  const { settings: storeSettings } = useStoreSettings();
  const stockLabels = { soldOut: tStore("soldOut"), onlyLeft: (count: number) => tStore("onlyLeft", { count }) };
  const locale = useLocale();
  const { quantities, setQuantities, appliedPromo, setAppliedPromo, currency } = useCart();

  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // The same totals checkout and the KHQR screen show, in the buyer's currency.
  const { lines, itemCount, subtotal, itemDiscount, promoDiscount, deliveryFee, deliveryStatus, vat, total, secondaryTotal } =
    useCheckoutTotal(quantities, locale, appliedPromo, currency);
  const format = (amount: number, cur: Currency) => (cur === "USD" ? formatUsd(amount) : formatKhr(amount));
  const otherCurrency: Currency = currency === "USD" ? "KHR" : "USD";

  const { stateFor } = useOnlineStock();
  const { products } = useShopProducts();
  const { name: shopName } = useShopIdentity();
  const stockCheck = useClampCartToStock(quantities, setQuantities);

  function stockOf(key: string) {
    const { productId, variantId } = parseLineKey(key);
    return stateFor(productId, variantId);
  }

  /** Adds or removes one, never beyond what the shop has in stock (Pro and Advance). */
  function adjustQuantity(key: string, delta: number) {
    const max = maxOrderQuantity(stockOf(key));
    setQuantities((prev) => {
      const wanted = Math.max(0, (prev[key] ?? 0) + delta);
      return { ...prev, [key]: max === null ? wanted : Math.min(wanted, max) };
    });
  }

  function thumbnail(key: string) {
    const product = products.find((item) => item.id === parseLineKey(key).productId);
    if (product?.photoDataUrls?.[0]) {
      // eslint-disable-next-line @next/next/no-img-element -- merchant's own upload preview, not a remote image
      return <img src={product.photoDataUrls[0]} alt="" className="h-16 w-16 shrink-0 rounded-DEFAULT object-cover" />;
    }
    return <div className={cn("h-16 w-16 shrink-0 rounded-DEFAULT", product?.photoColor ?? "bg-border/40")} aria-hidden="true" />;
  }

  function handleApplyPromo() {
    const match = mockPromoCodes.find((promo) => promo.code.toLowerCase() === promoInput.trim().toLowerCase());
    if (!match) {
      setPromoError(tStore("promoInvalid"));
      return;
    }
    setAppliedPromo(match);
    setPromoError(null);
    setShowPromoInput(false);
  }

  function handleRemovePromo() {
    setAppliedPromo(null);
    setPromoInput("");
  }

  const storefrontHref = `/${locale}/mockup/storefront`;
  const checkoutHref = `/${locale}/mockup/checkout`;

  const summaryRows = (
    <dl className="flex flex-col gap-1 text-sm">
      <div className="flex items-center justify-between text-muted">
        <dt>{tStore("subtotal")}</dt>
        <dd>{format(subtotal, currency)}</dd>
      </div>
      {itemDiscount > 0 && (
        <div className="flex items-center justify-between text-success">
          <dt>{tStore("itemDiscount")}</dt>
          <dd>-{format(itemDiscount, currency)}</dd>
        </div>
      )}
      {promoDiscount > 0 && (
        <div className="flex items-center justify-between text-success">
          <dt>{tStore("promoDiscount")}</dt>
          <dd>-{format(promoDiscount, currency)}</dd>
        </div>
      )}
      <div className="flex items-center justify-between text-muted">
        <dt>{tCheckout("deliveryFee")}</dt>
        {/* Known only once the buyer picks delivery or pickup and where, at checkout. */}
        <dd>{deliveryStatus === "ok" ? (deliveryFee === 0 ? tCheckout("free") : format(deliveryFee, currency)) : tCheckout("feeAfterChoice")}</dd>
      </div>
      {storeSettings.vatPercent > 0 && (
        <div className="flex items-center justify-between text-muted">
          <dt>{tStore("vat", { percent: storeSettings.vatPercent })}</dt>
          <dd>{format(vat, currency)}</dd>
        </div>
      )}
    </dl>
  );
  const totalRow = (
    <div className="flex items-center justify-between border-t border-border pt-3">
      <span className="font-semibold">{tStore("totalToPay")}</span>
      <span className="text-right">
        <span className="block text-lg font-bold">{format(total, currency)}</span>
        <span className="block text-xs text-muted">≈ {format(secondaryTotal, otherCurrency)}</span>
      </span>
    </div>
  );
  // Laptop: the summary always open, with the next button, beside the items.
  const aside =
    itemCount > 0 ? (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4">
        <h2 className="font-semibold">{tCheckout("sectionSummary")}</h2>
        {summaryRows}
        {totalRow}
        <Link href={checkoutHref} className="block">
          <Button variant="primary" className="w-full">
            {t("reviewPayment")}
          </Button>
        </Link>
      </div>
    ) : undefined;

  return (
    <BuyerShell wide className="pb-32 lg:pb-0">
      <BuyerColumns aside={aside}>
      <BuyerTopBar
        backHref={storefrontHref}
        backLabel={t("stepMenu")}
        title={t("title")}
        subtitle={shopName}
      >
        <BuyerSteps steps={[t("stepCart"), t("stepCheckout"), t("stepPay")]} current={0} />
      </BuyerTopBar>

      <main className="flex flex-col gap-4 p-4">
        {stockCheck.adjusted && (
          <div role="status" className="flex items-start gap-3 rounded-DEFAULT border border-warning/40 bg-warning/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="flex-1">{t("stockAdjusted")}</p>
            <button
              type="button"
              onClick={stockCheck.dismiss}
              aria-label={tStore("close")}
              className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center text-muted"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {itemCount === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-border/30">
              <ShoppingBag className="h-8 w-8 text-muted" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted">{t("empty")}</p>
            <Link href={storefrontHref} className="block">
              <Button variant="primary">{t("browseMenu")}</Button>
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex flex-col">
              {lines.map((line) => (
                <li key={line.key} className="flex items-center gap-3 border-b border-border py-3 first:pt-0">
                  {thumbnail(line.key)}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-normal">{line.title}</p>
                    <p className="text-sm font-semibold">{format(line.discounted * line.qty, currency)}</p>
                    <StockNote state={stockOf(line.key)} labels={stockLabels} />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={line.qty === 1 ? tStore("remove") : tStore("decrease", { title: line.title })}
                      onClick={() => adjustQuantity(line.key, -1)}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-muted transition-transform active:scale-95"
                    >
                      {line.qty === 1 ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : <span className="text-lg font-bold">−</span>}
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      aria-label={tStore("increase", { title: line.title })}
                      onClick={() => adjustQuantity(line.key, 1)}
                      disabled={!canAddMore(stockOf(line.key), line.qty)}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-lg font-bold text-on-brand transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <Link href={storefrontHref} className="flex min-h-touch items-center gap-2 self-start text-sm font-medium text-brand">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addMoreItems")}
            </Link>

            <div className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
              {!appliedPromo && !showPromoInput && (
                <button
                  type="button"
                  onClick={() => setShowPromoInput(true)}
                  className="min-h-touch text-left text-sm font-medium text-brand"
                >
                  {tStore("havePromoCode")}
                </button>
              )}
              {!appliedPromo && showPromoInput && (
                <div className="flex items-center gap-2">
                  <input
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value);
                      setPromoError(null);
                    }}
                    aria-label={tStore("promoPlaceholder")}
                    placeholder={tStore("promoPlaceholder")}
                    autoCapitalize="characters"
                    className="min-h-touch min-w-0 flex-1 rounded-DEFAULT border border-border bg-bg px-3 text-base uppercase text-fg placeholder:normal-case placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <Button variant="secondary" onClick={handleApplyPromo} className="px-4 text-sm">
                    {tStore("apply")}
                  </Button>
                </div>
              )}
              {promoError && <p className="text-sm text-danger">{promoError}</p>}
              {appliedPromo && (
                <div className="flex min-h-touch items-center justify-between text-sm">
                  <span className="font-medium text-success">{tStore("promoApplied", { code: appliedPromo.code })}</span>
                  <button
                    type="button"
                    onClick={handleRemovePromo}
                    className="flex min-h-touch items-center px-2 text-sm text-muted underline"
                  >
                    {tStore("remove")}
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => setSummaryExpanded((v) => !v)}
                  aria-expanded={summaryExpanded}
                  className="flex min-h-touch items-center justify-between border-t border-border pt-2 text-sm font-medium text-brand"
                >
                  {summaryExpanded ? t("hideSummary") : t("seeSummary")}
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", summaryExpanded && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                {summaryExpanded && summaryRows}
                {totalRow}
              </div>
            </div>
          </>
        )}
      </main>
      </BuyerColumns>

      {itemCount > 0 && (
        <BuyerBottomBar wide>
          <Link href={checkoutHref} className="block">
            <Button variant="primary" className="w-full">
              {t("reviewPayment")}
            </Button>
          </Link>
        </BuyerBottomBar>
      )}
    </BuyerShell>
  );
}
