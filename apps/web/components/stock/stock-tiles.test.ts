import { describe, expect, it } from "vitest";
import type { StockPage } from "@/lib/api";
import { reorderFigures, stockTileFigures, stockTileOf, stockTileSearch } from "./stock-tiles";

type Item = StockPage["items"][number];

const item = (overrides: Partial<Item>): Item => ({
  variantId: "v",
  productId: "p",
  titleKm: "",
  titleEn: "Tyre",
  categoryId: "c",
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

describe("the Stock page's tiles", () => {
  const items = [
    item({ onHand: 0, low: true, suggested: 6 }),
    item({ onHand: 2, low: true, suggested: 4, costMinor: 50_000, costCurrency: "KHR" }),
    item({ onHand: 1, low: true, costMinor: null, costCurrency: null }),
    item({ onHand: 10 }),
    item({ onHand: 5, costMinor: 1000 }),
    item({ onHand: null, costMinor: null, costCurrency: null }),
  ];

  it("count each level and what it's worth on the shelf, dollars and riel apart", () => {
    const figures = stockTileFigures(items);
    expect(figures.out).toEqual({ count: 1, value: { USD: 0, KHR: 0 } });
    expect(figures.low).toEqual({ count: 2, value: { USD: 0, KHR: 100_000 } });
    expect(figures.ok).toEqual({ count: 2, value: { USD: 20_000 + 5_000, KHR: 0 } });
    expect(figures.untracked.count).toBe(1);
  });

  it("price the reorder at the suggested quantity (one without levels), counting what has no cost", () => {
    const reorder = reorderFigures(items);
    expect(reorder.items).toHaveLength(3);
    expect(reorder.cost).toEqual({ USD: 6 * 2000, KHR: 4 * 50_000 });
    expect(reorder.withoutCost).toBe(1);
  });

  it("follow the list's chip and write its address", () => {
    expect(stockTileOf("low")).toBe("low");
    expect(stockTileOf("reorder")).toBeNull();
    expect(stockTileSearch("tab=out&q=tyre&sort=status:asc", "ok")).toBe("sort=status%3Aasc&tab=ok");
    expect(stockTileSearch("tab=out", null)).toBe("");
  });
});
