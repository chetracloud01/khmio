"use client";

import { getMinimumPlanFor, planHasFeature, type Currency, type SalesPeriod } from "@khmio/shared";
import { Card, EmptyState, Notice, SegmentedControl, StatCard } from "@khmio/ui";
import { Coins, Percent, ReceiptText, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { formatMoney } from "@/components/order-ui";
import { SubPage } from "@/components/seller-frame/sub-page";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, type ProfitFigures, type ProfitReport, profitReportSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";

// The profit report (design/screens.md S17, Pro plan): sales, what they cost
// and the profit, for today, 7 days or 30 days, from the cost frozen on each
// order line. The shop's main currency leads; dollars and riel are never
// added. Sales of products without a cost price are shown apart, never guessed.
export default function ProfitReportPage() {
  const t = useTranslations("Profit");
  const tApp = useTranslations("SellerApp");
  const locale = useLocale();
  const { store } = useMerchant();
  const allowed = planHasFeature(store.plan, "profitReport");
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<SalesPeriod>("week");

  const load = useCallback(() => {
    if (!allowed) return;
    setFailed(false);
    api("/orders/profit", profitReportSchema).then(setReport, () => setFailed(true));
  }, [allowed]);
  useEffect(load, [load]);

  const page = (children: ReactNode) => (
    <SubPage back={{ href: `/${locale}/m`, label: t("backToHome") }} title={t("title")} description={t("description")} width="page">
      {children}
    </SubPage>
  );

  if (!allowed) return page(<UpgradePrompt title={t("lockedTitle")} body={t("lockedBody")} plan={getMinimumPlanFor("profitReport")} />);
  if (failed) return <PageOffline onRetry={load} />;
  if (!report) return <PageLoading />;

  const main = report.mainCurrency;
  const other: Currency = main === "USD" ? "KHR" : "USD";
  const shown = report[period];
  // The other currency only when it had sales in this period.
  const currencies = shown[other].sales > 0 ? [main, other] : [main];
  const name = (product: { nameKm: string; nameEn: string }) => (locale === "km" ? product.nameKm || product.nameEn : product.nameEn || product.nameKm);
  const margin = (figures: ProfitFigures) => (figures.marginPercent === null ? "—" : `${figures.marginPercent}%`);

  return page(
    <>
      <SegmentedControl
        value={period}
        onChange={setPeriod}
        options={[
          { value: "today", label: tApp("periodToday") },
          { value: "week", label: tApp("periodWeek") },
          { value: "month", label: tApp("periodMonth") },
        ]}
      />

      {currencies.map((currency) => {
        const figures = shown[currency];
        return (
          <section key={currency} className="flex flex-col gap-3" aria-label={currency}>
            {currencies.length > 1 && <h2 className="text-sm font-semibold text-muted">{t(currency === "USD" ? "inDollars" : "inRiel")}</h2>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={ReceiptText} label={t("sales")} value={formatMoney(figures.sales, currency)} />
              <StatCard icon={Coins} tone="warning" label={t("cost")} value={formatMoney(figures.cost, currency)} />
              <StatCard icon={TrendingUp} tone={figures.profit < 0 ? "danger" : "success"} label={t("profit")} value={formatMoney(figures.profit, currency)} />
              <StatCard icon={Percent} tone="info" label={t("margin")} value={margin(figures)} />
            </div>
            {figures.missingCostSales > 0 && (
              <Notice
                tone="warning"
                action={
                  <Link href={`/${locale}/m/products`} className="inline-flex min-h-touch items-center font-semibold underline">
                    {t("addCosts")}
                  </Link>
                }
              >
                {t("missingCost", { amount: formatMoney(figures.missingCostSales, currency) })}
              </Notice>
            )}
          </section>
        );
      })}

      <Card className="flex flex-col gap-2 p-4">
        <h2 className="text-base font-semibold">{t("byProduct")}</h2>
        {shown.products.length === 0 ? (
          <EmptyState title={t("noSales")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {shown.products.map((product, index) => {
              const currency = product[main].sales > 0 ? main : other;
              const figures = product[currency];
              return (
                <li key={`${product.nameEn}-${index}`} className="flex min-h-touch items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{name(product)}</span>
                    <span className="block text-xs text-muted">
                      {tApp("soldCount", { count: product.quantity })} · {formatMoney(figures.sales, currency)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {figures.costedSales > 0 ? (
                      <>
                        <span className={figures.profit < 0 ? "block font-semibold tabular-nums text-danger" : "block font-semibold tabular-nums"}>{formatMoney(figures.profit, currency)}</span>
                        <span className="block text-xs text-muted tabular-nums">{margin(figures)}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted">{t("noCost")}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>,
  );
}
