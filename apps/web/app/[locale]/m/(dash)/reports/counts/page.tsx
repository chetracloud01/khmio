"use client";

import { getMinimumPlanFor, planHasFeature } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { CountReportScreen } from "@/components/reports/count-report-screen";
import { useReportQuery } from "@/components/reports/report-filters";
import { SubPage } from "@/components/seller-frame/sub-page";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, type Catalog, catalogSchema, type CountReport, countReportSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";
import { categoryNameLookup } from "@/lib/local-name";

// The stock counts report (design/screens.md S17 "Stock counts"), with stock
// (Pro, Advance): from GET /stock/counts/report for the period in the
// address, and the catalog's category names.
export default function CountReportPage() {
  const t = useTranslations("CountReport");
  const locale = useLocale();
  const { store } = useMerchant();
  const allowed = planHasFeature(store.plan, "stock");
  const { query, search, setQuery, inOne, setInOne } = useReportQuery();
  const [report, setReport] = useState<CountReport | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const base = `/${locale}/m`;
  const back = { href: `${base}/reports`, label: t("backToReports") };

  const load = useCallback(() => {
    if (!allowed) return;
    setFailed(false);
    Promise.all([api(`/stock/counts/report?${search}`, countReportSchema), api("/catalog", catalogSchema)]).then(([answer, names]) => {
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
    <CountReportScreen
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
      countHref={(countId) => `${base}/stock/count/${countId}`}
    />
  );
}
