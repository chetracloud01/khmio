"use client";

import { AGE_BUCKETS, GOODS_STATES, PURCHASE_PAYMENT_STATES, type AgeBucket, type Currency, type GoodsState, type PayablesCurrencyReport, type PurchasePaymentState } from "@khmio/shared";
import { cn } from "@khmio/ui";
import { BarChart3, Hourglass, ListChecks } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLOR, ChartCard, ChartLegend, ChartTooltipBox, compactMoney } from "@/components/home/chart-parts";
import { useDateText } from "@/components/use-date-text";
import { PaymentStatePill } from "./payment-ui";

// The Bills & payables report's charts (design/screens.md S17), in the home's
// chart look (components/home/chart-parts): what was bought and paid over the
// period, how late what's owed is, and each payment standing against whether
// the goods arrived. Each draws one currency: the bills' own, or all of them
// converted when the report is shown in one.

type StatusCell = { count: number; bought: number; owed: number };

/** Each ageing bucket's bar: later is redder. */
const AGE_COLORS: Record<AgeBucket, string> = {
  not_due: CHART_COLOR.main,
  late_1_30: "rgb(var(--color-warning))",
  late_31_60: "rgb(var(--color-warning))",
  late_61_90: CHART_COLOR.danger,
  late_over_90: CHART_COLOR.danger,
};

/** Bought (by the bill's day) beside paid (by the payment's day), a pair of bars per day or month. */
export function BoughtPaidChart({ series, unit, money }: { series: { key: string; bought: number; paid: number }[]; unit: "day" | "month"; money: { full: (amount: number) => string; short: (amount: number) => string } }) {
  const t = useTranslations("Payables");
  const { day, monthYear } = useDateText();
  const label = (key: string) => (unit === "day" ? day(key) : monthYear(key));
  const byKey = new Map(series.map((point) => [point.key, point]));
  const hasBars = series.some((point) => point.bought !== 0 || point.paid !== 0);
  return (
    <ChartCard icon={BarChart3} title={t("boughtPaidTitle")} subtitle={t(unit === "day" ? "byDay" : "byMonth")}>
      {hasBars ? (
        <div className="flex flex-col gap-2">
          <div className="h-56 w-full" role="img" aria-label={t("boughtPaidTitle")}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
                <XAxis dataKey="key" tickFormatter={label} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
                <YAxis tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} width={56} allowDecimals={false} tickFormatter={(value: number) => money.short(value)} />
                <Tooltip
                  cursor={{ fill: CHART_COLOR.mainSoft, opacity: 0.4 }}
                  content={({ active, label: key }) => {
                    const point = active && typeof key === "string" ? byKey.get(key) : undefined;
                    if (!point) return null;
                    return (
                      <ChartTooltipBox
                        title={label(point.key)}
                        rows={[
                          { color: CHART_COLOR.main, label: t("colBought"), value: money.full(point.bought) },
                          { color: CHART_COLOR.neutral, label: t("colPaid"), value: money.full(point.paid) },
                        ]}
                      />
                    );
                  }}
                />
                <Bar dataKey="bought" fill={CHART_COLOR.main} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                <Bar dataKey="paid" fill={CHART_COLOR.neutral} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend
            items={[
              { color: CHART_COLOR.main, label: t("colBought") },
              { color: CHART_COLOR.neutral, label: t("colPaid") },
            ]}
          />
        </div>
      ) : (
        <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("nothingInPeriod")}</p>
      )}
    </ChartCard>
  );
}

/** What's owed by how late (by due day; a bill with no due day is never late): one bar per bucket, later redder, each with its amount. */
export function PayablesAgeing({ ageing, owed, money }: { ageing: PayablesCurrencyReport["ageing"]; owed: number; money: (amount: number) => string }) {
  const t = useTranslations("Payables");
  return (
    <ChartCard icon={Hourglass} title={t("ageingTitle")} subtitle={t("ageingHint")}>
      <ul className="flex flex-col gap-3">
        {AGE_BUCKETS.map((bucket) => {
          const amount = ageing[bucket];
          const share = owed > 0 ? Math.round((amount / owed) * 100) : 0;
          return (
            <li key={bucket} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span>{t(`age_${bucket}`)}</span>
                <span className="flex items-baseline gap-2">
                  <span className="text-xs text-muted tabular-nums">{share}%</span>
                  <span className={cn("font-semibold tabular-nums", amount > 0 && bucket !== "not_due" && "text-danger")}>{money(amount)}</span>
                </span>
              </span>
              <span className="h-2.5 overflow-hidden rounded-full bg-border/40" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${amount > 0 ? Math.max(2, share) : 0}%`, backgroundColor: AGE_COLORS[bucket] }} />
              </span>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

/**
 * Each payment standing against whether the goods arrived: a card per
 * standing with its two halves — how many bills, and what they still owe (a
 * paid row: what they bought). Each number opens Purchases filtered to those
 * bills.
 */
export function PayablesStatusTable({ status, money, hrefFor, note }: { status: PayablesCurrencyReport["status"]; money: (amount: number) => string; hrefFor: (state: PurchasePaymentState, goods: GoodsState) => string; /** Under the cards: what the links can't filter. */ note?: string }) {
  const t = useTranslations("Payables");
  const tPurchases = useTranslations("Purchases");
  const half = (state: PurchasePaymentState, goods: GoodsState, cell: StatusCell) => {
    const content = (
      <>
        <span className="text-xs text-muted">{tPurchases(`goods_${goods}`)}</span>
        <span className="font-semibold tabular-nums">{cell.count === 0 ? "—" : money(state === "paid" ? cell.bought : cell.owed)}</span>
        <span className="text-xs text-muted">{t("billCount", { count: cell.count })}</span>
      </>
    );
    const box = "flex min-h-touch min-w-0 flex-col gap-0.5 rounded-xl bg-canvas p-3";
    return cell.count === 0 ? (
      <div key={goods} className={cn(box, "opacity-60")}>
        {content}
      </div>
    ) : (
      <Link key={goods} href={hrefFor(state, goods)} className={cn(box, "transition-colors hover:bg-brand/10")}>
        {content}
      </Link>
    );
  };
  return (
    <ChartCard icon={ListChecks} title={t("statusTitle")} subtitle={t("statusHint")}>
      <div className="grid gap-3 sm:grid-cols-2">
        {PURCHASE_PAYMENT_STATES.map((state) => (
          <div key={state} className="flex flex-col gap-2 rounded-2xl border border-border p-3">
            <span className="self-start">
              <PaymentStatePill state={state} />
            </span>
            <div className="grid grid-cols-2 gap-2">{GOODS_STATES.map((goods) => half(state, goods, status[state][goods]))}</div>
          </div>
        ))}
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
    </ChartCard>
  );
}

/** A view's money: in full ("$1,044.50") and short for an axis ("$1k"). */
export function moneyOf(currency: Currency, format: (amount: number, currency: Currency) => string) {
  return { full: (amount: number) => format(amount, currency), short: (amount: number) => compactMoney(amount, currency) };
}
