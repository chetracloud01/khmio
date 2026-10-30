"use client";

import { amountIn, type Currency, type ReportQuery } from "@khmio/shared";
import { Card, EmptyState, Mio, Notice, ProgressBar, type Tone } from "@khmio/ui";
import { BarChart3, Ban, Clock, CreditCard, Globe, HandCoins, PieChart, ReceiptText, ShoppingBag, Store, Trophy, Truck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { CHART_COLOR, ChartCard, ChartLegend, ChartTooltipBox, compactMoney } from "@/components/home/chart-parts";
import { RingChart } from "@/components/home/ring-chart";
import { formatMoney, useOrderText } from "@/components/order-ui";
import { SubPage } from "@/components/seller-frame/sub-page";
import { StatusTileRow } from "@/components/status-tile-row";
import { useDateText } from "@/components/use-date-text";
import type { SalesReport } from "@/lib/api";
import { listAddress } from "@/lib/list-address";
import { localName } from "@/lib/local-name";
import { PrintButton, ReportFilters } from "./report-filters";
import { chartAmount, moneyLines } from "./report-money";
import { PrintTable } from "./print-table";

type Row = SalesReport["orders"][number];
type Money = Record<Currency, number>;

/** The order table's chips, which the tiles open too. */
const TABLE_CHIPS = ["shop", "online", "collect", "cancelled"] as const;
type TableChip = (typeof TABLE_CHIPS)[number];
const isTableChip = (chip: string): chip is TableChip => (TABLE_CHIPS as readonly string[]).includes(chip);
const FINISHED = ["completed", "cancelled"];
const inChip = (chip: TableChip, row: Row) =>
  chip === "shop" ? row.channel === "in_store" : chip === "online" ? row.channel === "online" : chip === "collect" ? row.paymentMethod === "cod" && !FINISHED.includes(row.status) : row.status === "cancelled";

/** Most rows a chart's list shows (the table has every order). */
const TOP = 8;
/** The hours drawn: the shop's day (no one buys at 3 a.m.; an order then still counts in the totals). */
const FIRST_HOUR = 6;
const LAST_HOUR = 22;

/**
 * The sales report (design/screens.md S17 "Sales") for a period: sales in
 * the shop (counter) and online (orders and bookings from the shop page) —
 * tiles the order table follows when tapped; sales day by day (month by month
 * for long ranges) in the shop and online; the split as a ring; how buyers
 * paid; the busiest hours; how online orders reached the buyer; the best
 * sellers (each opening the product); then the period's orders — searchable,
 * sortable, exportable, each opening the order. Dollars and riel apart, or in
 * one currency for reading (charts in the shop's currency unless all is shown
 * in one). Printable.
 */
export function SalesReportScreen({
  report,
  query,
  onQuery,
  inOne,
  onInOne,
  mainCurrency,
  rate,
  back,
  ordersHref,
  orderHref,
  productHref,
}: {
  report: SalesReport;
  query: ReportQuery;
  onQuery: (query: ReportQuery) => void;
  inOne: Currency | null;
  onInOne: (currency: Currency | null) => void;
  mainCurrency: Currency;
  rate: number;
  back: { href: string; label: string };
  ordersHref: string;
  orderHref: (orderId: string) => string;
  productHref: (productId: string) => string;
}) {
  const t = useTranslations("SalesReport");
  const tOrders = useTranslations("Orders");
  const locale = useLocale();
  const router = useRouter();
  const { statusLabel } = useOrderText();
  const { day, monthYear, date, dateTime } = useDateText();
  const [activeChip, setActiveChip] = useState<TableChip | null>(null);
  // Bumped when a tile is tapped: the table starts again from the address the tile wrote.
  const [listKey, setListKey] = useState(0);
  const money = (value: Money) => moneyLines(value, mainCurrency, inOne, rate);
  const chartCurrency = inOne ?? mainCurrency;
  const inChart = (value: Money) => chartAmount(value, mainCurrency, inOne, rate);
  const { figures } = report;
  const channelLabel = (row: Pick<Row, "channel" | "booking">) => (row.channel === "in_store" ? t("inShop") : row.booking ? t("booking") : t("online"));

  function selectChip(chip: TableChip | null) {
    const search = listAddress(window.location.search.replace(/^\?/, ""), chip ? { chip } : null);
    // The period stays: only the table's own parameters change.
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setActiveChip(chip);
    setListKey((key) => key + 1);
  }

  const share = (part: number) => (inChart(figures.all.sales) > 0 ? t("share", { value: Math.round((part / inChart(figures.all.sales)) * 100) }) : undefined);
  const sales = money(figures.all.sales);
  const shop = money(figures.shop.sales);
  const online = money(figures.online.sales);
  const average = money(figures.average);
  const toCollect = money(figures.toCollect.money);
  const cancelled = money(figures.cancelled.money);
  const tiles: { key: string; icon: LucideIcon; tone: Tone; label: string; amount: string; count?: string; sub?: string; action?: string; chip: TableChip | null }[] = [
    { key: "sales", icon: ShoppingBag, tone: "brand", label: t("tileSales"), amount: sales.main, count: t("orders", { count: figures.all.orders }), sub: sales.other ?? undefined, chip: null },
    { key: "shop", icon: Store, tone: "success", label: t("inShop"), amount: shop.main, count: t("orders", { count: figures.shop.orders }), sub: shop.other ?? share(inChart(figures.shop.sales)), chip: "shop" },
    { key: "online", icon: Globe, tone: "info", label: t("online"), amount: online.main, count: t("orders", { count: figures.online.orders }), sub: figures.online.bookings > 0 ? t("bookingsCount", { count: figures.online.bookings }) : (online.other ?? share(inChart(figures.online.sales))), chip: "online" },
    { key: "average", icon: ReceiptText, tone: "muted", label: t("tileAverage"), amount: average.main, sub: average.other ?? undefined, chip: null },
    { key: "collect", icon: HandCoins, tone: "warning", label: t("tileCollect"), amount: toCollect.main, count: t("orders", { count: figures.toCollect.orders }), action: figures.toCollect.orders > 0 ? t("actionSee") : undefined, chip: "collect" },
    { key: "cancelled", icon: Ban, tone: "danger", label: t("tileCancelled"), amount: cancelled.main, count: t("orders", { count: figures.cancelled.orders }), action: figures.cancelled.orders > 0 ? t("actionSee") : undefined, chip: "cancelled" },
  ];

  const columns: DataGridColumn<Row>[] = [
    {
      key: "order",
      header: tOrders("colOrder"),
      hideable: false,
      pin: "start",
      sortable: true,
      value: (row) => Date.parse(row.createdAt),
      exportValue: (row) => `#${row.orderNumber}`,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold">
            <DataGridHighlight text={`#${row.orderNumber}`} />
          </span>
          <span className="whitespace-nowrap text-xs text-muted">{dateTime(row.createdAt)}</span>
        </div>
      ),
    },
    { key: "channel", header: t("colChannel"), sortable: true, value: channelLabel, cell: (row) => <span className="inline-flex items-center gap-2 whitespace-nowrap">{row.channel === "in_store" ? <Store className="h-4 w-4 text-muted" aria-hidden="true" /> : <Globe className="h-4 w-4 text-muted" aria-hidden="true" />}{channelLabel(row)}</span> },
    { key: "buyer", header: tOrders("colBuyer"), sortable: true, value: (row) => row.buyerName, cell: (row) => <span className="line-clamp-1"><DataGridHighlight text={row.buyerName || t("walkIn")} /></span> },
    { key: "payment", header: t("colPayment"), sortable: true, value: (row) => t(`pay_${row.paymentMethod}`), cell: (row) => <span className="whitespace-nowrap text-muted">{t(`pay_${row.paymentMethod}`)}</span> },
    { key: "status", header: tOrders("colStatus"), sortable: true, value: (row) => statusLabel(row), cell: (row) => <span className={row.status === "cancelled" ? "whitespace-nowrap text-danger" : "whitespace-nowrap"}>{statusLabel(row)}</span> },
    {
      key: "total",
      header: tOrders("colTotal"),
      align: "right",
      sortable: true,
      // Turned into the shop's currency to sort, so dollars and riel sort together.
      value: (row) => amountIn(row.totalMinor, row.currency, mainCurrency, rate),
      exportValue: (row) => formatMoney(row.totalMinor, row.currency),
      cell: (row) => <span className={row.status === "cancelled" ? "font-semibold tabular-nums text-muted line-through" : "font-semibold tabular-nums"}>{formatMoney(row.totalMinor, row.currency)}</span>,
    },
  ];

  const series = report.series.map((point) => ({ key: point.key, shop: inChart(point.shop), online: inChart(point.online), orders: point.orders }));
  const byKey = new Map(report.series.map((point) => [point.key, point]));
  const label = (key: string) => (report.unit === "day" ? day(key) : monthYear(key));
  const hasBars = series.some((point) => point.shop > 0 || point.online > 0);
  const hours = report.hours.filter((hour) => (hour.hour >= FIRST_HOUR && hour.hour <= LAST_HOUR) || hour.orders > 0);
  const busiest = report.hours.reduce((best, hour) => (hour.orders > best.orders ? hour : best), { hour: -1, orders: 0 });
  const hourText = (hour: number) => t("hour", { hour: String(hour).padStart(2, "0") });
  const mostPaid = Math.max(1, ...report.payments.map((payment) => payment.orders));
  const products = report.products.slice(0, TOP);
  const mostSold = Math.max(1, ...products.map((product) => inChart(product.money)));
  const { delivery } = report;
  const sent = delivery.delivery + delivery.pickup;

  return (
    <SubPage width="page" back={back} title={t("title")} description={t("description")} actions={<PrintButton />}>
      <ReportFilters query={query} onQuery={onQuery} firstDay={report.days?.from ?? report.series[0]?.key} inOne={inOne} onInOne={onInOne} mainCurrency={mainCurrency} rate={rate} />
      {/* On paper: which days, as of when. */}
      <p className="hidden text-sm print:block">{report.days ? t("printedPeriod", { from: date(`${report.days.from}T12:00:00+07:00`), to: date(`${report.days.to}T12:00:00+07:00`) }) : t("printedAll")}</p>

      {report.orders.length === 0 ? (
        <Card className="p-4">
          <EmptyState art={<Mio size={80} />} title={t("empty")} body={t("emptyHint")} />
        </Card>
      ) : (
        <>
          {/* The figures: tapped, the order table follows. */}
          <StatusTileRow label={t("title")} tiles={tiles.map((tile) => ({ ...tile, view: tile.chip }))} active={activeChip} onSelect={selectChip} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ChartCard icon={BarChart3} title={t("flowTitle")} subtitle={`${t(report.unit === "day" ? "byDay" : "byMonth")} · ${chartCurrency === "USD" ? t("inDollars") : t("inRiel")}`}>
                {hasBars ? (
                  <div className="flex flex-col gap-2">
                    <div className="h-60 w-full" role="img" aria-label={t("flowTitle")}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
                          <XAxis dataKey="key" tickFormatter={label} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                          <YAxis tickFormatter={(value: number) => compactMoney(value, chartCurrency)} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} width={48} />
                          <Tooltip
                            cursor={{ fill: CHART_COLOR.mainSoft, opacity: 0.4 }}
                            content={({ active, label: key }) => {
                              const point = active && typeof key === "string" ? byKey.get(key) : undefined;
                              if (!point) return null;
                              return (
                                <ChartTooltipBox
                                  title={`${label(point.key)} · ${t("orders", { count: point.orders })}`}
                                  rows={[
                                    { color: CHART_COLOR.main, label: t("inShop"), value: money(point.shop).main },
                                    { color: CHART_COLOR.neutralLine, label: t("online"), value: money(point.online).main },
                                  ]}
                                />
                              );
                            }}
                          />
                          <Bar dataKey="shop" stackId="sales" fill={CHART_COLOR.main} maxBarSize={22} isAnimationActive={false} />
                          <Bar dataKey="online" stackId="sales" fill={CHART_COLOR.neutralLine} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <ChartLegend
                      items={[
                        { color: CHART_COLOR.main, label: t("inShop") },
                        { color: CHART_COLOR.neutralLine, label: t("online") },
                      ]}
                    />
                  </div>
                ) : (
                  <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noSales")}</p>
                )}
              </ChartCard>
            </div>
            <ChartCard icon={PieChart} title={t("splitTitle")} subtitle={t("splitHint")}>
              <RingChart
                label={t("splitTitle")}
                center={{ label: t("ordersLabel"), value: String(figures.all.orders) }}
                parts={[
                  { key: "shop", label: t("inShop"), amount: inChart(figures.shop.sales), color: CHART_COLOR.main, text: shop.main },
                  { key: "online", label: t("online"), amount: inChart(figures.online.sales), color: CHART_COLOR.neutralLine, text: online.main },
                ]}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard icon={CreditCard} title={t("payTitle")} subtitle={t("payHint")}>
              {report.payments.length === 0 ? (
                <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noSales")}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {report.payments.map((payment) => (
                    <li key={payment.method} className="flex flex-col gap-1">
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <span>{t(`pay_${payment.method}`)}</span>
                        <span className="flex items-baseline gap-2">
                          <span className="text-xs text-muted tabular-nums">{money(payment.money).main}</span>
                          <span className="font-semibold tabular-nums">{t("orders", { count: payment.orders })}</span>
                        </span>
                      </span>
                      <ProgressBar value={payment.orders} max={mostPaid} size="sm" label={`${t(`pay_${payment.method}`)}: ${t("orders", { count: payment.orders })}`} />
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>

            <ChartCard icon={Clock} title={t("hoursTitle")} subtitle={busiest.hour >= 0 ? t("busiest", { hour: hourText(busiest.hour) }) : t("hoursHint")}>
              <div className="h-48 w-full" role="img" aria-label={t("hoursTitle")}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hours} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
                    <XAxis dataKey="hour" tickFormatter={(hour: number) => String(hour)} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
                    <YAxis tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: CHART_COLOR.mainSoft, opacity: 0.4 }}
                      content={({ active, label: hour }) => {
                        const point = active && typeof hour === "number" ? report.hours[hour] : undefined;
                        if (!point) return null;
                        return <ChartTooltipBox title={hourText(point.hour)} rows={[{ color: CHART_COLOR.main, label: t("ordersLabel"), value: `${t("orders", { count: point.orders })} · ${money(point.money).main}` }]} />;
                      }}
                    />
                    <Bar dataKey="orders" fill={CHART_COLOR.main} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard icon={Truck} title={t("deliveryTitle")} subtitle={t("deliveryHint", { delivery: delivery.delivery, pickup: delivery.pickup })}>
              {sent === 0 ? (
                <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noOnline")}</p>
              ) : (
                <RingChart
                  label={t("deliveryTitle")}
                  center={{ label: t("successRate"), value: delivery.successRate === null ? "—" : t("percent", { value: delivery.successRate }) }}
                  parts={[
                    { key: "done", label: t("delivered"), amount: delivery.done, color: CHART_COLOR.main, text: String(delivery.done) },
                    { key: "underway", label: t("underway"), amount: delivery.underway, color: CHART_COLOR.neutral, text: String(delivery.underway) },
                    { key: "failed", label: t("failed"), amount: delivery.failed, color: CHART_COLOR.danger, text: String(delivery.failed), alert: true },
                  ]}
                />
              )}
            </ChartCard>

            <ChartCard icon={Trophy} title={t("bestTitle")} subtitle={t("bestHint")}>
              {products.length === 0 ? (
                <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noSales")}</p>
              ) : (
                <ol className="flex flex-col">
                  {products.map((product, index) => (
                    <li key={product.productId}>
                      <button type="button" onClick={() => router.push(productHref(product.productId))} className="flex min-h-touch w-full flex-col gap-1 rounded-lg py-1.5 text-left hover:bg-border/20">
                        <span className="flex w-full items-baseline justify-between gap-2 text-sm">
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className="text-xs font-semibold text-muted tabular-nums">{index + 1}</span>
                            <span className="truncate font-medium">{localName(locale, product)}</span>
                          </span>
                          <span className="flex shrink-0 items-baseline gap-2">
                            <span className="text-xs text-muted tabular-nums">{t("sold", { count: product.quantity })}</span>
                            <span className="font-semibold tabular-nums">{money(product.money).main}</span>
                          </span>
                        </span>
                        <ProgressBar value={inChart(product.money)} max={mostSold} size="sm" label={localName(locale, product)} />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </ChartCard>
          </div>

          <section id="orders" className="flex scroll-mt-20 flex-col gap-3">
            <h2 className="text-base font-semibold">{t("ordersTitle")}</h2>
            {report.ordersLimited && (
              <Notice tone="info">
                {t("ordersLimited", { count: report.orders.length })}{" "}
                <Link href={ordersHref} className="font-semibold underline">
                  {t("allOrders")}
                </Link>
              </Notice>
            )}
            <div className="print:hidden">
              <DataGrid
                key={listKey}
                syncUrl
                onViewChange={({ chip }) => setActiveChip(isTableChip(chip) ? chip : null)}
                rows={report.orders}
                getRowId={(row) => row.id}
                columns={columns}
                searchText={(row) => `#${row.orderNumber} ${row.orderNumber} ${row.buyerName}`}
                searchPlaceholder={t("searchOrders")}
                chips={TABLE_CHIPS.map((chip) => ({ value: chip, label: t(`chip_${chip}`), predicate: (row: Row) => inChip(chip, row) }))}
                onRowClick={(row) => router.push(orderHref(row.id))}
                initialSort={{ key: "order", direction: "desc" }}
                defaultPageSize={10}
                renderCard={(row) => (
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex w-full items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold">
                        <DataGridHighlight text={`#${row.orderNumber}`} /> · <DataGridHighlight text={row.buyerName || t("walkIn")} />
                      </span>
                      <span className={row.status === "cancelled" ? "shrink-0 font-semibold tabular-nums text-muted line-through" : "shrink-0 font-semibold tabular-nums"}>{formatMoney(row.totalMinor, row.currency)}</span>
                    </p>
                    <p className="w-full truncate text-xs text-muted">{[dateTime(row.createdAt), channelLabel(row), t(`pay_${row.paymentMethod}`), statusLabel(row)].join(" · ")}</p>
                  </div>
                )}
                exportFileName="sales-report"
                storageKey="seller-sales-report-v1"
                emptyTitle={t("empty")}
              />
            </div>
            <PrintTable columns={columns} rows={report.orders} getRowId={(row) => row.id} />
          </section>
        </>
      )}
    </SubPage>
  );
}
