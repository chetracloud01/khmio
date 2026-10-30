import { describe, expect, it } from "vitest";
import { moveKindOf, stockReport, type StockReportItem, type StockReportMove } from "./stock-report";

const TODAY = "2026-10-29";
const item = (variantId: string, overrides: Partial<StockReportItem> = {}): StockReportItem => ({ variantId, categoryId: "tyres", onHand: 10, low: false, costMinor: 2000, costCurrency: "USD", ...overrides });
const move = (variantId: string, day: string, direction: "in" | "out", kind: string, quantity: number): StockReportMove => ({ variantId, day, direction, kind, quantity });

describe("a movement's way and kind", () => {
  it("bought in, sold out, else its reason; transfers aren't the shop's in or out", () => {
    expect(moveKindOf("purchase", null)).toEqual({ direction: "in", kind: "bought" });
    expect(moveKindOf("sale", null)).toEqual({ direction: "out", kind: "sold" });
    expect(moveKindOf("adjust_out", "damaged")).toEqual({ direction: "out", kind: "damaged" });
    expect(moveKindOf("adjust_in", "returned")).toEqual({ direction: "in", kind: "returned" });
    expect(moveKindOf("transfer_in", null)).toBeNull();
  });
});

describe("the stock report", () => {
  const items = [item("a"), item("b", { categoryId: "oil", onHand: 3, low: true, costMinor: 40_000, costCurrency: "KHR" }), item("c", { onHand: 0 }), item("d", { onHand: null }), item("e", { onHand: 5, costMinor: null, costCurrency: null })];
  const moves = [
    move("a", "2026-10-25", "in", "bought", 6),
    move("a", "2026-10-26", "out", "sold", 2),
    move("a", "2026-10-27", "out", "damaged", 1),
    // After a custom period's last day: undone to find the closing.
    move("a", "2026-10-29", "out", "sold", 3),
    move("b", "2026-10-28", "out", "sold", 1),
    move("c", "2026-10-20", "out", "sold", 4),
  ];
  const lastSold = new Map([["a", "2026-10-29"], ["e", "2026-08-01"]]);

  it("each item's opening, in, out and closing; closing at the period's end even when it's in the past", () => {
    const report = stockReport(items, moves, lastSold, { period: "custom", from: "2026-10-24", to: "2026-10-28" }, TODAY);
    expect(report.rows.find((row) => row.variantId === "a")).toEqual({ variantId: "a", opening: 13 - 6 + 3, in: 6, out: 3, closing: 13, value: { amount: 26_000, currency: "USD" } });
    expect(report.rows.find((row) => row.variantId === "b")).toMatchObject({ opening: 4, out: 1, closing: 3 });
    expect(report.rows.some((row) => row.variantId === "d")).toBe(false);
  });

  it("units in and out by day; each kind of change with its worth at today's cost", () => {
    const report = stockReport(items, moves, lastSold, { period: "week" }, TODAY);
    expect(report.unit).toBe("day");
    expect(report.series.find((point) => point.key === "2026-10-25")).toEqual({ key: "2026-10-25", in: 6, out: 0 });
    expect(report.figures).toMatchObject({ inUnits: 6, outUnits: 2 + 1 + 3 + 1, inValue: { USD: 12_000, KHR: 0 }, outValue: { USD: 12_000, KHR: 40_000 } });
    expect(report.kinds.find((kind) => kind.kind === "sold")).toEqual({ kind: "sold", direction: "out", units: 6, value: { USD: 10_000, KHR: 40_000 } });
    expect(report.kinds.find((kind) => kind.kind === "damaged")).toEqual({ kind: "damaged", direction: "out", units: 1, value: { USD: 2000, KHR: 0 } });
  });

  it("what the shelf is worth now, by category; items without a cost apart; each level counted", () => {
    const report = stockReport(items, moves, lastSold, { period: "all" }, TODAY);
    expect(report.figures.value).toEqual({ USD: 20_000, KHR: 120_000 });
    expect(report.figures.withoutCost).toBe(1);
    expect(report.byCategory).toEqual([
      { categoryId: "tyres", value: { USD: 20_000, KHR: 0 }, units: 15 },
      { categoryId: "oil", value: { USD: 0, KHR: 120_000 }, units: 3 },
    ]);
    expect(report.levels).toEqual({ out: 1, low: 1, ok: 2, untracked: 1 });
    // Every movement: from the first one to today.
    expect(report.days).toBeNull();
    expect(report.series[0]?.key).toBe("2026-10-20");
  });

  it("slow movers: on the shelf with no sale in the period, most worth first", () => {
    const report = stockReport(items, moves, lastSold, { period: "week" }, TODAY);
    expect(report.slowMovers.map((slow) => slow.variantId)).toEqual(["e"]);
    expect(report.slowMovers[0]).toEqual({ variantId: "e", onHand: 5, value: null, lastSoldOn: "2026-08-01" });
    const today = stockReport(items, moves, lastSold, { period: "today" }, TODAY);
    expect(today.slowMovers.map((slow) => slow.variantId)).toEqual(["b", "e"]);
  });
});
