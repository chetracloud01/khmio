import { payablesReport, type PayablesBill } from "@khmio/shared";
import { describe, expect, it } from "vitest";
import { chartRows, returnRate, shareParts, tableRows, totals } from "./supplier-report";

const TODAY = "2026-10-29";
const bill = (supplierId: string, currency: "USD" | "KHR", total: number, returned = 0, paid = 0): PayablesBill => ({
  supplierId,
  supplierName: supplierId.toUpperCase(),
  currency,
  purchasedOn: "2026-10-20",
  dueOn: null,
  received: true,
  total,
  returned,
  paid,
  owed: total - returned - paid,
  state: total - returned - paid > 0 ? "unpaid" : "paid",
  payments: [],
});
const report = payablesReport(
  [bill("a", "USD", 10_000, 1000), bill("b", "USD", 5000, 0, 5000), bill("b", "KHR", 40_000), bill("c", "USD", 800), bill("d", "USD", 300), bill("e", "USD", 200), bill("f", "USD", 100), bill("g", "USD", 50)],
  { period: "all" },
  TODAY,
);

describe("the Suppliers report", () => {
  it("the table: each supplier in each currency, or one row each in one currency", () => {
    expect(tableRows(report, null, 4000).filter((row) => row.supplierId === "b")).toHaveLength(2);
    const inUsd = tableRows(report, "USD", 4000);
    expect(inUsd.filter((row) => row.supplierId === "b")).toEqual([expect.objectContaining({ currency: "USD", bought: 5000 + 1000 })]);
  });

  it("the charts: the shop's currency only, unless all is shown in one", () => {
    expect(chartRows(report, null, 4000, "USD").rows.every((row) => row.currency === "USD")).toBe(true);
    expect(chartRows(report, null, 4000, "KHR").rows.map((row) => row.supplierId)).toEqual(["b"]);
    expect(chartRows(report, "KHR", 4000, "USD").currency).toBe("KHR");
  });

  it("a return rate: what went back of what came", () => {
    expect(returnRate({ bought: 9000, returned: 1000 })).toBe(10);
    expect(returnRate({ bought: 0, returned: 0 })).toBeNull();
  });

  it("the share ring: the top suppliers, the rest together", () => {
    const parts = shareParts(chartRows(report, null, 4000, "USD").rows, 5);
    expect(parts.map((part) => part.supplierName || "others")).toEqual(["A", "B", "C", "D", "E", "others"]);
    expect(parts.at(-1)?.bought).toBe(100 + 50);
  });

  it("the totals, each currency apart", () => {
    const sums = totals(report);
    expect(sums.bought).toEqual({ USD: 9000 + 5000 + 800 + 300 + 200 + 100 + 50, KHR: 40_000 });
    expect(sums.returned).toEqual({ USD: 1000, KHR: 0 });
    expect(sums.paid.USD).toBe(5000);
  });
});
