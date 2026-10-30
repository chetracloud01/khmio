import type { Tx } from "@khmio/db";
import { dashboardBrief, phnomPenhDay, phnomPenhTime, planHasFeature, previousRange, purchasePeriodDays, type DashboardPeriod, type PlanId, type ReportQuery } from "@khmio/shared";
import { readProfitLoss } from "../orders/profit-loss";
import { readSalesSums } from "../orders/sales-report";
import { readStockPage } from "../stock/stock";
import { readStockSummary } from "../stock/stock-summary";

// The seller's dashboard (design/screens.md S3), inside the seller's
// withContext: the sales report's sums for the period and the one before it,
// the profit and loss for both (Pro), and the shelf's worth with what needs
// reordering and paying (plans with stock) — added up by the same functions
// as the reports, then cut down to a summary by packages/shared dashboard.ts.

export async function readDashboard(tx: Tx, storeId: string, plan: PlanId, period: DashboardPeriod, now = new Date()) {
  const days = purchasePeriodDays(period, phnomPenhDay(now));
  const current: ReportQuery = { period };
  const before: ReportQuery = { period: "custom", ...previousRange(days) };
  // One after another: queries inside a transaction share its one connection.
  const sales = await readSalesSums(tx, storeId, current, now);
  const salesBefore = await readSalesSums(tx, storeId, before, now);
  const profit = planHasFeature(plan, "profitReport") ? { now: await readProfitLoss(tx, storeId, current, now), before: await readProfitLoss(tx, storeId, before, now) } : null;
  const stock = planHasFeature(plan, "stock") ? await readStockBrief(tx, storeId, plan) : null;
  return dashboardBrief({ period, days, sales, salesBefore, profit, stock, nowHour: phnomPenhTime(now).hour });
}

async function readStockBrief(tx: Tx, storeId: string, plan: PlanId) {
  const { value } = await readStockPage(tx, storeId, plan);
  const summary = await readStockSummary(tx, storeId);
  return { value: { USD: value.USD, KHR: value.KHR }, withoutCost: value.withoutCost, toReorder: summary.toReorder, unpaidBills: summary.unpaidBills, overdueBills: summary.overdueBills };
}
