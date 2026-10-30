"use client";

import { amountIn, type Currency, type PayablesSupplierRow, type ReportQuery } from "@khmio/shared";
import { Card, EmptyState, Mio, ProgressBar, type Tone } from "@khmio/ui";
import { AlarmClock, BarChart3, HandCoins, PieChart, Undo2, Wallet, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { CHART_COLOR, ChartCard, ChartLegend, ChartTooltipBox, compactMoney } from "@/components/home/chart-parts";
import { RingChart } from "@/components/home/ring-chart";
import { formatMoney } from "@/components/order-ui";
import { SubPage } from "@/components/seller-frame/sub-page";
import { StatusTileRow } from "@/components/status-tile-row";
import { useDateText } from "@/components/use-date-text";
import type { PayablesReport } from "@/lib/api";
import { listAddress } from "@/lib/list-address";
import { PrintButton, ReportFilters } from "./report-filters";
import { moneyLines } from "./report-money";
import { chartRows, returnRate, shareParts, tableRows, totals } from "./supplier-report";
import { PrintTable } from "./print-table";

/** The table's chips, which the tiles open too. */
const TABLE_CHIPS = ["owed", "overdue", "returns"] as const;
type TableChip = (typeof TABLE_CHIPS)[number];
const isTableChip = (chip: string): chip is TableChip => (TABLE_CHIPS as readonly string[]).includes(chip);

/** Most suppliers a chart shows (the table has them all); the share ring's own parts. */
const TOP = 8;
const SHARE_TOP = 5;
/** The share ring: one hue, darker for more (a ranking, not separate kinds), the rest in grey. */
const SHARE_SHADES = [1, 0.8, 0.62, 0.46, 0.32];

/**
 * The Suppliers report (design/screens.md S17 "Suppliers") for the bills of a
 * period: bought, returned, paid, owed and overdue — tiles the table follows
 * when tapped; the top suppliers (bought beside paid); each one's share of
 * the buying; return rates (what went back of what came — bad deliveries
 * stand out); then each supplier's bills, bought, returned, return rate,
 * paid, owed, overdue and last bill — searchable, sortable, exportable, each
 * row opening the supplier. Dollars and riel apart (the charts in the shop's
 * currency), or all in one for reading. Printable.
 */
export function SupplierReportScreen({
  report,
  query,
  onQuery,
  inOne,
  onInOne,
  mainCurrency,
  rate,
  back,
  lastBillOf,
  supplierHref,
}: {
  report: PayablesReport;
  query: ReportQuery;
  onQuery: (query: ReportQuery) => void;
  inOne: Currency | null;
  onInOne: (currency: Currency | null) => void;
  mainCurrency: Currency;
  rate: number;
  back: { href: string; label: string };
  /** Each supplier's last bill (YYYY-MM-DD), from the suppliers list. */
  lastBillOf: (supplierId: string) => string | null;
  supplierHref: (supplierId: string) => string;
}) {
  const t = useTranslations("SupplierReport");
  const tPurchases = useTranslations("Purchases");
  const tPayables = useTranslations("Payables");
  const router = useRouter();
  const { date } = useDateText();
  const [activeChip, setActiveChip] = useState<TableChip | null>(null);
  // Bumped when a tile is tapped: the table starts again from the address the tile wrote.
  const [listKey, setListKey] = useState(0);
  const sums = totals(report);
  const money = (value: Record<Currency, number>) => moneyLines(value, mainCurrency, inOne, rate);
  const rows = tableRows(report, inOne, rate);
  const charts = chartRows(report, inOne, rate, mainCurrency);
  const chartMoney = (amount: number) => formatMoney(amount, charts.currency);
  const nameOf = (row: Pick<PayablesSupplierRow, "supplierName">) => row.supplierName || tPurchases("noSupplier");
  const day = (key: string | null) => (key ? date(`${key}T12:00:00+07:00`) : "—");
  const inChip = (chip: TableChip, row: PayablesSupplierRow) => (chip === "owed" ? row.owed > 0 : chip === "overdue" ? row.overdue > 0 : row.returned > 0);

  function selectChip(chip: TableChip | null) {
    const search = listAddress(window.location.search, chip ? { chip } : null);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setActiveChip(chip);
    setListKey((key) => key + 1);
  }

  const mainRate = returnRate({ bought: sums.bought[mainCurrency], returned: sums.returned[mainCurrency] });
  const suppliersWith = (chip: TableChip) => new Set(rows.filter((row) => inChip(chip, row)).map((row) => row.supplierId ?? "none")).size;
  const tiles: { key: string; icon: LucideIcon; tone: Tone; label: string; value: ReturnType<typeof money>; count?: string; sub?: string; action?: string; chip: TableChip | null }[] = [
    { key: "bought", icon: Wallet, tone: "brand", label: t("tileBought"), value: money(sums.bought), count: t("supplierCount", { count: new Set(rows.map((row) => row.supplierId ?? "none")).size }), chip: null },
    { key: "returned", icon: Undo2, tone: "warning", label: t("tileReturned"), value: money(sums.returned), sub: mainRate !== null ? t("rateOfBought", { rate: mainRate }) : undefined, chip: "returns" },
    { key: "paid", icon: HandCoins, tone: "success", label: t("tilePaid"), value: money(sums.paid), chip: null },
    { key: "owed", icon: HandCoins, tone: "warning", label: t("tileOwed"), value: money(sums.owed), count: t("supplierCount", { count: suppliersWith("owed") }), action: suppliersWith("owed") > 0 ? t("actionSee") : undefined, chip: "owed" },
    { key: "overdue", icon: AlarmClock, tone: "danger", label: t("tileOverdue"), value: money(sums.overdue), count: t("supplierCount", { count: suppliersWith("overdue") }), action: suppliersWith("overdue") > 0 ? t("actionSee") : undefined, chip: "overdue" },
  ];

  const top = [...charts.rows].filter((row) => row.bought > 0).sort((a, b) => b.bought - a.bought).slice(0, TOP);
  const topByKey = new Map(top.map((row) => [row.key, row]));
  const share = shareParts(charts.rows, SHARE_TOP);
  const shareTotal = share.reduce((sum, part) => sum + part.bought, 0);
  const returning = charts.rows.filter((row) => row.returned > 0).sort((a, b) => (returnRate(b) ?? 0) - (returnRate(a) ?? 0)).slice(0, TOP);

  const amount = (row: PayablesSupplierRow, value: number) => (value > 0 ? formatMoney(value, row.currency) : "—");
  /** A money column sorts by its worth in the shop's currency: dollars and riel rows side by side in a sensible order (what's shown doesn't change). */
  const sortWorth = (row: PayablesSupplierRow, value: number) => amountIn(value, row.currency, mainCurrency, rate);
  const columns: DataGridColumn<PayablesSupplierRow>[] = [
    { key: "supplier", header: tPurchases("colSupplier"), hideable: false, pin: "start", sortable: true, value: nameOf, cell: (row) => <span className="block max-w-52 truncate font-medium"><DataGridHighlight text={nameOf(row)} /></span> },
    { key: "currency", header: tPayables("colCurrency"), defaultHidden: inOne !== null, value: (row) => row.currency, cell: (row) => row.currency },
    { key: "bills", header: tPayables("colBills"), align: "right", sortable: true, value: (row) => row.billCount, cell: (row) => <span className="tabular-nums">{row.billCount}</span> },
    { key: "bought", header: tPayables("colBought"), align: "right", sortable: true, value: (row) => sortWorth(row, row.bought), exportValue: (row) => formatMoney(row.bought, row.currency), cell: (row) => <span className="font-semibold tabular-nums">{amount(row, row.bought)}</span> },
    { key: "returned", header: t("colReturned"), align: "right", sortable: true, value: (row) => sortWorth(row, row.returned), exportValue: (row) => formatMoney(row.returned, row.currency), cell: (row) => <span className={row.returned > 0 ? "tabular-nums text-warning" : "tabular-nums text-muted"}>{amount(row, row.returned)}</span> },
    { key: "rate", header: t("colRate"), align: "right", sortable: true, value: (row) => returnRate(row) ?? -1, exportValue: (row) => (returnRate(row) === null ? "" : `${returnRate(row)}%`), cell: (row) => <span className="tabular-nums">{row.returned > 0 ? `${returnRate(row)}%` : "—"}</span> },
    { key: "paid", header: tPayables("colPaid"), align: "right", sortable: true, value: (row) => sortWorth(row, row.paid), exportValue: (row) => formatMoney(row.paid, row.currency), cell: (row) => <span className="tabular-nums">{amount(row, row.paid)}</span> },
    { key: "owed", header: tPayables("colOwed"), align: "right", sortable: true, value: (row) => sortWorth(row, row.owed), exportValue: (row) => formatMoney(row.owed, row.currency), cell: (row) => <span className={row.owed > 0 ? "font-semibold tabular-nums text-warning" : "tabular-nums text-muted"}>{amount(row, row.owed)}</span> },
    { key: "overdue", header: tPayables("colOverdue"), align: "right", sortable: true, value: (row) => sortWorth(row, row.overdue), exportValue: (row) => formatMoney(row.overdue, row.currency), cell: (row) => <span className={row.overdue > 0 ? "font-semibold tabular-nums text-danger" : "tabular-nums text-muted"}>{amount(row, row.overdue)}</span> },
    { key: "lastBill", header: tPurchases("colLastBill"), defaultHidden: true, sortable: true, value: (row) => (row.supplierId ? (lastBillOf(row.supplierId) ?? "") : ""), cell: (row) => <span className="whitespace-nowrap">{day(row.supplierId ? lastBillOf(row.supplierId) : null)}</span> },
  ];

  return (
    <SubPage width="page" back={back} title={t("title")} description={t("description")} actions={<PrintButton />}>
      <ReportFilters query={query} onQuery={onQuery} firstDay={report.days?.from ?? report.series[0]?.key} inOne={inOne} onInOne={onInOne} mainCurrency={mainCurrency} rate={rate} />
      <p className="hidden text-sm print:block">{report.days ? t("printedPeriod", { from: day(report.days.from), to: day(report.days.to) }) : t("printedAll")}</p>

      {rows.length === 0 ? (
        <Card className="p-4">
          <EmptyState art={<Mio size={80} />} title={t("empty")} />
        </Card>
      ) : (
        <>
          {/* The figures: tapped, the supplier table follows. */}
          <StatusTileRow label={t("title")} tiles={tiles.map(({ value, sub, ...tile }) => ({ ...tile, amount: value.main, sub: value.other ?? sub, view: tile.chip }))} active={activeChip} onSelect={selectChip} />
          {!inOne && report.suppliers.some((row) => row.currency !== mainCurrency) && <p className="text-xs text-muted">{t("chartsInMain", { currency: mainCurrency === "USD" ? "$" : "៛" })}</p>}

          <ChartCard icon={BarChart3} title={t("topTitle")} subtitle={t("topHint")}>
            {top.length === 0 ? (
              <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("nothingBought")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="w-full" style={{ height: Math.max(160, top.length * 44) }} role="img" aria-label={t("topTitle")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barGap={2}>
                      <CartesianGrid horizontal={false} stroke={CHART_COLOR.grid} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} tickFormatter={(value: number) => compactMoney(value, charts.currency)} />
                      <YAxis type="category" dataKey="key" width={120} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} tickFormatter={(key: string) => { const row = topByKey.get(key); const name = row ? nameOf(row) : ""; return name.length > 16 ? `${name.slice(0, 15)}…` : name; }} />
                      <Tooltip
                        cursor={{ fill: CHART_COLOR.mainSoft, opacity: 0.4 }}
                        content={({ active, label: key }) => {
                          const row = active && typeof key === "string" ? topByKey.get(key) : undefined;
                          if (!row) return null;
                          return (
                            <ChartTooltipBox
                              title={nameOf(row)}
                              rows={[
                                { color: CHART_COLOR.main, label: tPayables("colBought"), value: chartMoney(row.bought) },
                                { color: CHART_COLOR.neutral, label: tPayables("colPaid"), value: chartMoney(row.paid) },
                              ]}
                            />
                          );
                        }}
                      />
                      <Bar dataKey="bought" fill={CHART_COLOR.main} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
                      <Bar dataKey="paid" fill={CHART_COLOR.neutral} radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ChartLegend
                  items={[
                    { color: CHART_COLOR.main, label: tPayables("colBought") },
                    { color: CHART_COLOR.neutral, label: tPayables("colPaid") },
                  ]}
                />
              </div>
            )}
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard icon={PieChart} title={t("shareTitle")} subtitle={t("shareHint")}>
              {share.length === 0 ? (
                <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("nothingBought")}</p>
              ) : (
                <RingChart
                  label={t("shareTitle")}
                  center={{ label: tPayables("colBought"), value: chartMoney(shareTotal) }}
                  parts={share.map((part, index) => ({
                    key: part.key,
                    label: part.others ? t("others") : part.supplierName || tPurchases("noSupplier"),
                    amount: part.bought,
                    color: part.others ? CHART_COLOR.neutral : `rgb(var(--color-brand) / ${SHARE_SHADES[index] ?? 0.3})`,
                    // A sliver still shows: "<1%", never "0%".
                    text: Math.round((part.bought / shareTotal) * 100) === 0 ? "<1%" : `${Math.round((part.bought / shareTotal) * 100)}%`,
                  }))}
                />
              )}
            </ChartCard>
            <ChartCard icon={Undo2} title={t("returnsTitle")} subtitle={t("returnsHint")}>
              {returning.length === 0 ? (
                <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noReturns")}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {returning.map((row) => (
                    <li key={row.key} className="flex flex-col gap-1">
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{nameOf(row)}</span>
                        <span className="flex items-baseline gap-2">
                          <span className="text-xs text-muted tabular-nums">{chartMoney(row.returned)}</span>
                          <span className="font-semibold tabular-nums text-warning">{returnRate(row)}%</span>
                        </span>
                      </span>
                      <ProgressBar value={returnRate(row) ?? 0} max={100} size="sm" tone="warning" label={`${nameOf(row)}: ${returnRate(row)}%`} />
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t("tableTitle")}</h2>
            <div className="print:hidden">
              <DataGrid
                key={listKey}
                syncUrl
                onViewChange={({ chip }) => setActiveChip(isTableChip(chip) ? chip : null)}
                rows={rows}
                getRowId={(row) => row.key}
                columns={columns}
                searchText={nameOf}
                searchPlaceholder={tPayables("searchSupplier")}
                chips={TABLE_CHIPS.map((chip) => ({ value: chip, label: t(`chip_${chip}`), predicate: (row: PayablesSupplierRow) => inChip(chip, row) }))}
                onRowClick={(row) => {
                  if (row.supplierId) router.push(supplierHref(row.supplierId));
                }}
                initialSort={{ key: "bought", direction: "desc" }}
                defaultPageSize={10}
                renderCard={(row) => (
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex w-full items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold">
                        <DataGridHighlight text={nameOf(row)} />
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatMoney(row.bought, row.currency)}</span>
                    </p>
                    <p className="w-full truncate text-xs text-muted">
                      {[tPayables("billCount", { count: row.billCount }), tPayables("paidShort", { amount: formatMoney(row.paid, row.currency) }), row.returned > 0 ? t("returnedShort", { amount: formatMoney(row.returned, row.currency), rate: returnRate(row) ?? 0 }) : ""].filter(Boolean).join(" · ")}
                    </p>
                    {(row.owed > 0 || row.overdue > 0) && (
                      <p className="flex flex-wrap gap-2 text-xs">
                        {row.owed > 0 && <span className="font-semibold text-warning">{tPurchases("owedShort", { amount: formatMoney(row.owed, row.currency) })}</span>}
                        {row.overdue > 0 && <span className="font-semibold text-danger">{tPayables("overdueShort", { amount: formatMoney(row.overdue, row.currency) })}</span>}
                      </p>
                    )}
                  </div>
                )}
                exportFileName="supplier-report"
                storageKey="seller-supplier-report-v1"
                emptyTitle={t("empty")}
              />
            </div>
            <PrintTable columns={columns} rows={rows} getRowId={(row) => row.key} />
          </section>
        </>
      )}
    </SubPage>
  );
}
