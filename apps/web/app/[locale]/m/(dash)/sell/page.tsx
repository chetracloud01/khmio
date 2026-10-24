"use client";

import { getMinimumPlanFor, planHasFeature, type Currency } from "@khmio/shared";
import { BottomSheet, Button, SegmentedControl } from "@khmio/ui";
import { ArrowRight, History } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { BrowseToolbar } from "@/components/buyer/browse-toolbar";
import { ProductTile } from "@/components/buyer/product-tile";
import { useProductBrowse, type BrowseAccessors } from "@/components/buyer/use-product-browse";
import { CounterCart } from "@/components/counter/counter-cart";
import { formatMoney } from "@/components/order-ui";
import { PhotoThumb } from "@/components/photo-thumb";
import { SELLER_PAGE } from "@/components/seller-frame/seller-frame";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, type Catalog, catalogSchema, type CounterSaleResult, type Product, productSchema } from "@/lib/api";
import { startingVariant, usdValue } from "@/lib/product-price";
import { useMerchant } from "../merchant-context";
import { PageLoading, PageOffline } from "../page-states";
import { PayStep, SaleDone } from "./pay-step";
import { salePrice, useCounterSale } from "./use-counter-sale";

type Step = "sell" | "pay" | "done";

export default function SellPage() {
  const t = useTranslations("Counter");
  const { store } = useMerchant();
  const [data, setData] = useState<{ products: Product[]; catalog: Catalog } | null>(null);
  const [failed, setFailed] = useState(false);
  const allowed = planHasFeature(store.plan, "counterSales");
  const load = useCallback(() => {
    setFailed(false);
    Promise.all([api("/products", z.array(productSchema)), api("/catalog", catalogSchema)]).then(
      ([products, catalog]) => setData({ products, catalog }),
      () => setFailed(true),
    );
  }, []);
  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!allowed) {
    return (
      <div className={SELLER_PAGE}>
        <UpgradePrompt title={t("upgradeTitle")} body={t("upgradeBody")} plan={getMinimumPlanFor("counterSales")} />
      </div>
    );
  }
  if (failed) return <PageOffline onRetry={load} />;
  if (!data) return <PageLoading />;
  return <Sell products={data.products} catalog={data.catalog} />;
}

