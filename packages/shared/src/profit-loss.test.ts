import { describe, expect, it } from "vitest";
import { marginPercent, profitLossReport, type ProfitLossItem, type ProfitLossMove, type ProfitLossOrderDay } from "./profit-loss";

const TODAY = "2026-10-29";
const orderDay = (over: Partial<ProfitLossOrderDay>): ProfitLossOrderDay => ({ day: TODAY, currency: "USD", orders: 1, subtotal: 10_000, discount: 0, deliveryFee: 0, vat: 0, ...over });
const item = (over: Partial<ProfitLossItem>): ProfitLossItem => ({ day: TODAY, productId: "p1", nameKm: "កង់", nameEn: "Tyre", currency: "USD", quantity: 1, sales: 10_000, costedSales: 10_000, cost: 6000, ...over });
const move = (over: Partial<ProfitLossMove>): ProfitLossMove => ({ day: TODAY, direction: "out", reason: "damaged", units: 1, currency: "USD", value: 500, unvalued: 0, fixed: false, ...over });

const orderDays = [orderDay({ orders: 2, subtotal: 12_000, discount: 1000, deliveryFee: 300, vat: 1100 }), orderDay({ currency: "KHR", subtotal: 80_000 }), orderDay({ day: "2026-08-01", subtotal: 5000 })];
const items = [
  item({ quantity: 2, sales: 9000, costedSales: 9000, cost: 5000 }),
  item({ productId: "p2", nameEn: "Oil", sales: 2000, costedSales: 0, cost: 0 }),
  item({ productId: "p3", currency: "KHR", sales: 80_000, costedSales: 80_000, cost: 50_000 }),
  item({ day: "2026-08-01", sales: 5000, costedSales: 5000, cost: 1000 }),
];
const moves = [
  move({}),
  move({ reason: "count_correction", units: 2, value: 800, fixed: true }),
  move({ direction: "in", reason: "count_correction", units: 1, value: 300, fixed: true }),
  move({ reason: "supplier_return", value: 9999 }),
  move({ direction: "in", reason: "free_goods", value: 9999 }),
  move({ reason: "lost", currency: null, value: 0, unvalued: 3 }),
];

describe("the profit and loss report", () => {
  it("the statement: sales less discounts, plus delivery, less cost and sales without a cost, less stock lost, plus stock found", () => {
    const { statement } = profitLossReport(orderDays, items, moves, { period: "month" }, TODAY);
    expect(statement).toMatchObject({
      grossSales: { USD: 12_000, KHR: 80_000 },
      discounts: { USD: -1000, KHR: 0 },
      goods: { USD: 11_000, KHR: 80_000 },
      deliveryFees: { USD: 300, KHR: 0 },
      netSales: { USD: 11_300, KHR: 80_000 },
      cost: { USD: 5000, KHR: 50_000 },
      missingCostSales: { USD: 2000, KHR: 0 },
      grossProfit: { USD: 4300, KHR: 30_000 },
      losses: { USD: -1300, KHR: 0 },
      found: { USD: 300, KHR: 0 },
      profit: { USD: 3300, KHR: 30_000 },
      vat: { USD: 1100, KHR: 0 },
      orders: 3,
    });
  });

  it("says what isn't known: sales without a cost, losses at today's cost, units without a cost", () => {
    const { statement } = profitLossReport(orderDays, items, moves, { period: "month" }, TODAY);
    expect(statement.missingCostSales).toEqual({ USD: 2000, KHR: 0 });
    expect(statement.lossesEstimated).toBe(true);
    expect(statement.unvaluedUnits).toBe(3);
    expect(profitLossReport(orderDays, items, [moves[1]!], { period: "month" }, TODAY).statement.lossesEstimated).toBe(false);
  });

  it("leaves out stock that isn't a loss: a supplier return, free goods", () => {
    const report = profitLossReport([], [], moves, { period: "month" }, TODAY);
    expect(report.moves.map((entry) => `${entry.direction}:${entry.reason}`).sort()).toEqual(["in:count_correction", "out:count_correction", "out:damaged", "out:lost"]);
  });

  it("each bar's profit is its net sales less cost and losses; products by profit, from lines with a cost", () => {
    const report = profitLossReport(orderDays, items, moves, { period: "week" }, TODAY);
    expect(report.series.at(-1)).toEqual({ key: TODAY, netSales: { USD: 11_300, KHR: 80_000 }, costedSales: { USD: 9000, KHR: 80_000 }, cost: { USD: 5000, KHR: 50_000 }, losses: { USD: -1000, KHR: 0 }, profit: { USD: 3300, KHR: 30_000 } });
    expect(report.products.map((product) => [product.productId, product.profit.USD, product.profit.KHR, product.missingCostSales.USD])).toEqual([["p1", 4000, 0, 0], ["p3", 0, 30_000, 0], ["p2", 0, 0, 2000]]);
  });

  it("everything: from the first sale, month by month", () => {
    const report = profitLossReport(orderDays, items, moves, { period: "all" }, TODAY);
    expect([report.unit, report.series[0]?.key, report.statement.grossSales.USD]).toEqual(["month", "2026-08", 17_000]);
  });

  it("a margin in whole percent, none without sales", () => {
    expect([marginPercent(6300, 11_300), marginPercent(-50, 100), marginPercent(5, 0)]).toEqual([56, -50, null]);
  });
});
