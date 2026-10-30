"use client";

import { LOW_MARGIN_PERCENT, marginPercent, type Currency, type ReportQuery } from "@khmio/shared";
import { Card, EmptyState, Mio, Notice, ProgressBar, type Tone } from "@khmio/ui";
import { BarChart3, Coins, FileText, Gauge, PackageMinus, Percent, PieChart, ShoppingBag, ThumbsDown, Trophy, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { CHART_COLOR, ChartCard, ChartLegend, ChartTooltipBox, compactMoney } from "@/components/home/chart-parts";
import { RingChart } from "@/components/home/ring-chart";
import { SubPage } from "@/components/seller-frame/sub-page";
import { StatusTileRow } from "@/components/status-tile-row";
import { useDateText } from "@/components/use-date-text";
import type { ProfitLoss } from "@/lib/api";
import { listAddress } from "@/lib/list-address";
import { localName } from "@/lib/local-name";
import { PrintTable } from "./print-table";
import { ProfitStatement, type StatementLine } from "./profit-statement";
import { PrintButton, ReportFilters } from "./report-filters";
import { chartAmount, moneyLines } from "./report-money";

type Row = ProfitLoss["products"][number];
type Money = Record<Currency, number>;

/** The product table's chips, which the tiles open too. */
const TABLE_CHIPS = ["losing", "low", "nocost"] as const;
type TableChip = (typeof TABLE_CHIPS)[number];
const isTableChip = (chip: string): chip is TableChip => (TABLE_CHIPS as readonly string[]).includes(chip);
const hasSome = (money: Money) => money.USD !== 0 || money.KHR !== 0;

/** Most rows a chart's list shows (the table has every product). */
const TOP = 5;

/**
 * The profit and loss report (design/screens.md S17 "Profit & loss"; Pro)
 * for a period: tiles — net sales, cost of goods, gross profit, margin, stock
 * lost, profit — the product table follows a tile; the statement read top to
 * bottom; profit over time (cost and profit making up each bar); where the
 * money went (ring); the margin over time; stock lost and found by reason;
 * the most and least profitable products (each opening the product); then
 * every product sold — searchable, sortable, exportable. Sales without a cost
 * price are taken out of the profit, never guessed. Dollars and riel apart,
 * or in one currency for reading (charts in the shop's currency unless all is
 * shown in one). Printable.
 */
export function ProfitLossScreen({
  report,
  query,
  onQuery,
  inOne,
  onInOne,
  mainCurrency,
  rate,
  back,
  productsHref,
  productHref,
}: {
  report: ProfitLoss;
  query: ReportQuery;
  onQuery: (query: ReportQuery) => void;
  inOne: Currency | null;
  onInOne: (currency: Currency | null) => void;
  mainCurrency: Currency;
  rate: number;
  back: { href: string; label: string };
  productsHref: string;
  productHref: (productId: string) => string;
}) {
  const t = useTranslations("ProfitLoss");
  const tStock = useTranslations("Stock");
  const locale = useLocale();
  const router = useRouter();
  const { day, monthYear, date } = useDateText();
  const [activeChip, setActiveChip] = useState<TableChip | null>(null);
  // Bumped when a tile is tapped: the table starts again from the address the tile wrote.
  const [listKey, setListKey] = useState(0);
  const money = (value: Money, sign = false) => moneyLines(value, mainCurrency, inOne, rate, sign);
  const chartCurrency = inOne ?? mainCurrency;
  const inChart = (value: Money) => chartAmount(value, mainCurrency, inOne, rate);
  const { statement } = report;
  const percent = (value: number | null) => (value === null ? "—" : t("percent", { value }));
  const costedSales = (row: Row): Money => ({ USD: row.sales.USD - row.missingCostSales.USD, KHR: row.sales.KHR - row.missingCostSales.KHR });
  const marginOf = (row: Row) => marginPercent(inChart(row.profit), inChart(costedSales(row)));
  const inChip = (chip: TableChip, row: Row) => {
    if (chip === "nocost") return hasSome(row.missingCostSales);
    const margin = marginOf(row);
    return margin !== null && (chip === "losing" ? margin < 0 : margin >= 0 && margin < LOW_MARGIN_PERCENT);
  };
  const moveLabel = (move: ProfitLoss["moves"][number]) => (move.direction === "in" ? t("foundInCounts") : tStock(`reason_${move.reason}`));

  function selectChip(chip: TableChip | null) {
    const search = listAddress(window.location.search.replace(/^\?/, ""), chip ? { chip } : null);
    // The period stays: only the table's own parameters change.
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setActiveChip(chip);
    setListKey((key) => key + 1);
  }

  // The margin of the goods with a cost price: what they sold for less what they cost (delivery fees cost nothing, so they'd lift it).
  const costedGoods = { USD: statement.goods.USD - statement.missingCostSales.USD, KHR: statement.goods.KHR - statement.missingCostSales.KHR };
  const margin = marginPercent(inChart(costedGoods) - inChart(statement.cost), inChart(costedGoods));
  const netSales = money(statement.netSales);
  const cost = money(statement.cost);
  const grossProfit = money(statement.grossProfit);
  const losses = money(statement.losses);
  const profit = money(statement.profit);
  const lossCount = report.products.filter((row) => inChip("losing", row)).length;
  const lowCount = report.products.filter((row) => inChip("low", row)).length;
  const tiles: { key: string; icon: LucideIcon; tone: Tone; label: string; amount: string; sub?: string; action?: string; chip: TableChip | null }[] = [
    { key: "sales", icon: ShoppingBag, tone: "brand", label: t("netSales"), amount: netSales.main, sub: netSales.other ?? t("orders", { count: statement.orders }), chip: null },
    { key: "cost", icon: Coins, tone: "warning", label: t("cost"), amount: cost.main, sub: cost.other ?? undefined, action: hasSome(statement.missingCostSales) ? t("actionNoCost") : undefined, chip: "nocost" },
    { key: "gross", icon: TrendingUp, tone: inChart(statement.grossProfit) < 0 ? "danger" : "success", label: t("grossProfit"), amount: grossProfit.main, sub: grossProfit.other ?? undefined, action: lossCount > 0 ? t("actionLosing", { count: lossCount }) : undefined, chip: "losing" },
    { key: "margin", icon: Percent, tone: "info", label: t("margin"), amount: percent(margin), sub: lowCount > 0 ? t("lowCount", { count: lowCount, value: LOW_MARGIN_PERCENT }) : undefined, action: lowCount > 0 ? t("actionSee") : undefined, chip: "low" },
    { key: "losses", icon: PackageMinus, tone: "danger", label: t("stockLost"), amount: losses.main, sub: losses.other ?? (hasSome(statement.found) ? t("foundSub", { amount: money(statement.found, true).main }) : undefined), chip: null },
    { key: "profit", icon: Wallet, tone: inChart(statement.profit) < 0 ? "danger" : "brand", label: t("profit"), amount: profit.main, sub: profit.other ?? undefined, chip: null },
  ];

  const lines: StatementLine[] = [
    { key: "grossSales", label: t("grossSales"), amount: money(statement.grossSales), kind: "line" },
    ...(hasSome(statement.discounts) ? [{ key: "discounts", label: t("discounts"), amount: money(statement.discounts, true), kind: "line" as const, negative: true }] : []),
    ...(hasSome(statement.deliveryFees) ? [{ key: "delivery", label: t("deliveryFees"), amount: money(statement.deliveryFees, true), kind: "line" as const }] : []),
    { key: "netSales", label: t("netSales"), amount: netSales, kind: "subtotal" },
    { key: "cost", label: t("costOfGoods"), hint: t("costHint"), amount: money({ USD: -statement.cost.USD, KHR: -statement.cost.KHR }, true), kind: "line", negative: hasSome(statement.cost) },
    ...(hasSome(statement.missingCostSales) ? [{ key: "missing", label: t("missingCost"), hint: t("missingCostHint"), amount: money({ USD: -statement.missingCostSales.USD, KHR: -statement.missingCostSales.KHR }, true), kind: "line" as const, negative: true }] : []),
    { key: "grossProfit", label: t("grossProfit"), hint: margin === null ? undefined : t("marginLine", { value: percent(margin) }), amount: grossProfit, kind: "subtotal", negative: inChart(statement.grossProfit) < 0 },
    { key: "losses", label: t("stockLost"), hint: statement.lossesEstimated ? t("lossesEstimated") : undefined, amount: money(statement.losses, true), kind: "line", negative: hasSome(statement.losses) },
    ...(hasSome(statement.found) ? [{ key: "found", label: t("foundInCounts"), amount: money(statement.found, true), kind: "line" as const }] : []),
    { key: "profit", label: t("profit"), hint: t("profitHint"), amount: profit, kind: "result", negative: inChart(statement.profit) < 0 },
    ...(hasSome(statement.vat) ? [{ key: "vat", label: t("vat"), hint: t("vatHint"), amount: money(statement.vat), kind: "line" as const, aside: true }] : []),
  ];

  const columns: DataGridColumn<Row>[] = [
    { key: "product", header: t("colProduct"), hideable: false, pin: "start", sortable: true, value: (row) => localName(locale, row), cell: (row) => <span className="line-clamp-1 font-medium"><DataGridHighlight text={localName(locale, row)} /></span> },
    { key: "sold", header: t("colSold"), align: "right", sortable: true, value: (row) => row.quantity, cell: (row) => <span className="tabular-nums">{row.quantity}</span> },
    { key: "sales", header: t("colSales"), align: "right", sortable: true, value: (row) => inChart(row.sales), exportValue: (row) => money(row.sales).main, cell: (row) => <span className="tabular-nums">{money(row.sales).main}</span> },
    { key: "cost", header: t("colCost"), align: "right", sortable: true, value: (row) => inChart(row.cost), exportValue: (row) => money(row.cost).main, cell: (row) => (hasSome(row.cost) ? <span className="tabular-nums text-muted">{money(row.cost).main}</span> : <span className="text-xs text-warning">{t("noCost")}</span>) },
    { key: "profit", header: t("colProfit"), align: "right", sortable: true, value: (row) => inChart(row.profit), exportValue: (row) => money(row.profit).main, cell: (row) => <span className={inChart(row.profit) < 0 ? "font-semibold tabular-nums text-danger" : "font-semibold tabular-nums"}>{money(row.profit).main}</span> },
    { key: "margin", header: t("margin"), align: "right", sortable: true, value: (row) => marginOf(row) ?? -999, exportValue: (row) => percent(marginOf(row)), cell: (row) => <span className={inChip("losing", row) ? "tabular-nums text-danger" : inChip("low", row) ? "tabular-nums text-warning" : "tabular-nums"}>{percent(marginOf(row))}</span> },
  ];

  const series = report.series.map((point) => {
    const costed = inChart(point.costedSales);
    const cost = inChart(point.cost);
    return { key: point.key, cost, profit: inChart(point.profit), margin: marginPercent(costed - cost, costed) };
  });
  const byKey = new Map(report.series.map((point) => [point.key, point]));
  const label = (key: string) => (report.unit === "day" ? day(key) : monthYear(key));
  const hasBars = series.some((point) => point.cost !== 0 || point.profit !== 0);
  const ranked = report.products.filter((row) => marginOf(row) !== null);
  const best = [...ranked].sort((a, b) => inChart(b.profit) - inChart(a.profit)).slice(0, TOP);
  const worst = [...ranked].sort((a, b) => (marginOf(a) ?? 0) - (marginOf(b) ?? 0)).slice(0, TOP);
  const mostMoved = Math.max(1, ...report.moves.map((move) => move.units));
  const productList = (rows: Row[], show: (row: Row) => string) => (
    <ol className="flex flex-col divide-y divide-border">
      {rows.map((row, index) => (
        <li key={row.productId}>
          <button type="button" onClick={() => router.push(productHref(row.productId))} className="flex min-h-touch w-full items-center justify-between gap-3 py-2 text-left hover:bg-border/20">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="text-xs font-semibold text-muted tabular-nums">{index + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{localName(locale, row)}</span>
                <span className="block text-xs text-muted">{t("soldLine", { count: row.quantity, sales: money(row.sales).main })}</span>
              </span>
            </span>
            <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{show(row)}</span>
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <SubPage width="page" back={back} title={t("title")} description={t("description")} actions={<PrintButton />}>
      <ReportFilters query={query} onQuery={onQuery} firstDay={report.days?.from ?? report.series[0]?.key} inOne={inOne} onInOne={onInOne} mainCurrency={mainCurrency} rate={rate} />
      {/* On paper: which days, as of when. */}
      <p className="hidden text-sm print:block">{report.days ? t("printedPeriod", { from: date(`${report.days.from}T12:00:00+07:00`), to: date(`${report.days.to}T12:00:00+07:00`) }) : t("printedAll")}</p>

      {statement.orders === 0 && report.moves.length === 0 ? (
        <Card className="p-4">
          <EmptyState art={<Mio size={80} />} title={t("empty")} body={t("emptyHint")} />
        </Card>
      ) : (
        <>
          {hasSome(statement.missingCostSales) && (
            <Notice
              tone="warning"
              action={
                <Link href={productsHref} className="inline-flex min-h-touch items-center font-semibold underline">
                  {t("addCosts")}
                </Link>
              }
            >
              {t("missingCostNotice", { amount: money(statement.missingCostSales).main })}
            </Notice>
          )}

          {/* The figures: tapped, the product table follows. */}
          <StatusTileRow label={t("title")} tiles={tiles.map((tile) => ({ ...tile, view: tile.chip }))} active={activeChip} onSelect={selectChip} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <ChartCard icon={FileText} title={t("statementTitle")} subtitle={t("statementHint")}>
                <ProfitStatement lines={lines} label={t("statementTitle")} />
              </ChartCard>
            </div>
            <div className="flex flex-col gap-4 lg:col-span-3">
              <ChartCard icon={BarChart3} title={t("flowTitle")} subtitle={`${t(report.unit === "day" ? "byDay" : "byMonth")} · ${chartCurrency === "USD" ? t("inDollars") : t("inRiel")}`}>
                {hasBars ? (
                  <div className="flex flex-col gap-2">
                    <div className="h-56 w-full" role="img" aria-label={t("flowTitle")}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={series} stackOffset="sign" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
                          <XAxis dataKey="key" tickFormatter={label} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                          <YAxis tickFormatter={(value: number) => compactMoney(value, chartCurrency)} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} width={48} />
                          <ReferenceLine y={0} stroke={CHART_COLOR.axis} />
                          <Tooltip
                            cursor={{ fill: CHART_COLOR.mainSoft, opacity: 0.4 }}
                            content={({ active, label: key }) => {
                              const point = active && typeof key === "string" ? byKey.get(key) : undefined;
                              if (!point) return null;
                              return (
                                <ChartTooltipBox
                                  title={label(point.key)}
                                  rows={[
                                    { color: CHART_COLOR.neutral, label: t("netSales"), value: money(point.netSales).main },
                                    { color: CHART_COLOR.neutralLine, label: t("cost"), value: money(point.cost).main },
                                    ...(hasSome(point.losses) ? [{ color: CHART_COLOR.danger, label: t("stockLost"), value: money(point.losses, true).main }] : []),
                                    { color: CHART_COLOR.main, label: t("profit"), value: money(point.profit).main },
                                  ]}
                                />
                              );
                            }}
                          />
                          <Bar dataKey="cost" stackId="sales" fill={CHART_COLOR.neutral} maxBarSize={22} isAnimationActive={false} />
                          <Bar dataKey="profit" stackId="sales" fill={CHART_COLOR.main} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <ChartLegend
                      items={[
                        { color: CHART_COLOR.neutral, label: t("cost") },
                        { color: CHART_COLOR.main, label: t("profit") },
                      ]}
                    />
                  </div>
                ) : (
                  <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noProfit")}</p>
                )}
              </ChartCard>
              <ChartCard icon={Gauge} title={t("marginTitle")} subtitle={t("marginHint")}>
                {series.filter((point) => point.margin !== null).length < 2 ? (
                  <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("marginFew")}</p>
                ) : (
                  <div className="h-40 w-full" role="img" aria-label={t("marginTitle")}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
                        <XAxis dataKey="key" tickFormatter={label} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                        <YAxis tickFormatter={(value: number) => t("percent", { value })} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} width={44} />
                        <ReferenceLine y={LOW_MARGIN_PERCENT} stroke={CHART_COLOR.danger} strokeDasharray="4 4" />
                        <Tooltip content={({ active, label: key }) => {
                          const point = active && typeof key === "string" ? series.find((entry) => entry.key === key) : undefined;
                          return point ? <ChartTooltipBox title={label(point.key)} rows={[{ color: CHART_COLOR.main, label: t("margin"), value: percent(point.margin) }]} /> : null;
                        }} />
                        <Line type="monotone" dataKey="margin" stroke={CHART_COLOR.main} strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard icon={PieChart} title={t("whereTitle")} subtitle={t("whereHint")}>
              <RingChart
                label={t("whereTitle")}
                center={{ label: t("netSales"), value: compactMoney(inChart(statement.netSales), chartCurrency) }}
                parts={[
                  { key: "cost", label: t("cost"), amount: inChart(statement.cost), color: CHART_COLOR.neutral, text: cost.main },
                  { key: "missing", label: t("missingCost"), amount: inChart(statement.missingCostSales), color: "rgb(var(--color-warning))", text: money(statement.missingCostSales).main },
                  { key: "losses", label: t("stockLost"), amount: -inChart(statement.losses), color: CHART_COLOR.danger, text: losses.main, alert: true },
                  { key: "profit", label: t("profit"), amount: Math.max(0, inChart(statement.profit)), color: CHART_COLOR.main, text: profit.main },
                ]}
              />
            </ChartCard>
            <ChartCard icon={PackageMinus} title={t("lossTitle")} subtitle={statement.lossesEstimated ? t("lossesEstimated") : t("lossHint")}>
              {report.moves.length === 0 ? (
                <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noLosses")}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {report.moves.map((move) => (
                    <li key={`${move.direction}:${move.reason}`} className="flex flex-col gap-1">
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <span>{moveLabel(move)}</span>
                        <span className="flex items-baseline gap-2">
                          <span className="text-xs text-muted tabular-nums">{t("units", { count: move.units })}</span>
                          <span className={move.direction === "out" ? "font-semibold tabular-nums text-danger" : "font-semibold tabular-nums text-success"}>{hasSome(move.value) ? money(move.value, true).main : "—"}</span>
                        </span>
                      </span>
                      <ProgressBar value={move.units} max={mostMoved} size="sm" tone={move.direction === "out" ? "danger" : "success"} label={`${moveLabel(move)}: ${t("units", { count: move.units })}`} />
                    </li>
                  ))}
                </ul>
              )}
              {statement.unvaluedUnits > 0 && <p className="mt-3 text-xs text-muted">{t("unvalued", { count: statement.unvaluedUnits })}</p>}
            </ChartCard>
            <ChartCard icon={Trophy} title={t("bestTitle")} subtitle={t("bestHint")}>
              {best.length === 0 ? <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noCosted")}</p> : productList(best, (row) => money(row.profit).main)}
            </ChartCard>
            <ChartCard icon={ThumbsDown} title={t("worstTitle")} subtitle={t("worstHint", { value: LOW_MARGIN_PERCENT })}>
              {worst.length === 0 ? <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noCosted")}</p> : productList(worst, (row) => percent(marginOf(row)))}
            </ChartCard>
          </div>

          <section id="products" className="flex scroll-mt-20 flex-col gap-3">
            <h2 className="text-base font-semibold">{t("productsTitle")}</h2>
            <div className="print:hidden">
              <DataGrid
                key={listKey}
                syncUrl
                onViewChange={({ chip }) => setActiveChip(isTableChip(chip) ? chip : null)}
                rows={report.products}
                getRowId={(row) => row.productId}
                columns={columns}
                searchText={(row) => `${row.nameKm} ${row.nameEn}`}
                searchPlaceholder={t("searchProducts")}
                chips={TABLE_CHIPS.map((chip) => ({ value: chip, label: t(`chip_${chip}`), predicate: (row: Row) => inChip(chip, row) }))}
                onRowClick={(row) => router.push(productHref(row.productId))}
                initialSort={{ key: "profit", direction: "desc" }}
                defaultPageSize={10}
                renderCard={(row) => (
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex w-full items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold">
                        <DataGridHighlight text={localName(locale, row)} />
                      </span>
                      <span className={inChart(row.profit) < 0 ? "shrink-0 font-semibold tabular-nums text-danger" : "shrink-0 font-semibold tabular-nums"}>{money(row.profit).main}</span>
                    </p>
                    <p className="w-full truncate text-xs text-muted">{[t("soldLine", { count: row.quantity, sales: money(row.sales).main }), hasSome(row.cost) ? t("marginLine", { value: percent(marginOf(row)) }) : t("noCost")].join(" · ")}</p>
                  </div>
                )}
                exportFileName="profit-loss"
                storageKey="seller-profit-loss-v1"
                emptyTitle={t("noSales")}
              />
            </div>
            <PrintTable columns={columns} rows={report.products} getRowId={(row) => row.productId} />
          </section>
        </>
      )}
    </SubPage>
  );
}
