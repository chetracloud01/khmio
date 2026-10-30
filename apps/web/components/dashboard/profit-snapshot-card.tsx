"use client";

import { marginPercent, type Currency } from "@khmio/shared";
import { FileText } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChartCard } from "@/components/home/chart-parts";
import { ProfitStatement, type StatementLine } from "@/components/reports/profit-statement";
import { chartAmount, moneyLines } from "@/components/reports/report-money";
import type { Dashboard } from "@/lib/api";

type Money = Record<Currency, number>;
const hasSome = (money: Money) => money.USD !== 0 || money.KHR !== 0;
const negate = (money: Money): Money => ({ USD: -money.USD, KHR: -money.KHR });

/**
 * The period's profit in five lines (design/screens.md S3; Pro): net sales,
 * less the cost of goods (and the sales without a cost price, left out), gross
 * profit and its margin, less stock lost, the profit — the same statement as
 * the Profit & loss report, cut short.
 */
export function ProfitSnapshotCard({ profit, mainCurrency, rate, href, addCostsHref }: { profit: NonNullable<Dashboard["profit"]>; mainCurrency: Currency; rate: number; href: string; addCostsHref: string }) {
  const t = useTranslations("HomeDashboard");
  const tPl = useTranslations("ProfitLoss");
  const { now } = profit;
  const money = (value: Money, sign = false) => moneyLines(value, mainCurrency, null, rate, sign);
  const inMain = (value: Money) => chartAmount(value, mainCurrency, mainCurrency, rate);
  const margin = marginPercent(inMain(now.costedGoods) - inMain(now.cost), inMain(now.costedGoods));
  const stockMoved = { USD: now.losses.USD + now.found.USD, KHR: now.losses.KHR + now.found.KHR };
  const lines: StatementLine[] = [
    { key: "netSales", label: tPl("netSales"), amount: money(now.netSales), kind: "line" },
    { key: "cost", label: tPl("costOfGoods"), amount: money(negate(now.cost), true), kind: "line", negative: hasSome(now.cost) },
    ...(hasSome(now.missingCostSales) ? [{ key: "missing", label: tPl("missingCost"), amount: money(negate(now.missingCostSales), true), kind: "line" as const, negative: true }] : []),
    { key: "grossProfit", label: tPl("grossProfit"), hint: margin === null ? undefined : tPl("marginLine", { value: tPl("percent", { value: margin }) }), amount: money(now.grossProfit), kind: "subtotal", negative: inMain(now.grossProfit) < 0 },
    ...(hasSome(stockMoved) ? [{ key: "stock", label: t("stockLostNet"), hint: now.lossesEstimated ? tPl("lossesEstimated") : undefined, amount: money(stockMoved, true), kind: "line" as const, negative: inMain(stockMoved) < 0 }] : []),
    { key: "profit", label: tPl("profit"), hint: tPl("profitHint"), amount: money(now.profit), kind: "result", negative: inMain(now.profit) < 0 },
  ];

  return (
    <ChartCard icon={FileText} title={t("profitTitle")} subtitle={t("profitHint")} link={{ href, label: t("viewReport") }}>
      <ProfitStatement lines={lines} label={t("profitTitle")} />
      {hasSome(now.missingCostSales) && (
        <p className="text-xs text-muted">
          {t("missingCostNote")}{" "}
          <Link href={addCostsHref} className="font-semibold text-brand underline">
            {tPl("addCosts")}
          </Link>
        </p>
      )}
    </ChartCard>
  );
}
