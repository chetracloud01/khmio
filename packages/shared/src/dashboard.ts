import { z } from "zod";
import type { Currency } from "./money";
import type { ProfitLossReport, ProfitLossStatement } from "./profit-loss";
import type { SalesReport } from "./sales-report";
import { addDays, daysBetween, HOURS_IN_DAY } from "./time";

// The seller's dashboard (design/screens.md S3): a short summary of the
// business for one period — today, 7 days or 30 days — each figure beside the
// period before, from the same sums as the reports (sales-report.ts,
// profit-loss.ts), so the dashboard and a report never disagree. Pure, so
// it's tested without a database; the API reads the reports and hands them in.

type Money = Record<Currency, number>;

export const DASHBOARD_PERIODS = ["today", "week", "month"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];
export const dashboardQuerySchema = z.object({ period: z.enum(DASHBOARD_PERIODS).default("today") });

/** Today's chart starts no later than this hour (a shop's morning), and ends no earlier than now. */
export const DAY_CHART_FIRST_HOUR = 6;
/** How many best sellers and payment ways the dashboard lists (the reports have them all). */
export const DASHBOARD_TOP_PRODUCTS = 5;
export const DASHBOARD_TOP_PAYMENTS = 3;

/** The days just before a range, as many as it has: the period to compare with. */
export function previousRange(days: { from: string; to: string }): { from: string; to: string } {
  const length = daysBetween(days.from, days.to) + 1;
  return { from: addDays(days.from, -length), to: addDays(days.from, -1) };
}

/** Whole-percent change, or null when there was nothing before to compare with. */
export function changePercent(now: number, before: number): number | null {
  if (before === 0) return null;
  return Math.round(((now - before) / Math.abs(before)) * 100);
}

/** Today's hours worth drawing: from the morning (or the first sale, if earlier) to now (or the last sale, if later). */
export function hourWindow(hasSales: (hour: number) => boolean, nowHour: number): number[] {
  const hours = Array.from({ length: HOURS_IN_DAY }, (_, hour) => hour);
  const withSales = hours.filter(hasSales);
  const first = Math.min(DAY_CHART_FIRST_HOUR, withSales[0] ?? DAY_CHART_FIRST_HOUR);
  const last = Math.max(nowHour, withSales.at(-1) ?? nowHour);
  return hours.filter((hour) => hour >= first && hour <= last);
}

/** The goods sold with a cost price — what a margin is of (delivery fees cost nothing, so they'd lift it). */
export const costedGoods = (statement: Pick<ProfitLossStatement, "goods" | "missingCostSales">): Money => ({
  USD: statement.goods.USD - statement.missingCostSales.USD,
  KHR: statement.goods.KHR - statement.missingCostSales.KHR,
});

const salesFigures = ({ figures }: SalesReport) => ({ sales: figures.all.sales, orders: figures.all.orders, average: figures.average, shop: figures.shop.sales, online: figures.online.sales, bookings: figures.online.bookings });
const profitFigures = ({ statement }: ProfitLossReport) => ({
  netSales: statement.netSales,
  costedGoods: costedGoods(statement),
  cost: statement.cost,
  missingCostSales: statement.missingCostSales,
  grossProfit: statement.grossProfit,
  losses: statement.losses,
  found: statement.found,
  profit: statement.profit,
  lossesEstimated: statement.lossesEstimated,
});
const plus = (a: Money, b: Money): Money => ({ USD: a.USD + b.USD, KHR: a.KHR + b.KHR });

export interface DashboardInput {
  period: DashboardPeriod;
  days: { from: string; to: string };
  sales: SalesReport;
  salesBefore: SalesReport;
  /** Pro: the profit and loss for the period and the one before; null below it. */
  profit: { now: ProfitLossReport; before: ProfitLossReport } | null;
  /** Plans with stock: the shelf's worth now, items to reorder and bills not paid; null below them. */
  stock: { value: Money; withoutCost: number; toReorder: number; unpaidBills: number; overdueBills: number } | null;
  nowHour: number;
}

/** The dashboard's figures for a period: each beside the period before, the sales chart's points, the top lists. */
export function dashboardBrief({ period, days, sales, salesBefore, profit, stock, nowHour }: DashboardInput) {
  // Today by hour (yesterday's same hour to compare); 7 and 30 days by day (the same day of the period before).
  const points =
    period === "today"
      ? hourWindow((hour) => (sales.hours[hour]?.orders ?? 0) > 0, nowHour).flatMap((hour) => {
          const now = sales.hours[hour];
          const before = salesBefore.hours[hour];
          return now && before ? [{ key: String(hour), shop: now.shop, online: now.online, orders: now.orders, previous: before.money }] : [];
        })
      : sales.series.map((point, index) => {
          const before = salesBefore.series[index];
          return { key: point.key, shop: point.shop, online: point.online, orders: point.orders, previous: before ? plus(before.shop, before.online) : { USD: 0, KHR: 0 } };
        });
  return {
    period,
    days,
    previousDays: previousRange(days),
    unit: period === "today" ? ("hour" as const) : ("day" as const),
    sales: {
      now: salesFigures(sales),
      before: salesFigures(salesBefore),
      toCollect: sales.figures.toCollect,
      points,
      payments: sales.payments.slice(0, DASHBOARD_TOP_PAYMENTS),
      products: sales.products.slice(0, DASHBOARD_TOP_PRODUCTS),
    },
    profit: profit
      ? {
          now: profitFigures(profit.now),
          before: profitFigures(profit.before),
          // By day only: there's no profit by the hour.
          points: period === "today" ? [] : profit.now.series.map((point) => ({ key: point.key, profit: point.profit })),
        }
      : null,
    stock,
  };
}
export type Dashboard = ReturnType<typeof dashboardBrief>;
