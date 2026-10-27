"use client";

import { formatKhr, formatUsd, getMinimumPlanFor, planHasFeature, type Currency } from "@khmio/shared";
import { BottomSheet, Button, cn, SegmentedControl } from "@khmio/ui";
import { ArrowRight, History } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BrowseToolbar } from "@/components/buyer/browse-toolbar";
import { ProductTile } from "@/components/buyer/product-tile";
import { useProductBrowse, type BrowseAccessors } from "@/components/buyer/use-product-browse";
import { CounterCart } from "@/components/counter/counter-cart";
import { formatMoney } from "@/components/order-ui";
import { getDiscountedUnitAmount, getStartingVariant, getUnitUsdCents, lineKey, mockStore, parseLineKey, type MockProduct, type MockVariant } from "@/mock/mock-data";
import { salesToday, useCounterSales, type CounterSale } from "../../counter-sales-context";
import { useMerchantSubscription } from "../../merchant-subscription-context";
import { useShopProducts } from "../../shop-products";
import { useStoreSettings } from "../../store-settings-context";
import { UpgradePrompt } from "../upgrade-prompt";
import { PayStep, SaleDone } from "./pay-step";
import { useCounterTotal } from "./use-counter-total";

type Step = "sell" | "pay" | "done";

export default function SellPage() {
  const { hydrated: productsReady } = useShopProducts();
  const { hydrated: settingsReady } = useStoreSettings();
  const { hydrated: subscriptionReady, subscription } = useMerchantSubscription();
  const { hydrated: salesReady } = useCounterSales();
  const t = useTranslations("Counter");
  if (!productsReady || !settingsReady || !subscriptionReady || !salesReady) return null;
  if (!planHasFeature(subscription.plan, "counterSales")) {
    return (
      <div className="mx-auto max-w-[720px] p-4 md:p-6">
        <UpgradePrompt title={t("upgradeTitle")} body={t("upgradeBody")} plan={getMinimumPlanFor("counterSales")} />
      </div>
    );
  }
  return <Sell />;
}

