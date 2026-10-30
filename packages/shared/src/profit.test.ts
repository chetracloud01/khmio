import { describe, expect, it } from "vitest";
import { movingAverageCost, stockValue, unitCostIn } from "./profit";
import { stockChangeInputSchema } from "./stock";

describe("the average cost after a purchase", () => {
  it("weighs what's on hand and what arrived: 10 tyres at $20 and 10 at $26 cost $23", () => {
    expect(movingAverageCost(10, 2000, 10, 2600)).toBe(2300);
  });

  it("rounds to a whole cent or riel", () => {
    expect(movingAverageCost(2, 100, 1, 101)).toBe(100);
    expect(movingAverageCost(1, 100, 2, 101)).toBe(101);
  });

  it("takes the purchase's cost when nothing is on hand or no cost is known yet", () => {
    expect(movingAverageCost(0, 2000, 5, 2600)).toBe(2600);
    expect(movingAverageCost(10, null, 5, 2600)).toBe(2600);
  });

  it("keeps the cost when the purchase has none", () => {
    expect(movingAverageCost(10, 2000, 5, null)).toBe(2000);
    expect(movingAverageCost(10, null, 5, null)).toBeNull();
  });
});

describe("the stock value", () => {
  it("adds on hand × cost per currency, and counts what has no cost yet", () => {
    expect(
      stockValue([
        { onHand: 4, costMinor: 2300, costCurrency: "USD" },
        { onHand: 2, costMinor: 50000, costCurrency: "KHR" },
        { onHand: 3, costMinor: null, costCurrency: null },
        { onHand: 0, costMinor: 999, costCurrency: "USD" },
      ]),
    ).toEqual({ USD: 9200, KHR: 100000, withoutCost: 1 });
  });
});

describe("a purchase's cost", () => {
  const variantId = "0b9f3c3e-1d2a-4c1f-9a51-6a3a7a2b9c10";
  it("comes only with a supplier bill (purchases.ts): a stock correction is never a purchase", () => {
    expect(stockChangeInputSchema.safeParse({ variantId, type: "purchase", quantity: 5 }).success).toBe(false);
    expect(stockChangeInputSchema.safeParse({ variantId, type: "adjust_in", quantity: 1, reason: "returned" }).success).toBe(true);
  });
});

describe("an item's cost in the order's currency", () => {
  const RATE = 4100;

  it("keeps the cost as saved when the order is in its currency", () => {
    expect(unitCostIn({ costMinor: 120, costCurrency: "USD" }, "USD", RATE)).toBe(120);
    expect(unitCostIn({ costMinor: 5000, costCurrency: "KHR" }, "KHR", RATE)).toBe(5000);
  });

  it("converts it at the order's rate, rounded like a price", () => {
    expect(unitCostIn({ costMinor: 120, costCurrency: "USD" }, "KHR", RATE)).toBe(4920);
    expect(unitCostIn({ costMinor: 7000, costCurrency: "KHR" }, "USD", RATE)).toBe(171);
  });

  it("never guesses a cost that isn't known", () => {
    expect(unitCostIn({ costMinor: null, costCurrency: null }, "USD", RATE)).toBeUndefined();
  });
});
