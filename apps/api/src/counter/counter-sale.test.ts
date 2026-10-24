import { describe, expect, it } from "vitest";
import { InvalidInputException } from "../errors";
import { counterCashAmounts, toCounterDay } from "./counter-sale";

describe("cash at the counter, on the server", () => {
  it("saves what the buyer gave and the change", () => {
    expect(counterCashAmounts({ method: "cash", receivedMinor: 1000 }, 523)).toEqual({ cashReceivedMinor: 1000, changeMinor: 477 });
    expect(counterCashAmounts({ method: "cash", receivedMinor: 523 }, 523)).toEqual({ cashReceivedMinor: 523, changeMinor: 0 });
  });

  it("refuses too little cash, whatever the phone said", () => {
    expect(() => counterCashAmounts({ method: "cash", receivedMinor: 500 }, 523)).toThrow(InvalidInputException);
  });

  it("carries no cash amounts for the shop's QR", () => {
    expect(counterCashAmounts({ method: "shop_qr", sellerConfirmed: true }, 523)).toEqual({ cashReceivedMinor: null, changeMinor: null });
  });
});

describe("today's sales at the counter", () => {
  const row = (overrides: Partial<Parameters<typeof toCounterDay>[0][number]> = {}) => ({
    id: "order-1",
    orderNumber: 41,
    createdAt: new Date("2026-10-23T03:00:00Z"),
    status: "completed" as const,
    paymentMethod: "cash" as const,
    currency: "USD" as const,
    totalMinor: 523,
    buyerName: "",
    _count: { items: 3 },
    ...overrides,
  });

  it("adds up cash and shop QR separately, and never dollars with riel", () => {
    const day = toCounterDay([row(), row({ id: "order-2", paymentMethod: "shop_qr", currency: "KHR", totalMinor: 20000 }), row({ id: "order-3", totalMinor: 100 })]);
    expect(day.totals.all).toEqual({ count: 3, USD: 623, KHR: 20000 });
    expect(day.totals.cash).toEqual({ count: 2, USD: 623, KHR: 0 });
    expect(day.totals.shopQr).toEqual({ count: 1, USD: 0, KHR: 20000 });
  });

  it("lists a voided sale, but doesn't count it", () => {
    const day = toCounterDay([row(), row({ id: "order-2", status: "cancelled" })]);
    expect(day.totals.all.count).toBe(1);
    expect(day.sales.map((sale) => sale.voided)).toEqual([false, true]);
    expect(day.sales[0]).toMatchObject({ lineCount: 3, createdAt: "2026-10-23T03:00:00.000Z" });
  });
});
