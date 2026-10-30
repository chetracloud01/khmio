"use client";

import { getMinimumPlanFor, planHasFeature } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { PayablesReportScreen } from "@/components/purchases/payables-report";
import { useReportQuery } from "@/components/reports/report-filters";
import { SubPage } from "@/components/seller-frame/sub-page";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, type PayablesReport, payablesReportSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";

// Bills & payables (design/screens.md S17), with stock (Pro, Advance): what
// the shop owes its suppliers, paid or not, received or not. The period is
// kept in the address (?period=custom&from=…&to=…), so a refresh or a shared
// link opens the same bills.
export default function PayablesReportPage() {
  const t = useTranslations("Payables");
  const locale = useLocale();
  const { store } = useMerchant();
  const allowed = planHasFeature(store.plan, "stock");
  const { query, search, setQuery, inOne, setInOne } = useReportQuery();
  const [report, setReport] = useState<PayablesReport | null>(null);
  const [failed, setFailed] = useState(false);
  const base = `/${locale}/m`;
  const back = { href: `${base}/reports`, label: t("backToReports") };

  const load = useCallback(() => {
    if (!allowed) return;
    setFailed(false);
    api(`/purchases/report?${search}`, payablesReportSchema).then(setReport, () => setFailed(true));
  }, [allowed, search]);
  useEffect(load, [load]);

  if (!allowed)
    return (
      <SubPage width="page" back={back} title={t("title")} description={t("description")}>
        <UpgradePrompt title={t("lockedTitle")} body={t("lockedBody")} plan={getMinimumPlanFor("stock")} />
      </SubPage>
    );
  if (failed) return <PageOffline onRetry={load} />;
  if (!report) return <PageLoading />;
  return (
    <PayablesReportScreen
      report={report}
      query={query}
      onQuery={setQuery}
      inOne={inOne}
      onInOne={setInOne}
      mainCurrency={store.defaultCurrency}
      rate={store.usdToKhrRate}
      back={back}
      purchasesHref={(filters) => `${base}/purchases?${new URLSearchParams(filters).toString()}`}
      supplierHref={(supplierId) => `${base}/suppliers/${supplierId}`}
    />
  );
}
