import { countValue, inCountRange, parseQuantityInput, type CountValue, type Currency } from "@khmio/shared";
import type { StockCount, StockPage } from "@/lib/api";

// What the Count screen works out while a draft is typed (design/screens.md
// S13 "Count stock"): the items in the count's range, what's been typed but
// not saved yet, and each counted item's line — counted, and what the app had
// when it was typed (the saved line's; for a box not saved yet, today's) — so
// the value of the differences shows at once. Pure, so it's tested without a
// page.

type Item = StockPage["items"][number];
export type CountLine = { variantId: string; counted: number; expectedOnHand: number | null; costMinor: number | null; costCurrency: Currency | null };

/** The items a count covers: every item, or those in its categories. */
export const itemsInRange = (items: readonly Item[], count: Pick<StockCount, "categoryIds">): Item[] => items.filter((item) => inCountRange(count.categoryIds, item.categoryId));

/** A box's number: a count, NaN when it isn't one, null when it's empty. */
export const typedCount = (text: string | undefined): number | null => {
  const trimmed = text?.trim() ?? "";
  return trimmed ? parseQuantityInput(trimmed) : null;
};

/** What was typed and differs from what's saved: a count, or null for a box emptied (its line goes). Boxes with something else in them wait. */
export function pendingLines(count: Pick<StockCount, "lines">, texts: Record<string, string>): { variantId: string; counted: number | null }[] {
  const saved = new Map(count.lines.map((line) => [line.variantId, line.counted]));
  return Object.entries(texts).flatMap(([variantId, text]) => {
    const typed = typedCount(text);
    if (typed !== null && Number.isNaN(typed)) return [];
    const was = saved.get(variantId) ?? null;
    return typed === was ? [] : [{ variantId, counted: typed }];
  });
}

/** Each counted item's line as it stands on screen: the typed number over the saved one; expected from the saved line, or today's for a box not saved yet. */
export function screenLines(count: Pick<StockCount, "lines">, items: readonly Item[], texts: Record<string, string>): CountLine[] {
  const saved = new Map(count.lines.map((line) => [line.variantId, line]));
  return items.flatMap((item) => {
    const line = saved.get(item.variantId);
    const typed = item.variantId in texts ? typedCount(texts[item.variantId]) : (line?.counted ?? null);
    if (typed === null || Number.isNaN(typed)) return [];
    return [{ variantId: item.variantId, counted: typed, expectedOnHand: line ? line.expectedOnHand : item.onHand, costMinor: item.costMinor, costCurrency: item.costCurrency }];
  });
}

/** How far the count has got, and what its differences are worth so far. */
export function countProgress(lines: readonly CountLine[], inRange: readonly Item[]): { counted: number; total: number; value: CountValue } {
  return { counted: lines.length, total: inRange.length, value: countValue(lines) };
}
