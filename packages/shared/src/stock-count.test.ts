import { describe, expect, it } from "vitest";
import { formatDocumentNumber, parseDocumentNumber } from "./documents";
import { MAX_STOCK_COUNT } from "./stock";
import { countDifference, countValue, inCountRange, stockCountLinesInputSchema, stockCountStartInputSchema } from "./stock-count";

const ID = "0b9f3c3e-1d2a-4c1f-9a51-000000000001";
const OTHER = "0b9f3c3e-1d2a-4c1f-9a51-000000000002";

describe("a stock count", () => {
  it("is numbered CNT-…", () => {
    expect(formatDocumentNumber("count", 3)).toBe("CNT-0003");
    expect(parseDocumentNumber("cnt-3")).toEqual({ series: "count", number: 3 });
  });

  it("starts over every item, or chosen categories (each once)", () => {
    expect(stockCountStartInputSchema.parse({})).toEqual({ categoryIds: [], note: "" });
    expect(stockCountStartInputSchema.parse({ categoryIds: [ID, ID, OTHER] }).categoryIds).toEqual([ID, OTHER]);
    expect(stockCountStartInputSchema.safeParse({ categoryIds: ["tyres"] }).success).toBe(false);
  });

  it("saves counts of 0 or more, each item once; a blank takes the line away", () => {
    expect(stockCountLinesInputSchema.safeParse({ lines: [{ variantId: ID, counted: 0 }, { variantId: OTHER, counted: null }] }).success).toBe(true);
    expect(stockCountLinesInputSchema.safeParse({ lines: [{ variantId: ID, counted: -1 }] }).error?.issues[0]?.message).toBe("quantity_invalid");
    expect(stockCountLinesInputSchema.safeParse({ lines: [{ variantId: ID, counted: 1.5 }] }).success).toBe(false);
    expect(stockCountLinesInputSchema.safeParse({ lines: [{ variantId: ID, counted: 1 }, { variantId: ID, counted: 2 }] }).error?.issues[0]?.message).toBe("option_duplicate");
    expect(stockCountLinesInputSchema.safeParse({ lines: [] }).success).toBe(false);
  });

  it("holds many lines at once, but not without end; a line carries no cost (it's fixed when applied)", () => {
    const many = (length: number) => Array.from({ length }, (_, n) => ({ variantId: `0b9f3c3e-1d2a-4c1f-9a51-${String(n + 1).padStart(12, "0")}`, counted: 1 }));
    expect(stockCountLinesInputSchema.safeParse({ lines: many(MAX_STOCK_COUNT) }).success).toBe(true);
    expect(stockCountLinesInputSchema.safeParse({ lines: many(MAX_STOCK_COUNT + 1) }).success).toBe(false);
    const withCost = stockCountLinesInputSchema.parse({ lines: [{ variantId: ID, counted: 3, costMinor: 450 }] });
    expect("costMinor" in (withCost.lines[0] ?? {})).toBe(false);
  });

  it("covers an item when it's in a chosen category, or every item when none were chosen", () => {
    expect(inCountRange([], "c1")).toBe(true);
    expect(inCountRange(["c1"], "c1")).toBe(true);
    expect(inCountRange(["c1"], "c2")).toBe(false);
  });

  it("corrects by counted − what the app had when it was typed; an untracked item has none (it starts from its count)", () => {
    expect(countDifference({ counted: 8, expectedOnHand: 10 })).toBe(-2);
    expect(countDifference({ counted: 10, expectedOnHand: 10 })).toBe(0);
    expect(countDifference({ counted: 4, expectedOnHand: null })).toBeNull();
  });
});

describe("what a count's differences are worth", () => {
  it("lost and found at each item's cost, dollars and riel apart; no cost counted apart, never as zero", () => {
    const value = countValue([
      { counted: 8, expectedOnHand: 10, costMinor: 2250, costCurrency: "USD" },
      { counted: 12, expectedOnHand: 11, costMinor: 1200, costCurrency: "USD" },
      { counted: 1, expectedOnHand: 3, costMinor: 40_000, costCurrency: "KHR" },
      { counted: 5, expectedOnHand: 5, costMinor: 999, costCurrency: "USD" },
      { counted: 2, expectedOnHand: 4, costMinor: null, costCurrency: null },
      { counted: 7, expectedOnHand: null, costMinor: 500, costCurrency: "USD" },
    ]);
    expect(value.lost).toEqual({ USD: -4500, KHR: -80_000 });
    expect(value.found).toEqual({ USD: 1200, KHR: 0 });
    expect(value.net).toEqual({ USD: -3300, KHR: -80_000 });
    expect(value.lostItems).toBe(3);
    expect(value.foundItems).toBe(1);
    expect(value.withoutCost).toBe(1);
  });
});
