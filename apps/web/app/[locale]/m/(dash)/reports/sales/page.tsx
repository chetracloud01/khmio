"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useReportQuery } from "@/components/reports/report-filters";
import { SalesReportScreen } from "@/components/reports/sales-report-screen";
import { api, type SalesReport, salesReportSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";

// The sales report (design/screens.md S17 "Sales"), every plan: from
// GET /orders/report for the period in the address.
export default function SalesReportPage() {
  const t = useTranslations("SalesReport");
  const locale = useLocale();
  const { store } = useMerchant();
  const { query, search, setQuery, inOne, setInOne } = useReportQuery();
  const [report, setReport] = useState<SalesReport | null>(null);
  const [failed, setFailed] = useState(false);
  const base = `/${locale}/m`;

  const load = useCallback(() => {
    setFailed(false);
    api(`/orders/report?${search}`, salesReportSchema).then(setReport, () => setFailed(true));
  }, [search]);
  useEffect(load, [load]);

  if (failed) return <PageOffline onRetry={load} />;
  if (!report) return <PageLoading />;
  return (
    <SalesReportScreen
      report={report}
      query={query}
      onQuery={setQuery}
      inOne={inOne}
      onInOne={setInOne}
      mainCurrency={store.defaultCurrency}
      rate={store.usdToKhrRate}
      back={{ href: `${base}/reports`, label: t("backToReports") }}
      ordersHref={`${base}/orders`}
      orderHref={(orderId) => `${base}/orders/${orderId}`}
      productHref={(productId) => `${base}/products/${productId}`}
    />
  );
}
