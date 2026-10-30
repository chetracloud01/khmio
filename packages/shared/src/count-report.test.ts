import { describe, expect, it } from "vitest";
import { countReport, type CountReportCount } from "./count-report";

const TODAY = "2026-10-29";
const line = (variantId: string, counted: number, expectedOnHand: number | null, costMinor: number | null = 1000, costCurrency: "USD" | "KHR" | null = "USD") => ({ variantId, counted, expectedOnHand, costMinor, costCurrency });
const count = (number: number, appliedOn: string, lines: CountReportCount["lines"], categoryIds: string[] = []): CountReportCount => ({ id: `c${number}`, number, appliedAt: `${appliedOn}T05:00:00.000Z`, appliedOn, categoryIds, lines });
const categoryOf = new Map([["a", "tyres"], ["b", "tyres"], ["c", "oil"], ["d", "oil"]]);

const counts = [
  count(2, "2026-10-20", [line("a", 8, 10), line("b", 5, 5), line("c", 3, 4, 40_000, "KHR"), line("d", 6, null)]),
  count(1, "2026-09-01", [line("a", 9, 10), line("b", 7, 6)]),
  count(3, "2026-10-28", [line("a", 4, 5), line("b", 2, 2, null, null), line("c", 0, 1, null, null)]),
];

describe("the stock counts report", () => {
  it("adds every count up: lost, found and net at each count's cost, units, items, accuracy over the items compared", () => {
    const report = countReport(counts, categoryOf, { period: "all" }, TODAY);
    expect(report.figures).toEqual({
      counts: 3,
      items: 4 + 2 + 3,
      lost: { USD: -2000 - 1000 - 1000, KHR: -40_000 },
      found: { USD: 1000, KHR: 0 },
      net: { USD: -3000, KHR: -40_000 },
      lostUnits: 2 + 1 + 1 + 1 + 1,
      foundUnits: 1,
      withoutCost: 1,
      // 8 items compared (d started tracking), 2 matched.
      accuracy: 25,
    });
  });

  it("each count in turn, oldest first, with its own accuracy", () => {
    const report = countReport(counts, categoryOf, { period: "all" }, TODAY);
    expect(report.counts.map((row) => row.number)).toEqual([1, 2, 3]);
    expect(report.counts[1]).toMatchObject({ number: 2, items: 4, lostUnits: 3, lost: { USD: -2000, KHR: -40_000 }, accuracy: 33 });
  });

  it("the loss by category, and the items most often short", () => {
    const report = countReport(counts, categoryOf, { period: "all" }, TODAY);
    expect(report.byCategory).toEqual([
      { categoryId: "tyres", lostUnits: 4, lost: { USD: -4000, KHR: 0 } },
      { categoryId: "oil", lostUnits: 2, lost: { USD: 0, KHR: -40_000 } },
    ]);
    expect(report.items[0]).toEqual({ variantId: "a", timesShort: 3, unitsLost: 4, lost: { USD: -4000, KHR: 0 }, timesOver: 0, unitsFound: 0 });
    expect(report.items.some((item) => item.variantId === "b")).toBe(false);
  });

  it("reads only the counts applied in the period", () => {
    const report = countReport(counts, categoryOf, { period: "month" }, TODAY);
    expect(report.counts.map((row) => row.number)).toEqual([2, 3]);
    expect(countReport(counts, categoryOf, { period: "today" }, TODAY).figures).toMatchObject({ counts: 0, accuracy: null });
  });
});
