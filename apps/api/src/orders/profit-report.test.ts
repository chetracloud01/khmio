import { describe, expect, it } from "vitest";
import { buildProfitReport } from "./profit-report";

const NOW = new Date("2026-10-27T05:00:00Z"); // 12:00 in Phnom Penh

describe("the profit report's periods", () => {
  it("counts yesterday in the week and month, not in today", () => {
    const report = buildProfitReport(
      [{ day: "2026-10-26", nameKm: "កាហ្វេ", nameEn: "Coffee", currency: "KHR", quantity: 1, sales: 8000, costedSales: 8000, cost: 3000 }],
      NOW,
      "KHR",
    );
    expect(report.today.KHR.sales).toBe(0);
    expect(report.week.KHR.profit).toBe(5000);
    expect(report.month.products).toHaveLength(1);
    expect(report.mainCurrency).toBe("KHR");
  });
});
