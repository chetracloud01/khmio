"use client";

import type { Currency, ReportQuery } from "@khmio/shared";
import { Card, EmptyState, Mio, ProgressBar, type Tone } from "@khmio/ui";
import { ArrowDownLeft, ArrowUpRight, BarChart3, Coins, Hourglass, PieChart, Tags, TriangleAlert, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { CHART_COLOR, ChartCard, ChartLegend, ChartTooltipBox } from "@/components/home/chart-parts";
import { RingChart } from "@/components/home/ring-chart";
import { SubPage } from "@/components/seller-frame/sub-page";
import { StatusTileRow } from "@/components/status-tile-row";
import { itemName } from "@/components/stock/item-name";
import { useDateText } from "@/components/use-date-text";
import type { StockReport } from "@/lib/api";
import { listAddress } from "@/lib/list-address";
import { PrintButton, ReportFilters } from "./report-filters";
import { moneyLines, oneAmount } from "./report-money";
import { PrintTable } from "./print-table";

type Row = StockReport["rows"][number];
type Money = Record<Currency, number>;

/** The item table's chips, which the tiles open too. */
const TABLE_CHIPS = ["in", "out", "low", "slow"] as const;
type TableChip = (typeof TABLE_CHIPS)[number];
const isTableChip = (chip: string): chip is TableChip => (TABLE_CHIPS as readonly string[]).includes(chip);

/** Most rows a chart's list shows (the table has them all). */
const TOP = 8;

/**
 * The stock report (design/screens.md S17 "Stock"; the ERP stock movement
 * summary) for a period: the shelf's worth now, what went in and out (units,
 * and their worth at today's cost), items out or low, and slow movers — tiles
 * the item table follows when tapped; units in and out day by day (month by
 * month for long ranges); why stock went in and down; the worth by category;
 * the levels as a ring; then each item's opening, in, out and closing —
 * searchable, sortable, exportable, each row opening the item. Dollars and
 * riel apart, or in one currency for reading. Printable.
 */
export function StockReportScreen({
  report,
  query,
  onQuery,
  inOne,
  onInOne,
  mainCurrency,
  rate,
  back,
  categoryName,
  itemHref,
}: {
  report: StockReport;
  query: ReportQuery;
  onQuery: (query: ReportQuery) => void;
  inOne: Currency | null;
  onInOne: (currency: Currency | null) => void;
  mainCurrency: Currency;
  rate: number;
  back: { href: string; label: string };
  categoryName: (categoryId: string) => string;
  itemHref: (variantId: string) => string;
}) {
  const t = useTranslations("StockReport");
  const tStock = useTranslations("Stock");
  const locale = useLocale();
  const router = useRouter();
  const { day, monthYear, date } = useDateText();
  const [activeChip, setActiveChip] = useState<TableChip | null>(null);
  // Bumped when a tile is tapped: the table starts again from the address the tile wrote.
  const [listKey, setListKey] = useState(0);
  const money = (value: Money, sign = false) => moneyLines(value, mainCurrency, inOne, rate, sign);
  const nameOf = (row: Pick<Row, "titleKm" | "titleEn" | "optionKm" | "optionEn">) => itemName(locale, row);
  const slow = new Set(report.slowMovers.map((entry) => entry.variantId));
  const kindLabel = (kind: string) => (kind === "bought" || kind === "sold" ? tStock(`historyKind_${kind}`) : tStock(`reason_${kind}`));
  const label = (key: string) => (report.unit === "day" ? day(key) : monthYear(key));
  const byKey = new Map(report.series.map((point) => [point.key, point]));
  const hasBars = report.series.some((point) => point.in > 0 || point.out > 0);
  const inChip = (chip: TableChip, row: Row) => (chip === "in" ? row.in > 0 : chip === "out" ? row.out > 0 : chip === "low" ? row.onHand !== null && (row.onHand === 0 || row.low) : slow.has(row.variantId));

  function selectChip(chip: TableChip | null) {
    const search = listAddress(window.location.search.replace(/^\?/, ""), chip ? { chip } : null);
    // The period stays: only the table's own parameters change.
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setActiveChip(chip);
    setListKey((key) => key + 1);
  }

  const value = money(report.figures.value);
  const inValue = money(report.figures.inValue);
  const outValue = money(report.figures.outValue);
  const tiles: { key: string; icon: LucideIcon; tone: Tone; label: string; amount: string; count?: string; sub?: string; action?: string; chip: TableChip | null }[] = [
    { key: "value", icon: Coins, tone: "brand", label: t("tileValue"), amount: value.main, sub: value.other ?? (report.figures.withoutCost > 0 ? tStock("withoutCost", { count: report.figures.withoutCost }) : undefined), chip: null },
    { key: "in", icon: ArrowDownLeft, tone: "success", label: t("tileIn"), amount: t("units", { count: report.figures.inUnits }), sub: inValue.main, chip: "in" },
    { key: "out", icon: ArrowUpRight, tone: "info", label: t("tileOut"), amount: t("units", { count: report.figures.outUnits }), sub: outValue.main, chip: "out" },
    { key: "low", icon: TriangleAlert, tone: "warning", label: t("tileLow"), amount: tStock("itemsCount", { count: report.levels.out + report.levels.low }), count: report.levels.out > 0 ? t("outCount", { count: report.levels.out }) : undefined, action: report.levels.out + report.levels.low > 0 ? t("actionSee") : undefined, chip: "low" },
    { key: "slow", icon: Hourglass, tone: "muted", label: t("tileSlow"), amount: tStock("itemsCount", { count: report.slowMovers.length }), action: report.slowMovers.length > 0 ? t("actionSee") : undefined, chip: "slow" },
  ];

  const columns: DataGridColumn<Row>[] = [
    {
      key: "item",
      header: tStock("colItem"),
      hideable: false,
      pin: "start",
      sortable: true,
      value: nameOf,
      cell: (row) => (
        <div className="min-w-0 max-w-64">
          <p className="truncate font-medium">
            <DataGridHighlight text={nameOf(row)} />
          </p>
          <p className="truncate text-xs text-muted">
            <DataGridHighlight text={row.sku} />
          </p>
        </div>
      ),
    },
    { key: "category", header: tStock("colCategory"), defaultHidden: true, sortable: true, value: (row) => categoryName(row.categoryId), cell: (row) => <span className="whitespace-nowrap text-muted">{categoryName(row.categoryId) || "—"}</span> },
    { key: "opening", header: t("colOpening"), align: "right", sortable: true, value: (row) => row.opening, cell: (row) => <span className="tabular-nums">{row.opening}</span> },
    { key: "in", header: t("colIn"), align: "right", sortable: true, value: (row) => row.in, cell: (row) => <span className={row.in > 0 ? "font-semibold tabular-nums text-success" : "tabular-nums text-muted"}>{row.in > 0 ? `+${row.in}` : "—"}</span> },
    { key: "out", header: t("colOut"), align: "right", sortable: true, value: (row) => row.out, cell: (row) => <span className={row.out > 0 ? "font-semibold tabular-nums text-danger" : "tabular-nums text-muted"}>{row.out > 0 ? `−${row.out}` : "—"}</span> },
    { key: "closing", header: t("colClosing"), align: "right", sortable: true, value: (row) => row.closing, cell: (row) => <span className="font-semibold tabular-nums">{row.closing}</span> },
    {
      key: "value",
      header: t("colValue"),
      align: "right",
      sortable: true,
      value: (row) => row.value?.amount ?? -1,
      exportValue: (row) => (row.value ? oneAmount(row.value.amount, row.value.currency, inOne, rate) : ""),
      cell: (row) => <span className="tabular-nums">{row.value ? oneAmount(row.value.amount, row.value.currency, inOne, rate) : "—"}</span>,
    },
  ];

  const kindsDown = report.kinds.filter((kind) => kind.direction === "out");
  const kindsUp = report.kinds.filter((kind) => kind.direction === "in");
  const mostUnits = Math.max(1, ...report.kinds.map((kind) => kind.units));
  const categories = report.byCategory.filter((entry) => entry.units > 0).slice(0, TOP);
  const mostWorth = Math.max(1, ...categories.map((entry) => entry.value[mainCurrency] || entry.value[mainCurrency === "USD" ? "KHR" : "USD"]));
  const kindList = (kinds: typeof report.kinds, tone: "success" | "danger" | "info") =>
    kinds.length === 0 ? (
      <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("nothingMoved")}</p>
    ) : (
      <ul className="flex flex-col gap-3">
        {kinds.map((kind) => {
          const worth = money(kind.value);
          return (
            <li key={`${kind.direction}:${kind.kind}`} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span>{kindLabel(kind.kind)}</span>
                <span className="flex items-baseline gap-2">
                  {/* No cost known: its worth isn't written as nothing. */}
                  {(kind.value.USD !== 0 || kind.value.KHR !== 0) && <span className="text-xs text-muted tabular-nums">{worth.main}</span>}
                  <span className="font-semibold tabular-nums">{t("units", { count: kind.units })}</span>
                </span>
              </span>
              <ProgressBar value={kind.units} max={mostUnits} size="sm" tone={tone} label={`${kindLabel(kind.kind)}: ${t("units", { count: kind.units })}`} />
            </li>
          );
        })}
      </ul>
    );

  return (
    <SubPage width="page" back={back} title={t("title")} description={t("description")} actions={<PrintButton />}>
      <ReportFilters query={query} onQuery={onQuery} firstDay={report.days?.from ?? report.series[0]?.key} inOne={inOne} onInOne={onInOne} mainCurrency={mainCurrency} rate={rate} />
      {/* On paper: which days, as of when. */}
      <p className="hidden text-sm print:block">{report.days ? t("printedPeriod", { from: date(`${report.days.from}T12:00:00+07:00`), to: date(`${report.days.to}T12:00:00+07:00`) }) : t("printedAll")}</p>

      {report.rows.length === 0 ? (
        <Card className="p-4">
          <EmptyState art={<Mio size={80} />} title={t("empty")} />
        </Card>
      ) : (
        <>
          {/* The figures: tapped, the item table follows. */}
          <StatusTileRow label={t("title")} tiles={tiles.map((tile) => ({ ...tile, view: tile.chip }))} active={activeChip} onSelect={selectChip} />

          <ChartCard icon={BarChart3} title={t("flowTitle")} subtitle={t(report.unit === "day" ? "byDay" : "byMonth")}>
            {hasBars ? (
              <div className="flex flex-col gap-2">
                <div className="h-56 w-full" role="img" aria-label={t("flowTitle")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                      <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
                      <XAxis dataKey="key" tickFormatter={label} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                      <YAxis tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: CHART_COLOR.mainSoft, opacity: 0.4 }}
                        content={({ active, label: key }) => {
                          const point = active && typeof key === "string" ? byKey.get(key) : undefined;
                          if (!point) return null;
                          return (
                            <ChartTooltipBox
                              title={label(point.key)}
                              rows={[
                                { color: CHART_COLOR.main, label: t("tileIn"), value: t("units", { count: point.in }) },
                                { color: CHART_COLOR.neutral, label: t("tileOut"), value: t("units", { count: point.out }) },
                              ]}
                            />
                          );
                        }}
                      />
                      <Bar dataKey="in" fill={CHART_COLOR.main} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                      <Bar dataKey="out" fill={CHART_COLOR.neutral} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ChartLegend
                  items={[
                    { color: CHART_COLOR.main, label: t("tileIn") },
                    { color: CHART_COLOR.neutral, label: t("tileOut") },
                  ]}
                />
              </div>
            ) : (
              <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("nothingMoved")}</p>
            )}
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard icon={ArrowUpRight} title={t("downTitle")} subtitle={t("downHint")}>
              {kindList(kindsDown, "danger")}
            </ChartCard>
            <ChartCard icon={ArrowDownLeft} title={t("upTitle")} subtitle={t("downHint")}>
              {kindList(kindsUp, "success")}
            </ChartCard>
            <ChartCard icon={Tags} title={t("categoryTitle")} subtitle={t("categoryHint")}>
              {categories.length === 0 ? (
                <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("nothingOnShelf")}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {categories.map((entry) => {
                    const worth = money(entry.value);
                    return (
                      <li key={entry.categoryId} className="flex flex-col gap-1">
                        <span className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">{categoryName(entry.categoryId) || "—"}</span>
                          <span className="flex items-baseline gap-2">
                            <span className="text-xs text-muted tabular-nums">{t("units", { count: entry.units })}</span>
                            <span className="font-semibold tabular-nums">{worth.main}</span>
                          </span>
                        </span>
                        <ProgressBar value={entry.value[mainCurrency] || entry.value[mainCurrency === "USD" ? "KHR" : "USD"]} max={mostWorth} size="sm" label={categoryName(entry.categoryId)} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </ChartCard>
            <ChartCard icon={PieChart} title={t("levelsTitle")} subtitle={t("levelsHint")}>
              <RingChart
                label={t("levelsTitle")}
                center={{ label: t("tracked"), value: tStock("itemsCount", { count: report.levels.out + report.levels.low + report.levels.ok }) }}
                parts={[
                  { key: "ok", label: tStock("chip_ok"), amount: report.levels.ok, color: CHART_COLOR.main, text: String(report.levels.ok) },
                  { key: "low", label: tStock("chip_low"), amount: report.levels.low, color: "rgb(var(--color-warning))", text: String(report.levels.low) },
                  { key: "out", label: tStock("chip_out"), amount: report.levels.out, color: CHART_COLOR.danger, text: String(report.levels.out), alert: true },
                  { key: "untracked", label: tStock("chip_untracked"), amount: report.levels.untracked, color: CHART_COLOR.neutral, text: String(report.levels.untracked) },
                ]}
              />
            </ChartCard>
          </div>

          <ChartCard icon={Hourglass} title={t("slowTitle")} subtitle={t("slowHint")} link={report.slowMovers.length > TOP ? { href: "#items", label: t("seeAll", { count: report.slowMovers.length }) } : undefined}>
            {report.slowMovers.length === 0 ? (
              <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noSlow")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {report.slowMovers.slice(0, TOP).map((entry) => (
                  <li key={entry.variantId}>
                    <button type="button" onClick={() => router.push(itemHref(entry.variantId))} className="flex min-h-touch w-full items-center justify-between gap-3 py-2 text-left hover:bg-border/20">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{nameOf(entry)}</span>
                        <span className="block text-xs text-muted">{entry.lastSoldOn ? t("lastSold", { day: date(`${entry.lastSoldOn}T12:00:00+07:00`) }) : t("neverSold")}</span>
                      </span>
                      <span className="shrink-0 text-right text-sm">
                        <span className="block font-semibold tabular-nums">{entry.value ? oneAmount(entry.value.amount, entry.value.currency, inOne, rate) : "—"}</span>
                        <span className="block text-xs text-muted">{t("units", { count: entry.onHand })}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>

          <section id="items" className="flex scroll-mt-20 flex-col gap-3">
            <h2 className="text-base font-semibold">{t("itemsTitle")}</h2>
            <div className="print:hidden">
              <DataGrid
                key={listKey}
                syncUrl
                onViewChange={({ chip }) => setActiveChip(isTableChip(chip) ? chip : null)}
                rows={report.rows}
                getRowId={(row) => row.variantId}
                columns={columns}
                searchText={(row) => `${row.titleKm} ${row.titleEn} ${row.optionKm} ${row.optionEn} ${row.sku}`}
                searchPlaceholder={tStock("searchItems")}
                chips={TABLE_CHIPS.map((chip) => ({ value: chip, label: t(`chip_${chip}`), predicate: (row: Row) => inChip(chip, row) }))}
                onRowClick={(row) => router.push(itemHref(row.variantId))}
                initialSort={{ key: "out", direction: "desc" }}
                defaultPageSize={10}
                renderCard={(row) => (
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex w-full items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold">
                        <DataGridHighlight text={nameOf(row)} />
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{row.closing}</span>
                    </p>
                    <p className="w-full truncate text-xs text-muted tabular-nums">{t("cardFlow", { opening: row.opening, in: row.in, out: row.out, closing: row.closing })}</p>
                    {row.value && <p className="text-xs text-muted">{oneAmount(row.value.amount, row.value.currency, inOne, rate)}</p>}
                  </div>
                )}
                exportFileName="stock-report"
                storageKey="seller-stock-report-v1"
                emptyTitle={t("empty")}
              />
            </div>
            <PrintTable columns={columns} rows={report.rows} getRowId={(row) => row.variantId} />
          </section>
        </>
      )}
    </SubPage>
  );
}
