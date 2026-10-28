import { describe, expect, it } from "vitest";
import { movingAverageCost, profitSince, stockValue, unitCostIn, type ProfitRow } from "./profit";
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

describe("a purchase's cost as typed", () => {
  const variantId = "0b9f3c3e-1d2a-4c1f-9a51-6a3a7a2b9c10";
  it("is optional, and needs its currency when given", () => {
    expect(stockChangeInputSchema.safeParse({ variantId, type: "purchase", quantity: 5 }).success).toBe(true);
    expect(stockChangeInputSchema.safeParse({ variantId, type: "purchase", quantity: 5, unitCost: 2600, costCurrency: "USD", supplier: " Chhay Auto " }).data?.supplier).toBe("Chhay Auto");
    expect(stockChangeInputSchema.safeParse({ variantId, type: "purchase", quantity: 5, unitCost: 2600 }).success).toBe(false);
  });

  it("belongs to a purchase only", () => {
    expect(stockChangeInputSchema.safeParse({ variantId, type: "adjust_in", quantity: 1, reason: "returned", unitCost: 100, costCurrency: "USD" }).success).toBe(false);
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

const row = (overrides: Partial<ProfitRow>): ProfitRow => ({ day: "2026-10-27", nameKm: "កាហ្វេ", nameEn: "Coffee", currency: "USD", quantity: 1, sales: 200, costedSales: 200, cost: 80, ...overrides });

describe("the profit report", () => {
  it("takes cost from sales, and gives the margin on what has a cost", () => {
    const period = profitSince([row({ quantity: 2, sales: 400, costedSales: 400, cost: 160 })], "2026-10-27", "USD");
    expect(period.USD).toEqual({ sales: 400, costedSales: 400, cost: 160, profit: 240, marginPercent: 60, missingCostSales: 0 });
  });

  it("never guesses a missing cost: those sales are shown apart and left out of the profit", () => {
    const period = profitSince([row({}), row({ nameEn: "Tea", sales: 150, costedSales: 0, cost: 0 })], "2026-10-27", "USD");
    expect(period.USD).toMatchObject({ sales: 350, profit: 120, missingCostSales: 150, marginPercent: 60 });
  });

  it("keeps dollars and riel apart, and has no margin when nothing with a cost was sold", () => {
    const period = profitSince([row({}), row({ currency: "KHR", sales: 8000, costedSales: 0, cost: 0 })], "2026-10-27", "USD");
    expect(period.KHR).toMatchObject({ sales: 8000, profit: 0, marginPercent: null, missingCostSales: 8000 });
    expect(period.USD.sales).toBe(200);
  });

  it("counts only the period, and lists the most profitable products first", () => {
    const period = profitSince(
      [row({ day: "2026-10-01", sales: 999, costedSales: 999, cost: 0 }), row({ nameEn: "Tea", sales: 500, costedSales: 500, cost: 100 }), row({})],
      "2026-10-21",
      "USD",
    );
    expect(period.products.map((product) => product.nameEn)).toEqual(["Tea", "Coffee"]);
    expect(period.USD.sales).toBe(700);
  });
});
