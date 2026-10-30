"use client";

import { formatDocumentNumber, type Currency, type ReportQuery } from "@khmio/shared";
import { Card, EmptyState, Mio, ProgressBar, type Tone } from "@khmio/ui";
import { ArrowDownLeft, ArrowUpRight, BarChart3, ClipboardCheck, PackageX, Scale, Tags, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { CHART_COLOR, ChartCard, ChartLegend, ChartTooltipBox } from "@/components/home/chart-parts";
import { SubPage } from "@/components/seller-frame/sub-page";
import { StatusTileRow } from "@/components/status-tile-row";
import { itemName } from "@/components/stock/item-name";
import { useDateText } from "@/components/use-date-text";
import type { CountReport } from "@/lib/api";
import { listAddress } from "@/lib/list-address";
import { PrintButton, ReportFilters } from "./report-filters";
import { moneyLines } from "./report-money";
import { PrintTable } from "./print-table";

type Row = CountReport["counts"][number];
type Money = Record<Currency, number>;

/** The count table's chips, which the tiles open too. */
const TABLE_CHIPS = ["lost", "found", "matched"] as const;
type TableChip = (typeof TABLE_CHIPS)[number];
const isTableChip = (chip: string): chip is TableChip => (TABLE_CHIPS as readonly string[]).includes(chip);
const inChip = (chip: TableChip, row: Row) => (chip === "lost" ? row.lostUnits > 0 : chip === "found" ? row.foundUnits > 0 : row.lostUnits === 0 && row.foundUnits === 0);

/** Most rows a chart's list shows. */
const TOP = 8;
const PERCENT_TICKS = [0, 50, 100];

/**
 * The stock counts report (design/screens.md S17 "Stock counts"; the ERP
 * shrinkage report) for a period: the counts applied, what went missing and
 * what turned up (units, and their worth at the cost each count fixed), the
 * net, and how accurate the shelf was — tiles the count table follows when
 * tapped; lost and found units count by count; the accuracy count by count;
 * the loss by category; the items most often short (each opening the item);
 * then each count — searchable, sortable, exportable, each row opening the
 * count. Dollars and riel apart, or in one currency for reading. Printable.
 */
export function CountReportScreen({
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
  countHref,
}: {
  report: CountReport;
  query: ReportQuery;
  onQuery: (query: ReportQuery) => void;
  inOne: Currency | null;
  onInOne: (currency: Currency | null) => void;
  mainCurrency: Currency;
  rate: number;
  back: { href: string; label: string };
  categoryName: (categoryId: string) => string;
  itemHref: (variantId: string) => string;
  countHref: (countId: string) => string;
}) {
  const t = useTranslations("CountReport");
  const tStock = useTranslations("Stock");
  const locale = useLocale();
  const router = useRouter();
  const { date, dateTime } = useDateText();
  const [activeChip, setActiveChip] = useState<TableChip | null>(null);
  // Bumped when a tile is tapped: the table starts again from the address the tile wrote.
  const [listKey, setListKey] = useState(0);
  const money = (value: Money, sign = false) => moneyLines(value, mainCurrency, inOne, rate, sign);
  const numberOf = (row: Pick<Row, "number">) => formatDocumentNumber("count", row.number);
  const rangeText = (row: Row) => (row.categoryIds.length === 0 ? tStock("countRangeAll") : row.categoryIds.map((id) => categoryName(id) || "—").join(", "));
  const percent = (accuracy: number | null) => (accuracy === null ? "—" : t("percent", { value: accuracy }));
  const { figures } = report;

  function selectChip(chip: TableChip | null) {
    const search = listAddress(window.location.search.replace(/^\?/, ""), chip ? { chip } : null);
    // The period stays: only the table's own parameters change.
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setActiveChip(chip);
    setListKey((key) => key + 1);
  }

  const lost = money(figures.lost);
  const found = money(figures.found, true);
  const net = money(figures.net, true);
  const tiles: { key: string; icon: LucideIcon; tone: Tone; label: string; amount: string; count?: string; sub?: string; action?: string; chip: TableChip | null }[] = [
    { key: "counts", icon: ClipboardCheck, tone: "brand", label: t("tileCounts"), amount: String(figures.counts), sub: tStock("countItemsCounted", { count: figures.items }), chip: null },
    { key: "lost", icon: ArrowUpRight, tone: "danger", label: tStock("countLost"), amount: t("units", { count: figures.lostUnits }), sub: figures.lostUnits > 0 ? lost.main : undefined, action: figures.lostUnits > 0 ? t("actionSee") : undefined, chip: "lost" },
    { key: "found", icon: ArrowDownLeft, tone: "success", label: tStock("countFound"), amount: t("units", { count: figures.foundUnits }), sub: figures.foundUnits > 0 ? found.main : undefined, action: figures.foundUnits > 0 ? t("actionSee") : undefined, chip: "found" },
    { key: "net", icon: Scale, tone: figures.net[mainCurrency] < 0 ? "warning" : "muted", label: tStock("countNet"), amount: net.main, sub: net.other ?? undefined, chip: null },
    { key: "accuracy", icon: Target, tone: "info", label: t("tileAccuracy"), amount: percent(figures.accuracy), sub: t("accuracyHint"), chip: "matched" },
  ];

  const columns: DataGridColumn<Row>[] = [
    { key: "number", header: tStock("countColNumber"), hideable: false, pin: "start", sortable: true, value: (row) => row.number, exportValue: numberOf, cell: (row) => <span className="font-medium"><DataGridHighlight text={numberOf(row)} /></span> },
    { key: "applied", header: t("colApplied"), sortable: true, value: (row) => row.appliedAt, exportValue: (row) => dateTime(row.appliedAt), cell: (row) => <span className="whitespace-nowrap text-muted">{dateTime(row.appliedAt)}</span> },
    { key: "range", header: tStock("countColRange"), value: rangeText, cell: (row) => <span className="line-clamp-1">{rangeText(row)}</span> },
    { key: "items", header: tStock("countColItems"), align: "right", sortable: true, value: (row) => row.items, cell: (row) => <span className="tabular-nums">{row.items}</span> },
    { key: "lost", header: tStock("countLost"), align: "right", sortable: true, value: (row) => row.lostUnits, exportValue: (row) => (row.lostUnits > 0 ? `−${row.lostUnits} (${money(row.lost).main})` : ""), cell: (row) => <span className={row.lostUnits > 0 ? "font-semibold tabular-nums text-danger" : "tabular-nums text-muted"}>{row.lostUnits > 0 ? `−${row.lostUnits}` : "—"}</span> },
    { key: "found", header: tStock("countFound"), align: "right", sortable: true, value: (row) => row.foundUnits, exportValue: (row) => (row.foundUnits > 0 ? `+${row.foundUnits} (${money(row.found, true).main})` : ""), cell: (row) => <span className={row.foundUnits > 0 ? "font-semibold tabular-nums text-success" : "tabular-nums text-muted"}>{row.foundUnits > 0 ? `+${row.foundUnits}` : "—"}</span> },
    {
      key: "net",
      header: tStock("countNet"),
      align: "right",
      sortable: true,
      value: (row) => row.net[mainCurrency],
      exportValue: (row) => money(row.net, true).main,
      cell: (row) => {
        const lines = money(row.net, true);
        return (
          <span className="flex flex-col items-end tabular-nums">
            <span className={row.net[mainCurrency] < 0 ? "font-semibold text-danger" : "font-semibold"}>{lines.main}</span>
            {lines.other && <span className="text-xs text-muted">{lines.other}</span>}
          </span>
        );
      },
    },
    { key: "accuracy", header: t("colAccuracy"), align: "right", sortable: true, value: (row) => row.accuracy ?? -1, exportValue: (row) => percent(row.accuracy), cell: (row) => <span className="font-semibold tabular-nums">{percent(row.accuracy)}</span> },
  ];

  const series = report.counts.map((row) => ({ key: row.id, label: numberOf(row), lost: row.lostUnits, found: row.foundUnits, accuracy: row.accuracy }));
  const byKey = new Map(report.counts.map((row) => [row.id, row]));
  const labelOf = (key: unknown) => (typeof key === "string" ? numberOf(byKey.get(key) ?? { number: 0 }) : "");
  const hasBars = series.some((point) => point.lost > 0 || point.found > 0);
  const categories = report.byCategory.slice(0, TOP);
  const mostLost = Math.max(1, ...categories.map((entry) => entry.lostUnits));

  return (
    <SubPage width="page" back={back} title={t("title")} description={t("description")} actions={<PrintButton />}>
      <ReportFilters query={query} onQuery={onQuery} firstDay={report.days?.from ?? report.counts[0]?.appliedOn} inOne={inOne} onInOne={onInOne} mainCurrency={mainCurrency} rate={rate} />
      {/* On paper: which days, as of when. */}
      <p className="hidden text-sm print:block">{report.days ? t("printedPeriod", { from: date(`${report.days.from}T12:00:00+07:00`), to: date(`${report.days.to}T12:00:00+07:00`) }) : t("printedAll")}</p>

      {report.counts.length === 0 ? (
        <Card className="p-4">
          <EmptyState art={<Mio size={80} />} title={t("empty")} body={t("emptyHint")} />
        </Card>
      ) : (
        <>
          {/* The figures: tapped, the count table follows. */}
          <StatusTileRow label={t("title")} tiles={tiles.map((tile) => ({ ...tile, view: tile.chip }))} active={activeChip} onSelect={selectChip} />
          {figures.withoutCost > 0 && <p className="text-sm text-muted">{tStock("countWithoutCost", { count: figures.withoutCost })}</p>}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard icon={BarChart3} title={t("flowTitle")} subtitle={t("flowHint")}>
              {hasBars ? (
                <div className="flex flex-col gap-2">
                  <div className="h-56 w-full" role="img" aria-label={t("flowTitle")}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                        <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
                        <XAxis dataKey="key" tickFormatter={labelOf} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                        <YAxis tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                        <Tooltip
                          cursor={{ fill: CHART_COLOR.mainSoft, opacity: 0.4 }}
                          content={({ active, label: key }) => {
                            const row = active && typeof key === "string" ? byKey.get(key) : undefined;
                            if (!row) return null;
                            return (
                              <ChartTooltipBox
                                title={`${numberOf(row)} · ${date(row.appliedAt)}`}
                                rows={[
                                  { color: CHART_COLOR.danger, label: tStock("countLost"), value: t("units", { count: row.lostUnits }) },
                                  { color: CHART_COLOR.main, label: tStock("countFound"), value: t("units", { count: row.foundUnits }) },
                                  { color: CHART_COLOR.neutral, label: tStock("countNet"), value: money(row.net, true).main },
                                ]}
                              />
                            );
                          }}
                        />
                        <Bar dataKey="lost" fill={CHART_COLOR.danger} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                        <Bar dataKey="found" fill={CHART_COLOR.main} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ChartLegend
                    items={[
                      { color: CHART_COLOR.danger, label: tStock("countLost") },
                      { color: CHART_COLOR.main, label: tStock("countFound") },
                    ]}
                  />
                </div>
              ) : (
                <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("allMatched")}</p>
              )}
            </ChartCard>

            <ChartCard icon={TrendingUp} title={t("accuracyTitle")} subtitle={t("accuracyHint")}>
              {series.length < 2 ? (
                <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("accuracyOne", { value: percent(figures.accuracy) })}</p>
              ) : (
                <div className="h-56 w-full" role="img" aria-label={t("accuracyTitle")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
                      <XAxis dataKey="key" tickFormatter={labelOf} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                      <YAxis domain={[0, 100]} ticks={PERCENT_TICKS} tickFormatter={(value: number) => t("percent", { value })} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} width={44} />
                      <Tooltip
                        content={({ active, label: key }) => {
                          const row = active && typeof key === "string" ? byKey.get(key) : undefined;
                          if (!row) return null;
                          return <ChartTooltipBox title={`${numberOf(row)} · ${date(row.appliedAt)}`} rows={[{ color: CHART_COLOR.main, label: t("tileAccuracy"), value: percent(row.accuracy) }]} />;
                        }}
                      />
                      <Line type="monotone" dataKey="accuracy" stroke={CHART_COLOR.main} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>

            <ChartCard icon={Tags} title={t("categoryTitle")} subtitle={t("categoryHint")}>
              {categories.length === 0 ? (
                <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("nothingLost")}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {categories.map((entry) => {
                    const worth = money(entry.lost);
                    const name = categoryName(entry.categoryId) || t("noCategory");
                    return (
                      <li key={entry.categoryId} className="flex flex-col gap-1">
                        <span className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">{name}</span>
                          <span className="flex items-baseline gap-2">
                            {/* No cost known: its worth isn't written as nothing. */}
                            {(entry.lost.USD !== 0 || entry.lost.KHR !== 0) && <span className="text-xs text-muted tabular-nums">{worth.main}</span>}
                            <span className="font-semibold tabular-nums">{t("units", { count: entry.lostUnits })}</span>
                          </span>
                        </span>
                        <ProgressBar value={entry.lostUnits} max={mostLost} size="sm" tone="danger" label={`${name}: ${t("units", { count: entry.lostUnits })}`} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </ChartCard>

            <ChartCard icon={PackageX} title={t("itemsTitle")} subtitle={t("itemsHint")}>
              {report.items.length === 0 ? (
                <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("nothingLost")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {report.items.slice(0, TOP).map((entry) => (
                    <li key={entry.variantId}>
                      <button type="button" onClick={() => router.push(itemHref(entry.variantId))} className="flex min-h-touch w-full items-center justify-between gap-3 py-2 text-left hover:bg-border/20">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{itemName(locale, entry)}</span>
                          <span className="block text-xs text-muted">{t("timesShort", { count: entry.timesShort })}</span>
                        </span>
                        <span className="shrink-0 text-right text-sm">
                          <span className="block font-semibold tabular-nums text-danger">−{entry.unitsLost}</span>
                          {(entry.lost.USD !== 0 || entry.lost.KHR !== 0) && <span className="block text-xs text-muted tabular-nums">{money(entry.lost).main}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>
          </div>

          <section id="counts" className="flex scroll-mt-20 flex-col gap-3">
            <h2 className="text-base font-semibold">{t("countsTitle")}</h2>
            <div className="print:hidden">
              <DataGrid
                key={listKey}
                syncUrl
                onViewChange={({ chip }) => setActiveChip(isTableChip(chip) ? chip : null)}
                rows={report.counts}
                getRowId={(row) => row.id}
                columns={columns}
                searchText={(row) => `${numberOf(row)} ${rangeText(row)}`}
                searchPlaceholder={tStock("countSearch")}
                chips={TABLE_CHIPS.map((chip) => ({ value: chip, label: t(`chip_${chip}`), predicate: (row: Row) => inChip(chip, row) }))}
                onRowClick={(row) => router.push(countHref(row.id))}
                initialSort={{ key: "number", direction: "desc" }}
                defaultPageSize={10}
                renderCard={(row) => {
                  const lines = money(row.net, true);
                  return (
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="flex w-full items-baseline justify-between gap-2">
                        <span className="font-semibold">
                          <DataGridHighlight text={numberOf(row)} />
                        </span>
                        <span className={row.net[mainCurrency] < 0 ? "shrink-0 font-semibold tabular-nums text-danger" : "shrink-0 font-semibold tabular-nums"}>{lines.main}</span>
                      </p>
                      <p className="w-full truncate text-xs text-muted">{[dateTime(row.appliedAt), rangeText(row), tStock("countItemsCounted", { count: row.items })].join(" · ")}</p>
                      <p className="text-xs text-muted tabular-nums">{t("cardLine", { lost: row.lostUnits, found: row.foundUnits, accuracy: percent(row.accuracy) })}</p>
                    </div>
                  );
                }}
                exportFileName="count-report"
                storageKey="seller-count-report-v1"
                emptyTitle={t("empty")}
              />
            </div>
            <PrintTable columns={columns} rows={report.counts} getRowId={(row) => row.id} />
          </section>
        </>
      )}
    </SubPage>
  );
}
