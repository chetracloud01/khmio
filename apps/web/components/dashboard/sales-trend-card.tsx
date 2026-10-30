"use client";

import type { Currency } from "@khmio/shared";
import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLOR, ChartCard, ChartLegend, ChartTooltipBox, compactMoney } from "@/components/home/chart-parts";
import { chartAmount, moneyLines } from "@/components/reports/report-money";
import { useDateText } from "@/components/use-date-text";
import type { Dashboard } from "@/lib/api";

/**
 * The dashboard's sales trend (design/screens.md S3): in the shop and online
 * stacked, today hour by hour or day by day, with the period before as a
 * dashed line. Drawn in the shop's currency (the other turned at its rate,
 * as the note says); the tooltip writes each currency as it was.
 */
export function SalesTrendCard({ dashboard, mainCurrency, rate, previousLabel, href }: { dashboard: Dashboard; mainCurrency: Currency; rate: number; previousLabel: string; href: string }) {
  const t = useTranslations("HomeDashboard");
  const { day } = useDateText();
  const inMain = (money: Record<Currency, number>) => chartAmount(money, mainCurrency, mainCurrency, rate);
  const money = (value: Record<Currency, number>) => moneyLines(value, mainCurrency, null, rate);
  const { points } = dashboard.sales;
  const data = points.map((point) => ({ key: point.key, shop: inMain(point.shop), online: inMain(point.online), previous: inMain(point.previous) }));
  const byKey = new Map(points.map((point) => [point.key, point]));
  const label = (key: string) => (dashboard.unit === "hour" ? t("hour", { hour: key }) : day(key));
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";
  const turned = points.some((point) => point.shop[other] + point.online[other] + point.previous[other] > 0);
  const hasSales = data.some((point) => point.shop + point.online + point.previous > 0);

  return (
    <ChartCard icon={BarChart3} title={t("trendTitle")} subtitle={turned ? t("trendTurned") : t(dashboard.unit === "hour" ? "trendByHour" : "trendByDay")} link={{ href, label: t("viewReport") }}>
      {hasSales ? (
        <div className="flex flex-col gap-2">
          <div className="h-60 w-full" role="img" aria-label={t("trendTitle")}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART_COLOR.grid} />
                <XAxis dataKey="key" tickFormatter={label} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tickFormatter={(value: number) => compactMoney(value, mainCurrency)} tick={{ fontSize: 11, fill: CHART_COLOR.axis }} tickLine={false} axisLine={false} width={48} />
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
                          { color: CHART_COLOR.neutral, label: previousLabel, value: money(point.previous).main, dashed: true },
                        ]}
                      />
                    );
                  }}
                />
                <Bar dataKey="shop" stackId="sales" fill={CHART_COLOR.main} maxBarSize={22} isAnimationActive={false} />
                <Bar dataKey="online" stackId="sales" fill={CHART_COLOR.neutralLine} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                <Line type="monotone" dataKey="previous" stroke={CHART_COLOR.neutral} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend
            items={[
              { color: CHART_COLOR.main, label: t("inShop") },
              { color: CHART_COLOR.neutralLine, label: t("online") },
              { color: CHART_COLOR.neutral, label: previousLabel, dashed: true },
            ]}
          />
        </div>
      ) : (
        <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noSales")}</p>
      )}
    </ChartCard>
  );
}
