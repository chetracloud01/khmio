import { describe, expect, it } from "vitest";
import { profitSince, unitCostIn, type ProfitRow } from "./profit";

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
