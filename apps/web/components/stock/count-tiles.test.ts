import { describe, expect, it } from "vitest";
import type { StockCount, StockPage } from "@/lib/api";
import { countTileFigures, countTileOf, HISTORY_TILES, historyFigures, historyTileOf, inCountTile, inHistoryTile, tileChipSearch } from "./count-tiles";

type Item = StockPage["items"][number];

const item = (variantId: string): Item => ({
  variantId,
  productId: "p",
  titleKm: "",
  titleEn: variantId,
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
  costMinor: 1000,
  costCurrency: "USD",
});
const line = (variantId: string, counted: number, expectedOnHand: number | null, costMinor: number | null = 1000, costCurrency: "USD" | "KHR" | null = "USD") => ({ variantId, counted, expectedOnHand, costMinor, costCurrency });

describe("an open count's tiles", () => {
  const items = ["a", "b", "c", "d", "e", "f"].map(item);
  const lines = [line("a", 8, 10), line("b", 12, 10), line("c", 10, 10), line("d", 4, null), line("e", 3, 5, 40_000, "KHR")];

  it("put each item where it stands: lost, found, matching (an untracked item starting from its count changes nothing), or not counted yet", () => {
    expect(inCountTile("lost", lines[0])).toBe(true);
    expect(inCountTile("found", lines[1])).toBe(true);
    expect(inCountTile("matches", lines[2])).toBe(true);
    expect(inCountTile("matches", lines[3])).toBe(true);
    expect(inCountTile("uncounted", undefined)).toBe(true);
  });

  it("count each tile and value the lost and found at cost, dollars and riel apart", () => {
    const figures = countTileFigures(items, lines);
    expect(figures.uncounted.count).toBe(1);
    expect(figures.lost).toEqual({ count: 2, value: { USD: -2000, KHR: -80_000 } });
    expect(figures.found).toEqual({ count: 1, value: { USD: 2000, KHR: 0 } });
    expect(figures.matches.count).toBe(2);
  });

  it("follow the list's chip", () => {
    expect(countTileOf("lost")).toBe("lost");
    expect(countTileOf("low")).toBeNull();
    expect(tileChipSearch("tab=lost&q=tyre", "found")).toBe("tab=found");
  });
});

describe("past counts' tiles", () => {
  const value = (lostUsd: number) => ({ lost: { USD: lostUsd, KHR: 0 }, found: { USD: 0, KHR: 0 }, net: { USD: lostUsd, KHR: 0 }, lostItems: 1, foundItems: 0, withoutCost: 0 });
  const count = (number: number, status: StockCount["status"], appliedAt: string | null, lostUsd = 0): StockCount => ({
    id: String(number),
    number,
    status,
    categoryIds: [],
    note: "",
    startedAt: "2026-09-01T03:00:00.000Z",
    appliedAt,
    cancelledAt: status === "cancelled" ? "2026-10-01T03:00:00.000Z" : null,
    lines: [],
    value: value(lostUsd),
  });
  const TODAY = "2026-10-29";
  const counts = [count(1, "applied", "2026-09-10T03:00:00.000Z", -9000), count(2, "applied", "2026-10-20T03:00:00.000Z", -4500), count(3, "applied", "2026-10-28T03:00:00.000Z", -500), count(4, "cancelled", null), count(5, "draft", null)];

  it("find the last applied count, what was lost in 30 days, and how many were applied or cancelled", () => {
    const figures = historyFigures(counts, TODAY);
    expect(figures.last?.number).toBe(3);
    expect(figures.recent).toEqual({ count: 2, lost: { USD: -5000, KHR: 0 } });
    expect(figures.applied).toBe(3);
    expect(figures.cancelled).toBe(1);
  });

  it("put each count in its tiles; a draft is in none", () => {
    expect(inHistoryTile("recent", counts[1]!, TODAY)).toBe(true);
    expect(inHistoryTile("recent", counts[0]!, TODAY)).toBe(false);
    expect(inHistoryTile("applied", counts[0]!, TODAY)).toBe(true);
    expect(inHistoryTile("cancelled", counts[3]!, TODAY)).toBe(true);
    expect(HISTORY_TILES.some((tile) => inHistoryTile(tile, counts[4]!, TODAY))).toBe(false);
    expect(historyTileOf("recent")).toBe("recent");
    expect(historyTileOf("draft")).toBeNull();
  });
});
