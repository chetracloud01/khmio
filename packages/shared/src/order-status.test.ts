import { describe, expect, it } from "vitest";
import { orderStatusFigures, type OrderStatusGroup } from "./order-status";

const group = (over: Partial<OrderStatusGroup>): OrderStatusGroup => ({ status: "cod_pending", paymentMethod: "cod", currency: "USD", today: true, orders: 1, total: 1000, ...over });

describe("the Orders page's status tiles", () => {
  const figures = orderStatusFigures([
    group({ orders: 2, total: 3000 }),
    group({ status: "paid", paymentMethod: "khqr", currency: "KHR", total: 40_000 }),
    group({ status: "packing", today: false, total: 500 }),
    group({ status: "out_for_delivery", total: 700 }),
    group({ status: "failed_delivery", total: 900 }),
    group({ status: "cancelled", orders: 3, total: 1200 }),
    group({ status: "completed", total: 5000 }),
    group({ status: "awaiting_payment", paymentMethod: "khqr", total: 9999 }),
  ]);

  it("each tile counts what its tab lists, dollars and riel apart", () => {
    expect(figures.tabs.to_confirm).toEqual({ count: 3, money: { USD: 3000, KHR: 40_000 } });
    expect(figures.tabs.packing).toEqual({ count: 1, money: { USD: 500, KHR: 0 } });
    expect(figures.tabs.sending).toEqual({ count: 1, money: { USD: 700, KHR: 0 } });
    expect(figures.tabs.problems).toEqual({ count: 4, money: { USD: 2100, KHR: 0 } });
    expect(figures.notDelivered).toBe(1);
  });

  it("cash to collect: cash on delivery not completed or cancelled", () => {
    expect(figures.toCollect).toEqual({ count: 5, money: { USD: 5100, KHR: 0 } });
  });

  it("today's sales leave out cancelled and unpaid online orders, and earlier days", () => {
    expect(figures.today).toEqual({ count: 6, money: { USD: 9600, KHR: 40_000 } });
  });
});
