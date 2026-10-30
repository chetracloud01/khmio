import { describe, expect, it } from "vitest";
import { changePercent, costedGoods, dashboardBrief, hourWindow, previousRange } from "./dashboard";
import { profitLossReport } from "./profit-loss";
import { salesReport, type SalesGroup } from "./sales-report";

const TODAY = "2026-10-29";
const group = (over: Partial<SalesGroup>): SalesGroup => ({ day: TODAY, hour: 10, channel: "in_store", paymentMethod: "cash", fulfilment: "in_store", status: "completed", currency: "USD", booking: false, orders: 1, total: 1000, ...over });
const groups = [group({}), group({ channel: "online", paymentMethod: "khqr", fulfilment: "pickup", hour: 9, total: 3000 }), group({ day: "2026-10-28", total: 500 }), group({ day: "2026-10-21", total: 700 })];
const reportOf = (query: Parameters<typeof salesReport>[2]) => salesReport(groups, [], query, TODAY, "USD");

describe("the dashboard", () => {
  it("compares a period with the same number of days just before it", () => {
    expect(previousRange({ from: TODAY, to: TODAY })).toEqual({ from: "2026-10-28", to: "2026-10-28" });
    expect(previousRange({ from: "2026-10-23", to: TODAY })).toEqual({ from: "2026-10-16", to: "2026-10-22" });
  });

  it("a change in whole percent; nothing before, nothing to compare; a loss growing smaller is up", () => {
    expect([changePercent(120, 100), changePercent(50, 100), changePercent(5, 0), changePercent(-50, -100)]).toEqual([20, -50, null, 50]);
  });

  it("today's hours run from the morning to now, wider when a sale was earlier or later", () => {
    expect(hourWindow(() => false, 8)).toEqual([6, 7, 8]);
    expect(hourWindow((hour) => hour === 5 || hour === 21, 8)).toEqual(Array.from({ length: 17 }, (_, index) => index + 5));
  });

  it("the goods with a cost price are the goods less those without one", () => {
    expect(costedGoods({ goods: { USD: 1000, KHR: 80_000 }, missingCostSales: { USD: 300, KHR: 0 } })).toEqual({ USD: 700, KHR: 80_000 });
  });

  it("today: by hour, each beside yesterday's same hour; in the shop and online apart", () => {
    const brief = dashboardBrief({ period: "today", days: { from: TODAY, to: TODAY }, sales: reportOf({ period: "today" }), salesBefore: reportOf({ period: "custom", from: "2026-10-28", to: "2026-10-28" }), profit: null, stock: null, nowHour: 11 });
    expect(brief.unit).toBe("hour");
    expect(brief.sales.points.map((point) => point.key)).toEqual(["6", "7", "8", "9", "10", "11"]);
    expect(brief.sales.points.find((point) => point.key === "10")).toEqual({ key: "10", shop: { USD: 1000, KHR: 0 }, online: { USD: 0, KHR: 0 }, orders: 1, previous: { USD: 500, KHR: 0 } });
    expect([brief.sales.now.sales.USD, brief.sales.before.sales.USD, brief.sales.now.shop.USD, brief.sales.now.online.USD]).toEqual([4000, 500, 1000, 3000]);
    expect(brief.previousDays).toEqual({ from: "2026-10-28", to: "2026-10-28" });
  });

  it("7 days: each day beside the same day of the week before; profit by day; below Pro, no profit", () => {
    const week = { from: "2026-10-23", to: TODAY };
    const now = profitLossReport([], [], [], { period: "week" }, TODAY);
    const brief = dashboardBrief({ period: "week", days: week, sales: reportOf({ period: "week" }), salesBefore: reportOf({ period: "custom", ...previousRange(week) }), profit: { now, before: now }, stock: null, nowHour: 11 });
    expect(brief.sales.points).toHaveLength(7);
    expect(brief.sales.points.at(-2)).toMatchObject({ key: "2026-10-28", previous: { USD: 700, KHR: 0 } });
    expect(brief.profit?.points).toHaveLength(7);
    expect(dashboardBrief({ period: "week", days: week, sales: reportOf({ period: "week" }), salesBefore: reportOf({ period: "week" }), profit: null, stock: null, nowHour: 11 }).profit).toBeNull();
  });
});
