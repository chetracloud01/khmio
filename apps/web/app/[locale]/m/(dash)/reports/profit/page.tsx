"use client";

import { getMinimumPlanFor, planHasFeature } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { ProfitLossScreen } from "@/components/reports/profit-loss-screen";
import { useReportQuery } from "@/components/reports/report-filters";
import { SubPage } from "@/components/seller-frame/sub-page";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, type ProfitLoss, profitLossSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";

// The profit and loss report (design/screens.md S17 "Profit & loss"; Pro):
// from GET /orders/profit-loss for the period in the address.
export default function ProfitLossPage() {
  const t = useTranslations("ProfitLoss");
  const locale = useLocale();
  const { store } = useMerchant();
  const allowed = planHasFeature(store.plan, "profitReport");
  const { query, search, setQuery, inOne, setInOne } = useReportQuery();
  const [report, setReport] = useState<ProfitLoss | null>(null);
  const [failed, setFailed] = useState(false);
  const base = `/${locale}/m`;
  const back = { href: `${base}/reports`, label: t("backToReports") };

  const load = useCallback(() => {
    if (!allowed) return;
    setFailed(false);
    api(`/orders/profit-loss?${search}`, profitLossSchema).then(setReport, () => setFailed(true));
  }, [allowed, search]);
  useEffect(load, [load]);

  if (!allowed)
    return (
      <SubPage width="page" back={back} title={t("title")} description={t("description")}>
        <UpgradePrompt title={t("lockedTitle")} body={t("lockedBody")} plan={getMinimumPlanFor("profitReport")} />
      </SubPage>
    );
  if (failed) return <PageOffline onRetry={load} />;
  if (!report) return <PageLoading />;
  return (
    <ProfitLossScreen
      report={report}
      query={query}
      onQuery={setQuery}
      inOne={inOne}
      onInOne={setInOne}
      mainCurrency={store.defaultCurrency}
      rate={store.usdToKhrRate}
      back={back}
      productsHref={`${base}/products`}
      productHref={(productId) => `${base}/products/${productId}`}
    />
  );
}
