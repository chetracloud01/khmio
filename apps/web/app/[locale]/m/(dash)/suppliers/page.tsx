"use client";

import { planHasFeature } from "@khmio/shared";
import { buttonVariants } from "@khmio/ui";
import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { SuppliersScreen } from "@/components/purchases/suppliers-screen";
import { StockArea } from "@/components/stock/stock-area";
import { api, type PayablesReport, payablesReportSchema, type Supplier, suppliersSchema } from "@/lib/api";
import { useMerchant } from "../merchant-context";
import { PageLoading, PageOffline } from "../page-states";

// The shop's suppliers (design/screens.md S13 "Suppliers"), the Stock area's
// Suppliers tab, from GET /suppliers; the status tiles also read every bill's
// standing (GET /purchases/report). "Report" opens the Suppliers report (S17).
export default function SuppliersPage() {
  const tStock = useTranslations("Stock");
  const locale = useLocale();
  const { store } = useMerchant();
  const writable = planHasFeature(store.plan, "stock");
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [report, setReport] = useState<PayablesReport | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    api("/suppliers", suppliersSchema).then((answer) => setSuppliers(answer.suppliers), () => setFailed(true));
    // The tiles and the overdue / not received columns only: without them the list still works.
    api("/purchases/report", payablesReportSchema).then(setReport, () => setReport(null));
  }, []);
  useEffect(load, [load]);

  return (
    <StockArea
      tab="suppliers"
      writable={writable}
      actions={
        <Link href={`/${locale}/m/reports/suppliers`} className={buttonVariants({ variant: "secondary" })}>
          <ChartColumn className="h-4 w-4" aria-hidden="true" />
          {tStock("reportLink")}
        </Link>
      }
    >
      {failed ? (
        <PageOffline onRetry={load} />
      ) : !suppliers ? (
        <PageLoading />
      ) : (
        <SuppliersScreen
          suppliers={suppliers}
          report={report}
          mainCurrency={store.defaultCurrency}
          writable={writable}
          supplierHref={(supplier) => `/${locale}/m/suppliers/${supplier.id}`}
          newBillHref={(supplier) => `/${locale}/m/purchases/new?supplier=${supplier.id}`}
        />
      )}
    </StockArea>
  );
}
