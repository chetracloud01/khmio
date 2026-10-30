import { describe, expect, it } from "vitest";
import type { StockCount, StockPage } from "@/lib/api";
import { countProgress, itemsInRange, pendingLines, screenLines, typedCount } from "./count-draft";

type Item = StockPage["items"][number];

const item = (variantId: string, overrides: Partial<Item> = {}): Item => ({
  variantId,
  productId: "p",
  titleKm: "",
  titleEn: variantId,
  categoryId: "tyres",
  brandId: null,
  optionKm: "",
  optionEn: "",
  sku: "",
  onHand: 10,
  low: false,
  reorderMin: null,
  reorderMax: null,
  suggested: null,
  lastSupplierId: null,
  lastSupplierName: null,
  lastCostMinor: null,
  costMinor: 2000,
  costCurrency: "USD",
  ...overrides,
});
const line = (variantId: string, counted: number, expectedOnHand: number | null) => ({ variantId, counted, expectedOnHand, countedAt: "", costMinor: null, costCurrency: null });
const count = (lines: StockCount["lines"], categoryIds: string[] = []) => ({ categoryIds, lines });

describe("a count being typed", () => {
  const items = [item("a"), item("b", { categoryId: "oil", onHand: 4, costMinor: 500 }), item("c", { onHand: null })];

  it("covers every item, or only its categories", () => {
    expect(itemsInRange(items, { categoryIds: [] })).toHaveLength(3);
    expect(itemsInRange(items, { categoryIds: ["oil"] }).map((entry) => entry.variantId)).toEqual(["b"]);
  });

  it("reads a box: a count, NaN for anything else, null when empty", () => {
    expect(typedCount(" 7 ")).toBe(7);
    expect(typedCount("2.5")).toBeNaN();
    expect(typedCount("")).toBeNull();
    expect(typedCount(undefined)).toBeNull();
  });

  it("saves only what changed: new counts, changed counts, emptied boxes; never a box that isn't a number", () => {
    const pending = pendingLines(count([line("a", 8, 10), line("b", 4, 4)]), { a: "8", b: "3", c: "5", d: "x" });
    expect(pending).toEqual([
      { variantId: "b", counted: 3 },
      { variantId: "c", counted: 5 },
    ]);
    expect(pendingLines(count([line("a", 8, 10)]), { a: "" })).toEqual([{ variantId: "a", counted: null }]);
  });

  it("values the differences at once: expected from the saved line, or today's for a box not saved yet", () => {
    const lines = screenLines(count([line("a", 8, 10)]), items, { b: "6" });
    expect(lines).toEqual([
      { variantId: "a", counted: 8, expectedOnHand: 10, costMinor: 2000, costCurrency: "USD" },
      { variantId: "b", counted: 6, expectedOnHand: 4, costMinor: 500, costCurrency: "USD" },
    ]);
    const progress = countProgress(lines, items);
    expect(progress).toMatchObject({ counted: 2, total: 3 });
    expect(progress.value.net.USD).toBe(-2 * 2000 + 2 * 500);
  });

  it("an emptied box isn't counted, even when it was saved", () => {
    expect(screenLines(count([line("a", 8, 10)]), items, { a: "" })).toEqual([]);
  });
});
