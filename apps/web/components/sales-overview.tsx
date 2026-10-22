"use client";

import type { Currency } from "@khmio/shared";
import { cn, SegmentedControl } from "@khmio/ui";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/components/order-ui";

// The seller's sales at a glance (2026-10-22 seller review), the way strong
// seller apps lead: one big number for the period with its change against the
// period before, orders / average order / cash to collect, sales per day, and
// the products that earned the most. Dollars and riel are never added: the
// shop's main currency leads, the other is shown under it (docs/blueprint.md
// "Multi-currency pricing and totals").

export type SalesPeriod = "today" | "week" | "month";
export const SALES_PERIOD_DAYS: Record<SalesPeriod, number> = { today: 1, week: 7, month: 30 };

type Money = Record<Currency, number>;

/** One Phnom Penh day of sales, oldest first; enough days for the longest period and the one before it (60). */
export interface SalesHistoryDay {
  /** "2026-10-08" */
  date: string;
  USD: number;
  KHR: number;
  /** Orders paid in each currency (an order has one). */
  ordersUSD: number;
  ordersKHR: number;
}

export interface TopProduct {
  nameKm: string;
  nameEn: string;
  quantity: number;
  USD: number;
  KHR: number;
}

const otherOf = (currency: Currency): Currency => (currency === "USD" ? "KHR" : "USD");

function sumDays(days: SalesHistoryDay[]) {
  return days.reduce(
    (sum, day) => ({ money: { USD: sum.money.USD + day.USD, KHR: sum.money.KHR + day.KHR }, orders: { USD: sum.orders.USD + day.ordersUSD, KHR: sum.orders.KHR + day.ordersKHR } }),
    { money: { USD: 0, KHR: 0 } as Money, orders: { USD: 0, KHR: 0 } as Money },
  );
}