// Sell in the shop (design/screens.md P1–P3): tap products into the sale,
// charge in one currency, take cash or the shop's own QR, then the receipt.
// Hidden products can be sold here too: the shop may keep some off its page.
function Sell({ products, catalog }: { products: Product[]; catalog: Catalog }) {
  const t = useTranslations("Counter");
  const tShop = useTranslations("Storefront");
  const locale = useLocale();
  const { store } = useMerchant();
  const [step, setStep] = useState<Step>("sell");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [currency, setCurrency] = useState<Currency>(store.defaultCurrency);
  const [choosing, setChoosing] = useState<Product | null>(null);
  const [done, setDone] = useState<CounterSaleResult | null>(null);
  const sale = useCounterSale(products, quantities, currency, store);
  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);
  const rate = store.usdToKhrRate;

  const browseAccessors = useMemo<BrowseAccessors<Product>>(
    () => ({
      text: (product) => `${product.titleKm} ${product.titleEn}`,
      category: (product) => product.categoryId,
      price: (product) => {
        const variant = startingVariant(product, rate);
        return variant ? usdValue(variant, rate) : 0;
      },
      discount: (product) => product.discountPercent ?? 0,
    }),
    [rate],
  );
  const browse = useProductBrowse(products, browseAccessors, `${store.slug}-counter`);

  const setQuantity = (variantId: string, quantity: number) =>
    setQuantities((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([key]) => key !== variantId)), ...(quantity > 0 ? { [variantId]: quantity } : {}) }));
  const inSale = (product: Product) => product.variants.reduce((sum, variant) => sum + (quantities[variant.id] ?? 0), 0);

  const charge = (
    <Button variant="primary" fullWidth disabled={sale.total.itemCount === 0} onClick={() => setStep("pay")}>
      {t("charge", { amount: sale.totals.total })}
      <ArrowRight className="h-5 w-5" aria-hidden="true" />
    </Button>
  );

  if (step === "done" && done) {
    return (
      <SaleDone
        sale={done}
        receiptHref={`/${locale}/m/orders/${done.id}/invoice`}
        onNewSale={() => {
          setQuantities({});
          setDone(null);
          setStep("sell");
        }}
      />
    );
  }

  if (step === "pay") {
    return (
      <PayStep
        currency={currency}
        quantities={quantities}
        sale={sale}
        onQuantity={setQuantity}
        onBack={() => setStep("sell")}
        onDone={(result) => {
          setDone(result);
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
          <Link href={`/${locale}/m/sell/today`} className="flex min-h-touch items-center gap-2 rounded-full border border-border bg-bg px-4 text-sm font-medium hover:border-brand/40">
            <History className="h-4 w-4 text-brand" aria-hidden="true" />
            {t("todayShort")}
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <BrowseToolbar browse={browse} categories={catalog.categories.map((entry) => ({ id: entry.id, label: text(entry.nameKm, entry.nameEn) }))} />
          <div className={browse.view === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-3"}>
            {browse.shown.map((product) => {
              const title = text(product.titleKm, product.titleEn);
              const optionCount = product.hasOptions ? product.variants.length : 0;
              const variant = startingVariant(product, rate);
              const only = product.variants[0];
              return (
                <ProductTile
                  key={product.id}
                  view={browse.view}
                  title={title}
                  photo={product.photos[0] ? <PhotoThumb photo={product.photos[0]} lazy className="h-full w-full object-cover" /> : null}
                  discountPercent={product.discountPercent}
                  optionCount={optionCount}
                  price={variant ? formatMoney(salePrice(product, variant, currency, rate), currency) : null}
                  quantity={inSale(product)}
                  ordering
                  labels={{
                    add: tShop("addTitle", { title }),
                    decrease: t("decrease", { title }),
                    increase: t("increase", { title }),
                    from: tShop("startingFrom"),
                    options: t("options", { count: optionCount }),
                    inCart: t("inSale", { count: inSale(product) }),
                    soldOut: tShop("soldOut"),
                  }}
                  onOpen={() => (optionCount > 0 ? setChoosing(product) : only && setQuantity(only.id, (quantities[only.id] ?? 0) + 1))}
                  onAdjust={(delta) => only && setQuantity(only.id, (quantities[only.id] ?? 0) + delta)}
                />
              );
            })}
          </div>
        </div>

        {/* The sale so far: beside the products on a laptop. */}
        <aside className="sticky top-6 hidden lg:block">
          <CounterCart lines={sale.lines} totals={sale.totals} onQuantity={setQuantity} footer={charge} />
        </aside>
      </div>

      {/* On a phone: Charge, above the bottom tabs. */}
      <div className="bottom-above-nav fixed inset-x-0 z-20 border-t border-border bg-bg p-3 lg:hidden">
        <div className="mx-auto max-w-[720px]">{charge}</div>
      </div>

      <BottomSheet open={choosing !== null} onClose={() => setChoosing(null)} closeLabel={t("close")} title={choosing ? text(choosing.titleKm, choosing.titleEn) : ""}>
        <ul className="flex flex-col gap-2">
          {choosing?.variants.map((variant) => (
            <li key={variant.id}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setQuantity(variant.id, (quantities[variant.id] ?? 0) + 1);
                  setChoosing(null);
                }}
                className="min-h-[56px] justify-between"
              >
                <span className="font-medium">{text(variant.labelKm, variant.labelEn)}</span>
                <span className="flex items-center gap-2 text-sm tabular-nums">
                  {quantities[variant.id] ? <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand">{quantities[variant.id]}</span> : null}
                  {formatMoney(salePrice(choosing, variant, currency, rate), currency)}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}