// Sell in the shop (design/screens.md P1–P3): tap products into the sale,
// charge in one currency, take cash or the shop's own QR, then the receipt.
function Sell() {
  const t = useTranslations("Counter");
  const tShop = useTranslations("Storefront");
  const locale = useLocale();
  const { products, categories } = useShopProducts();
  const { settings, rate } = useStoreSettings();
  const { sales } = useCounterSales();
  const [step, setStep] = useState<Step>("sell");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [currency, setCurrency] = useState<Currency>(settings.defaultCurrency);
  const [choosing, setChoosing] = useState<MockProduct | null>(null);
  const [lastSale, setLastSale] = useState<CounterSale | null>(null);
  const sale = useCounterTotal(quantities, currency);
  const base = `/${locale}/mockup/dashboard/sell`;
  const todayCount = salesToday(sales).filter((entry) => !entry.voided).length;

  const browseAccessors = useMemo<BrowseAccessors<MockProduct>>(
    () => ({
      text: (product) => `${product.titleKm} ${product.titleEn}`,
      category: (product) => product.categoryId,
      price: (product) => getUnitUsdCents(product, product.variants?.length ? getStartingVariant(product) : undefined) ?? 0,
      discount: (product) => product.discountPercent ?? 0,
    }),
    [],
  );
  const browse = useProductBrowse(products, browseAccessors, `${mockStore.slug}-counter`);
  const text = (km: string, en: string) => (locale === "km" ? km : en);

  const setQuantity = (key: string, quantity: number) =>
    setQuantities((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([line]) => line !== key)), ...(quantity > 0 ? { [key]: quantity } : {}) }));
  const inSale = (product: MockProduct) =>
    Object.entries(quantities).reduce((sum, [key, qty]) => (parseLineKey(key).productId === product.id ? sum + qty : sum), 0);
  /** In the sale's currency; a product with options shows its cheapest. */
  const priceText = (product: MockProduct, variant?: MockVariant) => {
    const amount = getDiscountedUnitAmount(product, currency, rate, variant ?? (product.variants?.length ? getStartingVariant(product) : undefined));
    return amount !== undefined ? formatMoney(amount, currency) : "";
  };

  const cartLines = sale.lines.map((line) => ({
    key: line.input.key,
    title: line.title,
    option: line.option,
    quantity: line.input.quantity,
    lineTotal: formatMoney(line.totalLine?.lineTotal ?? 0, currency),
  }));
  const totals = {
    subtotal: formatMoney(sale.total.subtotal, currency),
    discount: sale.total.discount > 0 ? `−${formatMoney(sale.total.discount, currency)}` : undefined,
    vat: sale.vatPercent > 0 ? { label: t("vat", { percent: sale.vatPercent }), amount: formatMoney(sale.total.vat, currency) } : undefined,
    total: formatMoney(sale.total.total, currency),
    approx: `≈ ${currency === "USD" ? formatKhr(sale.approx) : formatUsd(sale.approx)}`,
  };
  const charge = (
    <Button variant="primary" fullWidth disabled={sale.total.itemCount === 0} onClick={() => setStep("pay")}>
      {t("charge", { amount: totals.total })}
      <ArrowRight className="h-5 w-5" aria-hidden="true" />
    </Button>
  );

  if (step === "done" && lastSale) {
    return (
      <SaleDone
        sale={lastSale}
        receiptHref={`${base}/receipt/${encodeURIComponent(lastSale.number)}`}
        onNewSale={() => {
          setQuantities({});
          setLastSale(null);
          setStep("sell");
        }}
      />
    );
  }

  if (step === "pay") {
    return (
      <PayStep
        currency={currency}
        sale={sale}
        cartLines={cartLines}
        totals={totals}
        onQuantity={setQuantity}
        onBack={() => setStep("sell")}
        onDone={(done) => {
          setLastSale(done);
          setStep("done");
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-4 pb-32 text-fg md:p-6 lg:pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            mode="choice"
            label={t("saleCurrency")}
            value={currency}
            onChange={(next) => setCurrency(next === "KHR" ? "KHR" : "USD")}
            options={[
              { value: "USD", label: "$ USD" },
              { value: "KHR", label: "៛ KHR" },
            ]}
          />
          <Link href={`${base}/today`} className="flex min-h-touch items-center gap-2 rounded-full border border-border bg-bg px-4 text-sm font-medium hover:border-brand/40">
            <History className="h-4 w-4 text-brand" aria-hidden="true" />
            {t("todayLink", { count: todayCount })}
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <BrowseToolbar browse={browse} categories={categories.map((entry) => ({ id: entry.id, label: text(entry.labelKm, entry.labelEn) }))} />
          <div className={browse.view === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-3"}>
            {browse.shown.map((product) => {
              const title = text(product.titleKm, product.titleEn);
              return (
                <ProductTile
                  key={product.id}
                  view={browse.view}
                  title={title}
                  photo={
                    product.photoDataUrls?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- the seller's own photo preview
                      <img src={product.photoDataUrls[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className={cn("block h-full w-full", product.photoColor)} />
                    )
                  }
                  discountPercent={product.discountPercent}
                  optionCount={product.variants?.length ?? 0}
                  price={priceText(product)}
                  quantity={inSale(product)}
                  ordering
                  labels={{
                    add: tShop("addTitle", { title }),
                    decrease: t("decrease", { title }),
                    increase: t("increase", { title }),
                    from: tShop("startingFrom"),
                    options: t("options", { count: product.variants?.length ?? 0 }),
                    inCart: t("inSale", { count: inSale(product) }),
                    soldOut: tShop("soldOut"),
                  }}
                  onOpen={() => (product.variants?.length ? setChoosing(product) : setQuantity(lineKey(product.id), inSale(product) + 1))}
                  onAdjust={(delta) => setQuantity(lineKey(product.id), inSale(product) + delta)}
                />
              );
            })}
          </div>
        </div>

        {/* The sale so far: beside the products on a laptop. */}
        <aside className="sticky top-6 hidden lg:block">
          <CounterCart lines={cartLines} totals={totals} onQuantity={setQuantity} footer={charge} />
        </aside>
      </div>

      {/* On a phone: the total and Charge, above the bottom tabs. */}
      <div className="bottom-above-nav fixed inset-x-0 z-20 border-t border-border bg-bg p-3 lg:hidden">
        <div className="mx-auto max-w-[720px]">{charge}</div>
      </div>

      <BottomSheet open={choosing !== null} onClose={() => setChoosing(null)} closeLabel={t("close")} title={choosing ? text(choosing.titleKm, choosing.titleEn) : ""}>
        <ul className="flex flex-col gap-2">
          {choosing?.variants?.map((variant) => {
            const key = lineKey(choosing.id, variant.id);
            return (
              <li key={variant.id}>
                <button
                  type="button"
                  onClick={() => {
                    setQuantity(key, (quantities[key] ?? 0) + 1);
                    setChoosing(null);
                  }}
                  className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border border-border px-4 text-left hover:border-brand/40"
                >
                  <span className="font-medium">{text(variant.labelKm, variant.labelEn)}</span>
                  <span className="flex items-center gap-2 text-sm tabular-nums">
                    {quantities[key] ? <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand">{quantities[key]}</span> : null}
                    {priceText(choosing, variant)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </div>
  );
}
