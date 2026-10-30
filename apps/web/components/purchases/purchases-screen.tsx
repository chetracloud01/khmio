"use client";

import { GOODS_STATES, PURCHASE_DUE_FILTERS, PURCHASE_PAYMENT_FILTERS, PURCHASE_PERIODS, type Currency } from "@khmio/shared";
import { Button, buttonVariants, Mio, StatusPill } from "@khmio/ui";
import { Clock3, Eye, PackageCheck, ReceiptText, Undo2, Wallet } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { DataGrid, DataGridHighlight, type DataGridColumn, type DataGridServer } from "@/components/data-grid";
import { formatMoney } from "@/components/order-ui";
import type { PurchaseRow, Supplier } from "@/lib/api";
import { PaymentStatePill } from "./payment-ui";
import { usePurchaseText } from "./use-purchase-text";

// Supplier bills and returns (design/screens.md S13 "Purchases"), the Stock
// area's second tab: the shared data grid like Orders, read page by page from
// the API (PURCHASE_LIST_SPEC in packages/shared purchases.ts) — chips for
// bills and returns, the filter panel (supplier, currency, period,
// payment, goods arrived), search by supplier or bill number, sort, pages, export, what the
// list shows was bought, and what the shop owes its suppliers. A bill that
// still owes has "Pay" on its row; the rest "View". A return is goods gone
// back: a minus.

/** Each kind's chip icon and pill tone. */
const KINDS = {
  purchase: { icon: ReceiptText, tone: "success" },
  return: { icon: Undo2, tone: "warning" },
} as const;
const CURRENCIES = ["USD", "KHR"] as const;

