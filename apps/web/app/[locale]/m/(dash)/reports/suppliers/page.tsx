"use client";

import { getMinimumPlanFor, planHasFeature } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useReportQuery } from "@/components/reports/report-filters";
import { SupplierReportScreen } from "@/components/reports/supplier-report-screen";
import { SubPage } from "@/components/seller-frame/sub-page";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, type PayablesReport, payablesReportSchema, type Supplier, suppliersSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";

// The Suppliers report (design/screens.md S17 "Suppliers"), with stock (Pro,
// Advance): from GET /purchases/report for the period in the address (each
// supplier's bills, returns and payments), and GET /suppliers for each one's
// last bill.
export default function SupplierReportPage() {
  const t = useTranslations("SupplierReport");
  const locale = useLocale();
  const { store } = useMerchant();
  const allowed = planHasFeature(store.plan, "stock");
  const { query, search, setQuery, inOne, setInOne } = useReportQuery();
  const [report, setReport] = useState<PayablesReport | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [failed, setFailed] = useState(false);
  const base = `/${locale}/m`;
  const back = { href: `${base}/reports`, label: t("backToReports") };

  const load = useCallback(() => {
    if (!allowed) return;
    setFailed(false);
    api(`/purchases/report?${search}`, payablesReportSchema).then(setReport, () => setFailed(true));
    // The last bill column only: without it the report still works.
    api("/suppliers", suppliersSchema).then((answer) => setSuppliers(answer.suppliers), () => setSuppliers([]));
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
  const lastBill = new Map(suppliers.map((supplier) => [supplier.id, supplier.lastBillOn]));
  return (
    <SupplierReportScreen
      report={report}
      query={query}
      onQuery={setQuery}
      inOne={inOne}
      onInOne={setInOne}
      mainCurrency={store.defaultCurrency}
      rate={store.usdToKhrRate}
      back={back}
      lastBillOf={(supplierId) => lastBill.get(supplierId) ?? null}
      supplierHref={(supplierId) => `${base}/suppliers/${supplierId}`}
    />
  );
}