/** Whole-percent change, or null when there was nothing before to compare with. */
function change(now: number, before: number): number | null {
  if (before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}

/** "$1.2k", "850k៛": for the chart's money axis. */
function compactMoney(amount: number, currency: Currency): string {
  const value = currency === "USD" ? amount / 100 : amount;
  const short = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  return currency === "USD" ? `$${short}` : `${short}៛`;
}

export function SalesOverview({
  days,
  top,
  cashToCollect,
  mainCurrency,
  sample = false,
}: {
  days: SalesHistoryDay[];
  top: Record<SalesPeriod, TopProduct[]>;
  cashToCollect: Money;
  mainCurrency: Currency;
  /** The mockup's made-up numbers, labelled as such. */
  sample?: boolean;
}) {
  const t = useTranslations("SellerApp");
  const locale = useLocale();
  const [period, setPeriod] = useState<SalesPeriod>("week");
  const other = otherOf(mainCurrency);
  const length = SALES_PERIOD_DAYS[period];

  const figures = useMemo(() => {
    const current = sumDays(days.slice(-length));
    const previous = sumDays(days.slice(-length * 2, -length));
    const ordersNow = current.orders.USD + current.orders.KHR;
    const ordersBefore = previous.orders.USD + previous.orders.KHR;
    return {
      sales: current.money,
      salesChange: change(current.money[mainCurrency], previous.money[mainCurrency]),
      orders: ordersNow,
      ordersChange: change(ordersNow, ordersBefore),
      average: current.orders[mainCurrency] > 0 ? Math.round(current.money[mainCurrency] / current.orders[mainCurrency]) : 0,
    };
  }, [days, length, mainCurrency]);

  // "Today" alone is one bar: show the week with today picked out.
  const chartDays = days.slice(-(period === "today" ? 7 : length));
  const dayLabel = useMemo(() => new Intl.DateTimeFormat(locale === "km" ? "km-KH" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), [locale]);
  const chartData = chartDays.map((day, index) => ({
    label: dayLabel.format(new Date(`${day.date}T00:00:00Z`)),
    amount: day[mainCurrency],
    highlight: period !== "today" || index === chartDays.length - 1,
  }));

  const products = top[period];
  const productAmount = (product: TopProduct) => (product[mainCurrency] > 0 ? product[mainCurrency] : product[other]);
  const biggest = Math.max(1, ...products.map((product) => product[mainCurrency]));

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-bg p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-normal">
          {t("salesTitle")}
          {sample && <span className="rounded-full bg-border/40 px-2 py-0.5 text-xs font-semibold text-muted">{t("sampleData")}</span>}
        </h2>
        <SegmentedControl
          value={period}
          onChange={(next) => setPeriod(next as SalesPeriod)}
          options={[
            { value: "today", label: t("periodToday") },
            { value: "week", label: t("periodWeek") },
            { value: "month", label: t("periodMonth") },
          ]}
        />
      </div>

      {/* The headline: sales in the main currency, the other under it, and how it compares. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-bold tabular-nums leading-normal">{formatMoney(figures.sales[mainCurrency], mainCurrency)}</p>
          {figures.sales[other] > 0 && <p className="text-sm text-muted tabular-nums">+ {formatMoney(figures.sales[other], other)}</p>}
        </div>
        <ChangeBadge percent={figures.salesChange} label={t(`vsPrevious_${period}`)} newLabel={t("changeNew")} hasNow={figures.sales[mainCurrency] > 0} />
      </div>

      <dl className="grid grid-cols-3 divide-x divide-border rounded-xl bg-canvas py-3">
        <Figure label={t("statOrders")} value={String(figures.orders)} extra={<ChangeText percent={figures.ordersChange} />} />
        <Figure label={t("statAverage")} value={formatMoney(figures.average, mainCurrency)} />
        <Figure label={t("statCash")} value={formatMoney(cashToCollect[mainCurrency], mainCurrency)} extra={cashToCollect[other] > 0 ? <span className="text-xs text-muted">+ {formatMoney(cashToCollect[other], other)}</span> : undefined} />
      </dl>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgb(var(--color-border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="rgb(var(--color-muted))" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={{ fontSize: 11 }} stroke="rgb(var(--color-muted))" tickLine={false} axisLine={false} width={48} tickFormatter={(value: number) => compactMoney(value, mainCurrency)} />
            <Tooltip cursor={{ fill: "rgb(var(--color-brand) / 0.06)" }} formatter={(value) => [formatMoney(Number(value), mainCurrency), t("salesTitle")]} />
            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={28}>
              {chartData.map((entry) => (
                <Cell key={entry.label} fill={entry.highlight ? "rgb(var(--color-brand))" : "rgb(var(--color-brand) / 0.25)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("topProducts")}</h3>
        {products.length === 0 ? (
          <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noSales")}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {products.map((product, index) => (
              <li key={`${product.nameEn}-${index}`} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="w-4 shrink-0 text-xs font-semibold text-muted tabular-nums">{index + 1}</span>
                    <span className="truncate font-medium">{locale === "km" ? product.nameKm || product.nameEn : product.nameEn || product.nameKm}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMoney(productAmount(product), product[mainCurrency] > 0 ? mainCurrency : other)}</span>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/50">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(4, Math.round((product[mainCurrency] / biggest) * 100))}%` }} />
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs text-muted tabular-nums">{t("soldCount", { count: product.quantity })}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Figure({ label, value, extra }: { label: string; value: string; extra?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 px-2 text-center">
      <dt className="text-xs leading-normal text-muted">{label}</dt>
      {/* Car-sized amounts must show whole: smaller on a phone, and allowed to wrap rather than be cut. */}
      <dd className="max-w-full text-sm font-bold tabular-nums leading-snug [overflow-wrap:anywhere] sm:text-base">{value}</dd>
      {extra}
    </div>
  );
}

/** ▲ 18% in green, ▼ 6% in red, — when there's nothing to compare. */
function ChangeText({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-xs text-muted">—</span>;
  const up = percent >= 0;
  return (
    <span className={cn("inline-flex items-center text-xs font-semibold tabular-nums", up ? "text-success" : "text-danger")}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
      {Math.abs(percent)}%
    </span>
  );
}

function ChangeBadge({ percent, label, newLabel, hasNow }: { percent: number | null; label: string; newLabel: string; hasNow: boolean }) {
  const up = percent !== null && percent >= 0;
  // Nothing before to compare with: "New" when there are sales now, a dash when there are none.
  const Icon = percent === null ? (hasNow ? null : Minus) : up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex flex-col items-end">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums",
          percent === null ? "bg-border/40 text-muted" : up ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
        )}
      >
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        {percent === null ? (hasNow ? newLabel : "—") : `${Math.abs(percent)}%`}
      </span>
      <span className="mt-0.5 text-xs text-muted">{label}</span>
    </div>
  );
}
