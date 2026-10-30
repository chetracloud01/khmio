"use client";

import { formatDocumentNumber, LOW_STOCK_THRESHOLD, type Currency } from "@khmio/shared";
import { Button, buttonVariants, Card, DetailList, EmptyState, SectionTitle, StatusPill } from "@khmio/ui";
import { Boxes, Coins, PackageCheck, ReceiptText, ShoppingCart, Wallet } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { DetailStats } from "@/components/detail-stats";
import { formatMoney } from "@/components/order-ui";
import { usePurchaseText } from "@/components/purchases/use-purchase-text";
import { SubPage } from "@/components/seller-frame/sub-page";
import type { StockItemDetail, StockPage, Supplier } from "@/lib/api";
import { itemName } from "./item-name";
import { ManageSheet } from "./manage-sheet";
import { newBillHref } from "./new-bill-link";
import { ReorderSheet } from "./reorder-sheet";
import { StockHistory } from "./stock-history";
import { STOCK_LEVELS, stockLevelOf, stockValueOf } from "./stock-levels";

/**
 * One item's stock (design/screens.md S13 "Item"), the detail behind a Stock
 * list row: its numbers (on hand, free to sell, average cost, value), its
 * reorder levels and what to order, its history and the bills that bought
 * it. Stock in, Correct and Reorder levels open the same sheets as the list.
 */
export function StockItemScreen({
  detail,
  writable,
  shopCurrency,
  suppliers,
  back,
  billHref,
  onChanged,
}: {
  detail: StockItemDetail;
  /** A plan that follows stock: the buttons that write show. */
  writable: boolean;
  shopCurrency: Currency;
  suppliers: Supplier[];
  back: { href: string; label: string };
  billHref: (purchaseId: string) => string;
  /** Read the page again after a change. */
  onChanged: () => void;
}) {
  const t = useTranslations("Stock");
  const tBill = useTranslations("Purchases");
  const locale = useLocale();
  const { billDay } = usePurchaseText();
  const [sheet, setSheet] = useState<"change" | "reorder" | null>(null);
  const { item, held } = detail;
  const name = itemName(locale, item);
  const tracked = item.onHand !== null;
  const level = STOCK_LEVELS[stockLevelOf(item)];
  const money = (amount: number | null, currency: Currency | null) => (amount !== null && currency ? formatMoney(amount, currency) : "—");
  const value = stockValueOf(item);
  const saved = (_page: StockPage) => onChanged();

  return (
    <SubPage
      width="page"
      back={back}
      title={name}
      description={item.sku}
      actions={
        writable && (
          <>
            {tracked && (
              <>
                <Button variant="secondary" onClick={() => setSheet("reorder")}>
                  {t("reorderSetButton")}
                </Button>
              </>
            )}
            <Button variant="primary" onClick={() => setSheet("change")}>
              {tracked ? t("changeStockButton") : t("openingButton")}
            </Button>
          </>
        )
      }
    >
      <DetailStats
        stats={[
          { icon: Boxes, label: t("colOnHand"), value: item.onHand === null ? "—" : String(item.onHand), detail: t(level.word) },
          { icon: PackageCheck, label: t("freeToSell"), value: item.onHand === null ? "—" : String(item.onHand - held), detail: held > 0 ? t("heldForOrders", { count: held }) : undefined },
          { icon: Coins, label: t("averageCost"), value: money(item.costMinor, item.costCurrency) },
          { icon: Wallet, label: t("colValue"), value: value ? formatMoney(value.amount, value.currency) : "—" },
        ]}
      />

      {tracked && (
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>{t("reorderSection")}</SectionTitle>
            {item.suggested !== null ? <StatusPill tone="warning">{t("chip_reorder")}</StatusPill> : <StatusPill tone={level.tone}>{t(level.word)}</StatusPill>}
          </div>
          <DetailList
            items={[
              { label: t("reorderMin"), value: item.reorderMin === null ? t("reorderShopRuleAt", { count: LOW_STOCK_THRESHOLD }) : String(item.reorderMin) },
              { label: t("reorderMax"), value: String(item.reorderMax ?? (item.reorderMin ?? LOW_STOCK_THRESHOLD) * 2) },
              ...(item.suggested !== null ? [{ label: t("colSuggested"), value: <span className="font-semibold text-warning">{item.suggested}</span> }] : []),
              ...(item.lastSupplierName ? [{ label: t("colLastSupplier"), value: item.lastSupplierName }] : []),
              ...(item.lastCostMinor !== null ? [{ label: t("lastCost"), value: money(item.lastCostMinor, item.costCurrency) }] : []),
            ]}
          />
          {writable && item.suggested !== null && (
            <Link href={newBillHref(locale, [item])} className={`${buttonVariants({ variant: "primary" })} self-start`}>
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              {t("createBill")}
            </Link>
          )}
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("billsSection")}</SectionTitle>
        {detail.bills.length === 0 ? (
          <EmptyState icon={ReceiptText} title={t("noBillsYet")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-bg">
            {detail.bills.map((bill) => (
              <li key={`${bill.purchaseId}-${bill.number}`}>
                <Link href={billHref(bill.purchaseId)} className="flex min-h-touch items-center gap-3 p-3 hover:bg-border/20">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {formatDocumentNumber("bill", bill.number)} · {bill.supplierName || tBill("noSupplier")}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[
                        billDay(bill.purchasedOn),
                        tBill("lineMath", { quantity: bill.quantity, cost: formatMoney(bill.unitCostMinor, bill.currency) }),
                        ...(bill.itemCostMinor !== null && bill.itemCostCurrency && bill.itemCostCurrency !== bill.currency && bill.exchangeRateUsed !== null
                          ? [tBill("turnedAt", { amount: formatMoney(bill.itemCostMinor, bill.itemCostCurrency), rate: bill.exchangeRateUsed.toLocaleString("en-US") })]
                          : []),
                      ].join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMoney(bill.lineTotalMinor, bill.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StockHistory movements={detail.movements} nameOf={() => name} />

      {sheet === "change" && (
        <ManageSheet
          item={item}
          title={name}
          costCurrency={item.costCurrency}
          shopCurrency={shopCurrency}
          suppliers={suppliers}
          onReorderLevels={() => setSheet("reorder")}
          onClose={() => setSheet(null)}
          onSaved={saved}
        />
      )}
      {sheet === "reorder" && <ReorderSheet items={[item]} nameOf={() => name} onClose={() => setSheet(null)} onSaved={saved} />}
    </SubPage>
  );
}
