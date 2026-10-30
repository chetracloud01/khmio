"use client";

import { getMinimumPlanFor, listQueryToSearchParams, planHasFeature, type Currency, type ListQuery } from "@khmio/shared";
import { buttonVariants, Notice } from "@khmio/ui";
import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useBillRowActions } from "@/components/purchases/bill-row-actions";
import { PurchaseStatusTiles } from "@/components/purchases/purchase-status-tiles";
import { tileOf, tileSearch, type PurchaseTile } from "@/components/purchases/purchase-tiles";
import { PurchasesScreen } from "@/components/purchases/purchases-screen";
import { StockArea } from "@/components/stock/stock-area";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, type PayablesReport, payablesReportSchema, purchaseListPageSchema, type Supplier, suppliersSchema } from "@/lib/api";
import { useMerchant } from "../merchant-context";

// Supplier bills and returns (design/screens.md S13 "Purchases"), the Stock
// area's Purchases tab, read page by page from GET /purchases/page. On top,
// the status tiles over every bill (GET /purchases/report): tapped, the list
// follows. A row asks for what it needs — Pay, Receive — right there. Pro and
// Advance add bills; a lower plan still sees the ones it has, locked.
// "Report" opens Bills & payables (S17).
export default function PurchasesPage() {
  const t = useTranslations("Purchases");
  const locale = useLocale();
  const { store } = useMerchant();
  const writable = planHasFeature(store.plan, "stock");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [totals, setTotals] = useState<Record<Currency, number> | null>(null);
  const [owed, setOwed] = useState<Record<Currency, number> | null>(null);
  const [report, setReport] = useState<PayablesReport | null>(null);
  const [activeTile, setActiveTile] = useState<PurchaseTile | null>(null);
  // Bumped after a payment or a receipt, so the list reads its page (and what's owed) again.
  const [reloadKey, setReloadKey] = useState(0);
  const bills = useBillRowActions(() => setReloadKey((key) => key + 1));
  // Bumped when a tile is tapped: the list starts again from the address the tile wrote.
  const [listKey, setListKey] = useState(0);

  // The supplier filter's names; without them the list still works, unfiltered.
  useEffect(() => {
    api("/suppliers", suppliersSchema).then((answer) => setSuppliers(answer.suppliers), () => setSuppliers([]));
  }, []);
  // The tiles only: without them the list still works.
  useEffect(() => {
    api("/purchases/report", payablesReportSchema).then(setReport, () => setReport(null));
  }, [reloadKey]);
  const load = useCallback(async (query: ListQuery) => {
    const page = await api(`/purchases/page?${listQueryToSearchParams(query)}`, purchaseListPageSchema);
    setTotals(page.totals);
    setOwed(page.owed);
    // The tile the list now shows, whether a tile or the filters set it.
    setActiveTile(tileOf(query));
    return page;
  }, []);

  function selectTile(tile: PurchaseTile | null) {
    const search = tileSearch(window.location.search, tile);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setActiveTile(tile);
    setListKey((key) => key + 1);
  }

  return (
    <StockArea
      tab="purchases"
      writable={writable}
      actions={
        <Link href={`/${locale}/m/reports/payables`} className={buttonVariants({ variant: "secondary" })}>
          <ChartColumn className="h-4 w-4" aria-hidden="true" />
          {t("reportLink")}
        </Link>
      }
    >
      {!writable && <UpgradePrompt title={t("lockedTitle")} body={t("lockedBody")} plan={getMinimumPlanFor("stock")} />}
      {report && <PurchaseStatusTiles report={report} mainCurrency={store.defaultCurrency} active={activeTile} onSelect={selectTile} />}
      {bills.problem && (
        <Notice tone="danger" role="alert">
          {bills.problem}
        </Notice>
      )}
      <PurchasesScreen
        key={listKey}
        server={{ load, reloadKey }}
        onPay={writable ? bills.onPay : undefined}
        onReceive={writable ? bills.onReceive : undefined}
        suppliers={suppliers}
        totals={totals}
        owed={owed}
        hrefFor={(purchase) => `/${locale}/m/purchases/${purchase.id}`}
      />
      {bills.dialogs}
    </StockArea>
  );
}
