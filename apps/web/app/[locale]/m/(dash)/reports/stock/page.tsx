"use client";

import { getMinimumPlanFor, planHasFeature } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useReportQuery } from "@/components/reports/report-filters";
import { StockReportScreen } from "@/components/reports/stock-report-screen";
import { SubPage } from "@/components/seller-frame/sub-page";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, type Catalog, catalogSchema, type StockReport, stockReportSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";
import { categoryNameLookup } from "@/lib/local-name";

// The stock report (design/screens.md S17 "Stock"), with stock (Pro,
// Advance): from GET /stock/report for the period in the address, and the
// catalog's category names.
export default function StockReportPage() {
  const t = useTranslations("StockReport");
  const locale = useLocale();
  const { store } = useMerchant();
  const allowed = planHasFeature(store.plan, "stock");
  const { query, search, setQuery, inOne, setInOne } = useReportQuery();
  const [report, setReport] = useState<StockReport | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const base = `/${locale}/m`;
  const back = { href: `${base}/reports`, label: t("backToReports") };

  const load = useCallback(() => {
    if (!allowed) return;
    setFailed(false);
    Promise.all([api(`/stock/report?${search}`, stockReportSchema), api("/catalog", catalogSchema)]).then(([answer, names]) => {
      setReport(answer);
      setCatalog(names);
    }, () => setFailed(true));
  }, [allowed, search]);
  useEffect(load, [load]);

  if (!allowed)
    return (
      <SubPage width="page" back={back} title={t("title")} description={t("description")}>
        <UpgradePrompt title={t("lockedTitle")} body={t("lockedBody")} plan={getMinimumPlanFor("stock")} />
      </SubPage>
    );
  if (failed) return <PageOffline onRetry={load} />;
  if (!report || !catalog) return <PageLoading />;
  const categoryName = categoryNameLookup(catalog.categories, locale);
  return (
    <StockReportScreen
      report={report}
      query={query}
      onQuery={setQuery}
      inOne={inOne}
      onInOne={setInOne}
      mainCurrency={store.defaultCurrency}
      rate={store.usdToKhrRate}
      back={back}
      categoryName={categoryName}
      itemHref={(variantId) => `${base}/stock/${variantId}`}
    />
  );
}
