"use client";

import type { Currency } from "@khmio/shared";
import { ProgressBar } from "@khmio/ui";
import { PieChart } from "lucide-react";
import { useTranslations } from "next-intl";
import { CHART_COLOR, ChartCard } from "@/components/home/chart-parts";
import { RingChart } from "@/components/home/ring-chart";
import { chartAmount, moneyLines } from "@/components/reports/report-money";
import type { Dashboard } from "@/lib/api";

/**
 * Where the period's sales came from (design/screens.md S3): in the shop or
 * online as a ring (sized in the shop's currency, the other turned at its
 * rate), then the top ways buyers paid.
 */
export function SalesMixCard({ dashboard, mainCurrency, rate, href }: { dashboard: Dashboard; mainCurrency: Currency; rate: number; href: string }) {
  const t = useTranslations("HomeDashboard");
  const tSales = useTranslations("SalesReport");
  const inMain = (money: Record<Currency, number>) => chartAmount(money, mainCurrency, mainCurrency, rate);
  const money = (value: Record<Currency, number>) => moneyLines(value, mainCurrency, null, rate).main;
  const { now, payments } = { now: dashboard.sales.now, payments: dashboard.sales.payments };
  const mostPaid = Math.max(1, ...payments.map((payment) => payment.orders));

  return (
    <ChartCard icon={PieChart} title={t("mixTitle")} subtitle={t("mixHint")} link={{ href, label: t("viewReport") }}>
      {now.orders === 0 ? (
        <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("noSales")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <RingChart
            label={t("mixTitle")}
            center={{ label: t("ordersLabel"), value: String(now.orders) }}
            parts={[
              { key: "shop", label: t("inShop"), amount: inMain(now.shop), color: CHART_COLOR.main, text: money(now.shop) },
              { key: "online", label: t("online"), amount: inMain(now.online), color: CHART_COLOR.neutralLine, text: money(now.online) },
            ]}
          />
          <ul className="flex flex-col gap-2 border-t border-border pt-3">
            {payments.map((payment) => (
              <li key={payment.method} className="flex flex-col gap-1">
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span>{tSales(`pay_${payment.method}`)}</span>
                  <span className="text-xs text-muted tabular-nums">{t("orders", { count: payment.orders })}</span>
                </span>
                <ProgressBar value={payment.orders} max={mostPaid} size="sm" label={`${tSales(`pay_${payment.method}`)}: ${t("orders", { count: payment.orders })}`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
