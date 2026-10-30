"use client";

import { payablesInOne, phnomPenhDay, PURCHASE_PERIODS, type Currency, type GoodsState, type PayablesCurrencyReport, type ReportQuery, type PurchasePaymentState } from "@khmio/shared";
import { Card, EmptyState, Mio, ProgressBar, StatCard } from "@khmio/ui";
import { AlarmClock, CalendarClock, HandCoins, PackageOpen, PieChart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { ChartCard } from "@/components/home/chart-parts";
import { PrintButton, ReportFilters } from "@/components/reports/report-filters";
import { PayablesRing } from "@/components/home/payables-ring";
import { formatMoney } from "@/components/order-ui";
import { SubPage } from "@/components/seller-frame/sub-page";
import type { PayablesReport, PayablesSupplierRow } from "@/lib/api";
import { BoughtPaidChart, moneyOf, PayablesAgeing, PayablesStatusTable } from "./payables-parts";
import { usePurchaseText } from "./use-purchase-text";
import { PrintTable } from "@/components/reports/print-table";

/** What one block of the report draws: a currency's bills, or all of them converted into one. */
interface PayablesView {
  currency: Currency;
  report: PayablesCurrencyReport;
  series: { key: string; bought: number; paid: number }[];
  /** Converted at the shop's rate: approximate. */
  converted: boolean;
}

/** The periods the Purchases list filters by too, so the status numbers link there exactly. */
const LIST_PERIODS: readonly string[] = PURCHASE_PERIODS;

/**
 * Bills & payables (design/screens.md S17; GET /purchases/report): the usual
 * accounts-payable report for the bills of a period — today, 7 or 30 days,
 * every bill, or from one day to another. For each currency, or all of them
 * converted into one at the shop's rate (for reading only): what's owed,
 * overdue, due within 7 days, bills whose goods haven't arrived, how much of
 * what was bought is paid; what was bought and paid day by day (month by
 * month for long ranges); the ring of paid, not due and overdue; how late;
 * each payment standing against the goods. Then the same by supplier —
 * searchable, sortable, exportable. Printable on A4.
 */
export function PayablesReportScreen({
  report,
  query,
  onQuery,
  inOne,
  onInOne,
  mainCurrency,
  rate,
  back,
  purchasesHref,
  supplierHref,
}: {
  report: PayablesReport;
  query: ReportQuery;
  onQuery: (query: ReportQuery) => void;
  /** Everything shown in this currency; null: each currency apart. */
  inOne: Currency | null;
  onInOne: (currency: Currency | null) => void;
  /** Leads when the shop has bills in both currencies. */
  mainCurrency: Currency;
  /** The shop's riel per $1, for "in one currency". */
  rate: number;
  back: { href: string; label: string };
  /** The Purchases list with these filters (a status number). */
  purchasesHref: (filters: Record<string, string>) => string;
  supplierHref: (supplierId: string) => string;
}) {
  const t = useTranslations("Payables");
  const tPurchases = useTranslations("Purchases");
  const tReports = useTranslations("Reports");
  const router = useRouter();
  const { billDay } = usePurchaseText();
  const today = phnomPenhDay(new Date());

  const one = inOne ? payablesInOne(report, inOne, rate) : null;
  const views: PayablesView[] = one
    ? [{ currency: one.currency, report: one.report, series: one.series, converted: true }]
    : ([mainCurrency, mainCurrency === "USD" ? "KHR" : "USD"] as const)
        .filter((currency) => report.currencies[currency].figures.billCount > 0)
        .map((currency) => ({ currency, report: report.currencies[currency], series: report.series.map((point) => ({ key: point.key, bought: point.bought[currency], paid: point.paid[currency] })), converted: false }));
  const suppliers = one ? one.suppliers : report.suppliers;
  const money = (row: PayablesSupplierRow, amount: number) => (amount > 0 ? formatMoney(amount, row.currency) : "—");
  const supplierName = (row: PayablesSupplierRow) => row.supplierName || tPurchases("noSupplier");
  const rateText = tReports("rateNote", { rate: rate.toLocaleString("en-US") });

  const listHref = (view: PayablesView) => (state: PurchasePaymentState, goods: GoodsState) =>
    purchasesHref({ "f.payment": state, "f.goods": goods, ...(view.converted ? {} : { "f.currency": view.currency }), ...(LIST_PERIODS.includes(query.period) ? { "f.period": query.period } : {}) });
  // What a status number's list can't narrow to.
  const linkNote = [query.period === "custom" ? t("linkNoteCustom") : "", one ? t("linkNoteOne") : ""].filter(Boolean).join(" ") || undefined;

  const columns: DataGridColumn<PayablesSupplierRow>[] = [
    { key: "supplier", header: tPurchases("colSupplier"), hideable: false, pin: "start", sortable: true, value: supplierName, cell: (row) => <DataGridHighlight text={supplierName(row)} /> },
    { key: "currency", header: t("colCurrency"), value: (row) => row.currency, cell: (row) => row.currency },
    { key: "bills", header: t("colBills"), align: "right", sortable: true, value: (row) => row.billCount, cell: (row) => <span className="tabular-nums">{row.billCount}</span> },
    { key: "bought", header: t("colBought"), align: "right", sortable: true, value: (row) => row.bought, exportValue: (row) => formatMoney(row.bought, row.currency), cell: (row) => <span className="tabular-nums">{money(row, row.bought)}</span> },
    { key: "paid", header: t("colPaid"), align: "right", sortable: true, value: (row) => row.paid, exportValue: (row) => formatMoney(row.paid, row.currency), cell: (row) => <span className="tabular-nums">{money(row, row.paid)}</span> },
    {
      key: "owed",
      header: t("colOwed"),
      align: "right",
      sortable: true,
      value: (row) => row.owed,
      exportValue: (row) => formatMoney(row.owed, row.currency),
      cell: (row) => (
        <span className="flex flex-col items-end gap-1">
          <span className={row.owed > 0 ? "font-semibold tabular-nums text-warning" : "tabular-nums text-muted"}>{money(row, row.owed)}</span>
          {/* How much of what was bought is still owed. */}
          {row.owed > 0 && row.bought > 0 && <ProgressBar value={row.owed} max={row.bought} size="sm" tone={row.overdue > 0 ? "danger" : "warning"} label={t("owedShare", { owed: money(row, row.owed), bought: money(row, row.bought) })} className="w-20" />}
        </span>
      ),
    },
    {
      key: "overdue",
      header: t("colOverdue"),
      align: "right",
      sortable: true,
      value: (row) => row.overdue,
      exportValue: (row) => formatMoney(row.overdue, row.currency),
      cell: (row) => <span className={row.overdue > 0 ? "font-semibold tabular-nums text-danger" : "tabular-nums text-muted"}>{money(row, row.overdue)}</span>,
    },
    { key: "notReceived", header: t("colNotReceived"), align: "right", sortable: true, value: (row) => row.notReceived.count, cell: (row) => <span className="tabular-nums">{row.notReceived.count || "—"}</span> },
  ];

  return (
    <SubPage
      width="page"
      back={back}
      title={t("title")}
      description={t("description")}
      actions={<PrintButton />}
    >
      {/* Which bills, and in which currency (shared by every report). */}
      <ReportFilters query={query} onQuery={onQuery} firstDay={report.days?.from} inOne={inOne} onInOne={onInOne} mainCurrency={mainCurrency} rate={rate} />

      {/* On paper: which bills, as of when, in which currency. */}
      <p className="hidden text-sm print:block">
        {report.days ? t("printedPeriod", { from: billDay(report.days.from), to: billDay(report.days.to) }) : t("printedAll")} · {t("printedOn", { day: billDay(today) })}
        {inOne ? ` · ${rateText}` : ""}
      </p>

      {views.length === 0 ? (
        <Card className="p-4">
          <EmptyState art={<Mio size={80} />} title={t("empty")} />
        </Card>
      ) : (
        views.map((view) => {
          const { figures } = view.report;
          // "≈" stays with its amount: a non-breaking space between them.
          const full = (amount: number) => `${view.converted ? "≈\u00a0" : ""}${formatMoney(amount, view.currency)}`;
          const chartMoney = moneyOf(view.currency, formatMoney);
          return (
            <section key={view.currency} className="flex flex-col gap-4 print:break-inside-avoid" aria-label={view.currency}>
              {views.length > 1 && <h2 className="text-sm font-semibold text-muted">{t(view.currency === "USD" ? "inDollars" : "inRiel")}</h2>}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={HandCoins} tone="warning" label={t("owedLabel")} value={full(figures.owed)} detail={t("billCount", { count: figures.billCount })} />
                <StatCard icon={AlarmClock} tone="danger" label={t("overdueLabel")} value={full(figures.overdue)} />
                <StatCard icon={CalendarClock} tone="info" label={t("dueSoonLabel")} value={full(figures.dueSoon)} />
                <StatCard icon={PackageOpen} tone="warning" label={t("notReceivedLabel")} value={t("billCount", { count: figures.notReceived.count })} detail={full(figures.notReceived.bought)} />
              </div>
              <Card className="flex flex-col gap-2 p-4">
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span>{t("paidOfBought", { paid: full(figures.paid), bought: full(figures.bought) })}</span>
                  <span className="font-semibold tabular-nums">{figures.bought > 0 ? `${Math.round((figures.paid / figures.bought) * 100)}%` : "—"}</span>
                </p>
                <ProgressBar value={figures.paid} max={figures.bought} tone="success" label={t("paidOfBought", { paid: full(figures.paid), bought: full(figures.bought) })} />
              </Card>
              <BoughtPaidChart series={view.series} unit={report.unit} money={{ ...chartMoney, full }} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard icon={PieChart} title={t("ringTitle")} subtitle={t("ringHint")}>
                  <PayablesRing figures={figures} money={full} />
                </ChartCard>
                <PayablesAgeing ageing={view.report.ageing} owed={figures.owed} money={full} />
              </div>
              <PayablesStatusTable status={view.report.status} money={full} hrefFor={listHref(view)} note={linkNote} />
            </section>
          );
        })
      )}

      {suppliers.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t("bySupplier")}</h2>
          <div className="print:hidden">
            <DataGrid
              rows={suppliers}
              getRowId={(row) => row.key}
              columns={columns}
              searchText={supplierName}
              searchPlaceholder={t("searchSupplier")}
              onRowClick={(row) => {
                if (row.supplierId) router.push(supplierHref(row.supplierId));
              }}
              initialSort={{ key: "owed", direction: "desc" }}
              defaultPageSize={10}
              renderCard={(row) => (
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="flex w-full items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">
                      <DataGridHighlight text={supplierName(row)} />
                    </span>
                    <span className={row.owed > 0 ? "shrink-0 font-semibold tabular-nums text-warning" : "shrink-0 tabular-nums text-muted"}>{formatMoney(row.owed, row.currency)}</span>
                  </p>
                  <p className="w-full truncate text-xs text-muted">
                    {[t("billCount", { count: row.billCount }), t("boughtShort", { amount: formatMoney(row.bought, row.currency) }), t("paidShort", { amount: formatMoney(row.paid, row.currency) })].join(" · ")}
                  </p>
                  {row.owed > 0 && row.bought > 0 && <ProgressBar value={row.owed} max={row.bought} size="sm" tone={row.overdue > 0 ? "danger" : "warning"} label={t("owedShare", { owed: money(row, row.owed), bought: money(row, row.bought) })} />}
                  {(row.overdue > 0 || row.notReceived.count > 0) && (
                    <p className="flex flex-wrap gap-2 text-xs">
                      {row.overdue > 0 && <span className="font-semibold text-danger">{t("overdueShort", { amount: formatMoney(row.overdue, row.currency) })}</span>}
                      {row.notReceived.count > 0 && <span className="font-semibold text-warning">{t("notReceivedShort", { count: row.notReceived.count })}</span>}
                    </p>
                  )}
                </div>
              )}
              exportFileName="payables"
              storageKey="seller-payables-v2"
              emptyTitle={t("empty")}
            />
          </div>
          <PrintTable columns={columns} rows={suppliers} getRowId={(row) => row.key} />
        </section>
      )}
    </SubPage>
  );
}
