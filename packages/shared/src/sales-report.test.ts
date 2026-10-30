import { describe, expect, it } from "vitest";
import { salesReport, type SalesGroup, type SalesItemRow } from "./sales-report";

const TODAY = "2026-10-29";
const group = (over: Partial<SalesGroup>): SalesGroup => ({ day: TODAY, hour: 10, channel: "in_store", paymentMethod: "cash", fulfilment: "in_store", status: "completed", currency: "USD", booking: false, orders: 1, total: 1000, ...over });
const item = (over: Partial<SalesItemRow>): SalesItemRow => ({ day: TODAY, productId: "p1", nameKm: "កង់", nameEn: "Tyre", currency: "USD", quantity: 1, total: 1000, ...over });

const groups = [
  group({ orders: 2, total: 3000 }),
  group({ channel: "online", paymentMethod: "khqr", fulfilment: "delivery", status: "delivered", hour: 20, total: 2500 }),
  group({ channel: "online", paymentMethod: "cod", fulfilment: "delivery", status: "out_for_delivery", currency: "KHR", total: 40_000 }),
  group({ channel: "online", paymentMethod: "cod", fulfilment: "delivery", status: "failed_delivery", day: "2026-10-27", total: 1500 }),
  group({ channel: "online", paymentMethod: "cash", fulfilment: "pickup", status: "confirmed", booking: true, total: 5000 }),
  group({ status: "cancelled", total: 700 }),
  group({ channel: "online", paymentMethod: "khqr", fulfilment: "delivery", status: "awaiting_payment", total: 9999 }),
  group({ day: "2026-08-01", total: 4000 }),
];

describe("the sales report", () => {
  it("adds up sales in the shop and online, never counting cancelled or unpaid online orders", () => {
    const { figures } = salesReport(groups, [], { period: "month" }, TODAY, "USD");
    expect(figures.shop).toEqual({ orders: 2, ordersBy: { USD: 2, KHR: 0 }, sales: { USD: 3000, KHR: 0 } });
    expect(figures.online).toEqual({ orders: 4, ordersBy: { USD: 3, KHR: 1 }, sales: { USD: 9000, KHR: 40_000 }, bookings: 1 });
    expect(figures.all.sales).toEqual({ USD: 12_000, KHR: 40_000 });
    expect(figures.cancelled).toEqual({ orders: 1, money: { USD: 700, KHR: 0 } });
  });

  it("the average order is per currency; cash still to collect is cash on delivery not finished", () => {
    const { figures } = salesReport(groups, [], { period: "month" }, TODAY, "USD");
    expect(figures.average).toEqual({ USD: 2400, KHR: 40_000 });
    expect(figures.toCollect).toEqual({ orders: 2, money: { USD: 1500, KHR: 40_000 } });
  });

  it("day by day in the shop and online, by payment, by hour, and how online orders reached the buyer", () => {
    const report = salesReport(groups, [], { period: "week" }, TODAY, "USD");
    expect(report.unit).toBe("day");
    expect(report.series.at(-1)).toEqual({ key: TODAY, shop: { USD: 3000, KHR: 0 }, online: { USD: 7500, KHR: 40_000 }, orders: 5 });
    expect(report.payments.map((payment) => [payment.method, payment.orders])).toEqual([["cash", 3], ["cod", 2], ["khqr", 1]]);
    expect(report.hours[20]).toEqual({ hour: 20, orders: 1, money: { USD: 2500, KHR: 0 }, shop: { USD: 0, KHR: 0 }, online: { USD: 2500, KHR: 0 } });
    expect(report.delivery).toEqual({ delivery: 3, pickup: 1, done: 1, failed: 1, underway: 2, successRate: 50 });
  });

  it("reads only the period; everything is drawn from the first sale", () => {
    expect(salesReport(groups, [], { period: "today" }, TODAY, "USD").figures.all.orders).toBe(5);
    const everything = salesReport(groups, [], { period: "all" }, TODAY, "USD");
    expect(everything.figures.all.orders).toBe(7);
    expect([everything.unit, everything.series[0]?.key]).toEqual(["month", "2026-08"]);
  });

  it("best sellers by money in the shop's currency, then the other, then units", () => {
    const items = [item({ quantity: 2, total: 2000 }), item({ productId: "p2", nameEn: "Oil", total: 3000 }), item({ productId: "p3", currency: "KHR", total: 90_000 }), item({ productId: "p1", day: "2026-01-01", total: 99_000 })];
    const report = salesReport([], items, { period: "month" }, TODAY, "USD");
    expect(report.products.map((product) => [product.productId, product.quantity])).toEqual([["p2", 1], ["p1", 2], ["p3", 1]]);
    expect(salesReport([], items, { period: "month" }, TODAY, "KHR").products[0]?.productId).toBe("p3");
  });
});