export function PurchasesScreen({
  server,
  hrefFor,
  suppliers,
  totals,
  owed,
  forSupplier = false,
  onPay,
  onReceive,
}: {
  server: DataGridServer<PurchaseRow>;
  hrefFor: (purchase: PurchaseRow) => string;
  /** Every supplier, archived ones too: old bills can be found by them. */
  suppliers: Supplier[];
  /** What the list shows was bought (null until the first page is read). */
  totals: Record<Currency, number> | null;
  /** What the shop owes its suppliers in all (null until the first page is read). */
  owed: Record<Currency, number> | null;
  /** On one supplier's page: their bills only — no supplier filter, no summary cards (the page has its own). */
  forSupplier?: boolean;
  /** A plan that follows stock: a bill that still owes gets "Pay" (else "View"). */
  onPay?: (purchase: PurchaseRow) => void;
  /** A plan that follows stock: a bill whose goods haven't arrived gets "Receive". */
  onReceive?: (purchase: PurchaseRow) => void;
}) {
  const t = useTranslations("Purchases");
  const tStock = useTranslations("Stock");
  const { title, total, billDay } = usePurchaseText();
  const router = useRouter();
  const detail = (purchase: PurchaseRow) =>
    [purchase.returnsNumber !== null ? t("returnOf", { code: title({ kind: "purchase", number: purchase.returnsNumber }) }) : purchase.billRef, t("lineCount", { count: purchase.lineCount })].filter(Boolean).join(" · ");
  const amounts = (sums: Record<Currency, number> | null) => (sums ? CURRENCIES.filter((currency) => sums[currency] !== 0).map((currency) => formatMoney(sums[currency], currency)) : []);
  const spent = amounts(totals);
  const owing = amounts(owed);
  /** What a bill still owes; a return, or a bill the supplier owes back on, shows none. */
  const owedOf = (purchase: PurchaseRow) => (purchase.payment && purchase.payment.owed > 0 ? purchase.payment.owed : 0);
  const canPay = (purchase: PurchaseRow) => Boolean(onPay) && owedOf(purchase) > 0;
  const canReceive = (purchase: PurchaseRow) => Boolean(onReceive) && purchase.kind === "purchase" && purchase.receivedAt === null;
  /**
   * What a row asks for, right from it: Receive (goods not here yet) and Pay
   * (still owes); with neither, View. The row's own tap still opens it.
   */
  const rowAction = (purchase: PurchaseRow) => (
    <span className="inline-flex flex-wrap justify-end gap-2 lg:flex-nowrap" onClick={(event) => event.stopPropagation()}>
      {canReceive(purchase) && (
        <Button size="sm" variant="secondary" onClick={() => onReceive?.(purchase)}>
          <PackageCheck className="h-4 w-4" aria-hidden="true" />
          {t("receiveRow")}
        </Button>
      )}
      {canPay(purchase) && (
        <Button size="sm" variant="primary" onClick={() => onPay?.(purchase)}>
          <Wallet className="h-4 w-4" aria-hidden="true" />
          {t("payButton")}
        </Button>
      )}
      {!canPay(purchase) && !canReceive(purchase) && (
        <Link href={hrefFor(purchase)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <Eye className="h-4 w-4" aria-hidden="true" />
          {t("viewButton")}
        </Link>
      )}
    </span>
  );

  const columns: DataGridColumn<PurchaseRow>[] = [
    {
      key: "number",
      header: t("colBill"),
      hideable: false,
      pin: "start",
      sortable: true,
      value: (purchase) => purchase.number,
      exportValue: title,
      cell: (purchase) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{title(purchase)}</p>
          <p className="truncate text-xs text-muted">
            <DataGridHighlight text={detail(purchase)} />
          </p>
        </div>
      ),
    },
    { key: "date", header: t("colDate"), sortable: true, value: (purchase) => purchase.purchasedOn, exportValue: (purchase) => purchase.purchasedOn, cell: (purchase) => <span className="whitespace-nowrap">{billDay(purchase.purchasedOn)}</span> },
    {
      key: "supplier",
      header: t("colSupplier"),
      sortable: true,
      value: (purchase) => purchase.supplierName,
      cell: (purchase) => (purchase.supplierName ? <DataGridHighlight text={purchase.supplierName} /> : <span className="text-muted">{t("noSupplier")}</span>),
    },
    {
      key: "kind",
      header: t("colKind"),
      value: (purchase) => t(`kind_${purchase.kind}`),
      cell: (purchase) => (
        <span className="flex flex-wrap gap-1">
          <StatusPill tone={KINDS[purchase.kind].tone}>{t(`kind_${purchase.kind}`)}</StatusPill>
          {/* Saved before the goods arrived: no stock from it yet. */}
          {purchase.receivedAt === null && <StatusPill tone="warning">{t("notReceivedPill")}</StatusPill>}
        </span>
      ),
    },
    {
      key: "payment",
      header: t("colPayment"),
      value: (purchase) => (purchase.payment ? t(`payment_${purchase.payment.state}`) : ""),
      cell: (purchase) => (purchase.payment ? <PaymentStatePill state={purchase.payment.state} /> : <span className="text-muted">—</span>),
    },
    {
      key: "owed",
      header: t("colOwed"),
      align: "right",
      value: owedOf,
      exportValue: (purchase) => (owedOf(purchase) > 0 ? formatMoney(owedOf(purchase), purchase.currency) : ""),
      cell: (purchase) => (owedOf(purchase) > 0 ? <span className="font-semibold tabular-nums text-warning">{formatMoney(owedOf(purchase), purchase.currency)}</span> : <span className="text-muted">—</span>),
    },
    { key: "total", header: t("colTotal"), align: "right", sortable: true, value: (purchase) => purchase.totalMinor, exportValue: total, cell: (purchase) => <span className="font-semibold tabular-nums">{total(purchase)}</span> },
    { key: "action", header: "", align: "right", hideable: false, pin: "end", exportValue: () => "", cell: rowAction },
  ];

  return (
    <>
      {/* What the list shows was bought, and what's owed in all: one slim line above it (the tiles carry the rest). */}
      {!forSupplier && (spent.length > 0 || owing.length > 0) && (
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted">
          <span>
            {t("boughtTitle")}: <span className="font-semibold tabular-nums text-fg">{spent.join(" · ") || "—"}</span>
          </span>
          <span>
            {t("owedTitle")}: <span className="font-semibold tabular-nums text-warning">{owing.join(" · ") || formatMoney(0, "USD")}</span>
          </span>
        </p>
      )}
      <DataGrid
        server={server}
        syncUrl
        rowNumbers
        getRowId={(purchase) => purchase.id}
        columns={columns}
        searchPlaceholder={t("searchPlaceholder")}
        chips={[
          ...(["purchase", "return"] as const).map((kind) => ({ value: kind, label: t(`chip_${kind}`), icon: KINDS[kind].icon })),
          { value: "not_received", label: t("chip_not_received"), icon: Clock3 },
        ]}
        filters={[
          ...(forSupplier ? [] : [{ key: "supplier", label: t("colSupplier"), options: suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })) }]),
          { key: "currency", label: tStock("filterCurrency"), options: CURRENCIES.map((currency) => ({ value: currency, label: tStock(`currency_${currency}`) })) },
          { key: "period", label: t("filterPeriod"), options: PURCHASE_PERIODS.map((period) => ({ value: period, label: t(`period_${period}`) })) },
          { key: "payment", label: t("colPayment"), options: PURCHASE_PAYMENT_FILTERS.map((state) => ({ value: state, label: t(`payment_${state}`) })) },
          { key: "goods", label: t("filterGoods"), options: GOODS_STATES.map((goods) => ({ value: goods, label: t(`goods_${goods}`) })) },
          { key: "due", label: t("filterDue"), options: PURCHASE_DUE_FILTERS.map((due) => ({ value: due, label: t(`due_${due}`) })) },
        ]}
        onRowClick={(purchase) => router.push(hrefFor(purchase))}
        initialSort={{ key: "date", direction: "desc" }}
        defaultPageSize={10}
        renderCard={(purchase) => (
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex w-full items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-semibold">
                {title(purchase)} · {purchase.supplierName ? <DataGridHighlight text={purchase.supplierName} /> : t("noSupplier")}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{total(purchase)}</span>
            </p>
            <p className="w-full truncate text-xs text-muted">
              {billDay(purchase.purchasedOn)} · <DataGridHighlight text={detail(purchase)} />
            </p>
            {purchase.payment && (
              <p className="flex flex-wrap items-center gap-2 text-xs">
                <PaymentStatePill state={purchase.payment.state} />
                {purchase.receivedAt === null && <StatusPill tone="warning">{t("notReceivedPill")}</StatusPill>}
                {owedOf(purchase) > 0 && <span className="font-semibold tabular-nums text-warning">{t("owedShort", { amount: formatMoney(owedOf(purchase), purchase.currency) })}</span>}
              </p>
            )}
          </div>
        )}
        // A card opens with a tap already: only a bill with something to do gets buttons (Receive, Pay).
        renderCardAction={(purchase) => (canPay(purchase) || canReceive(purchase) ? <div className="flex justify-end px-4 pb-3">{rowAction(purchase)}</div> : null)}
        exportFileName="purchases"
        // "-v3": 10 rows a page (2026-10-29) replaces earlier saved choices.
        storageKey="seller-purchases-v3"
        emptyTitle={t("empty")}
        emptyArt={<Mio size={80} />}
      />
    </>
  );
}
