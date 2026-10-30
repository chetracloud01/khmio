import { z } from "zod";
import type { Currency } from "./money";
import { MAX_STOCK_COUNT, MAX_STOCK_QUANTITY } from "./stock";

// Stock counts (design/screens.md S13 "Count stock"; the ERP physical
// inventory): a count is a numbered document (CNT-0001) of the items on a
// shelf, over every item or chosen categories. Each item counted keeps what
// the app had for it at the moment it was typed; applied, each item's
// correction is counted − expected then, put onto today's stock — so a sale
// made while counting is never taken for a loss. A draft can be left and
// continued on any device; applied or cancelled, it never changes again.

export const STOCK_COUNT_STATUSES = ["draft", "applied", "cancelled"] as const;
export type StockCountStatus = (typeof STOCK_COUNT_STATUSES)[number];

/** Most categories one count covers (more: count every item). */
export const MAX_COUNT_CATEGORIES = 50;
export const MAX_COUNT_NOTE_LENGTH = 200;

/** Start a count: of every item (no categories) or of the chosen categories. */
export const stockCountStartInputSchema = z.object({
  categoryIds: z
    .array(z.string().uuid("required"))
    .max(MAX_COUNT_CATEGORIES, "too_long")
    .default([])
    .transform((ids) => [...new Set(ids)]),
  note: z.string().trim().max(MAX_COUNT_NOTE_LENGTH, "too_long").default(""),
});
export type StockCountStartInput = z.infer<typeof stockCountStartInputSchema>;

/** What's on the shelf: 0 or more, never absurd. */
const countedSchema = z.number({ invalid_type_error: "quantity_invalid" }).int("quantity_invalid").min(0, "quantity_invalid").max(MAX_STOCK_QUANTITY, "quantity_invalid");

/** Counts typed in a draft, saved as they're typed: each item once; a blank (null) takes the item's line away. */
export const stockCountLinesInputSchema = z
  .object({
    lines: z
      .array(z.object({ variantId: z.string().uuid("required"), counted: countedSchema.nullable() }))
      .min(1, "required")
      .max(MAX_STOCK_COUNT, "too_long"),
  })
  .superRefine((input, ctx) => {
    const seen = new Set<string>();
    input.lines.forEach((line, index) => {
      if (seen.has(line.variantId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "option_duplicate", path: ["lines", index, "variantId"] });
      seen.add(line.variantId);
    });
  });
export type StockCountLinesInput = z.infer<typeof stockCountLinesInputSchema>;

/** Whether an item's category is in the count's range (none chosen: every item). */
export const inCountRange = (categoryIds: readonly string[], categoryId: string): boolean => categoryIds.length === 0 || categoryIds.includes(categoryId);

/** An item's correction: counted − what the app had when it was typed; null when it wasn't tracked (it starts from its count). */
export const countDifference = (line: { counted: number; expectedOnHand: number | null }): number | null => (line.expectedOnHand === null ? null : line.counted - line.expectedOnHand);

export interface CountValue {
  /** Each currency apart: what went missing (a minus), what turned up, and the two together. */
  lost: Record<Currency, number>;
  found: Record<Currency, number>;
  net: Record<Currency, number>;
  lostItems: number;
  foundItems: number;
  /** Items with a difference but no cost: counted apart, never valued at zero. */
  withoutCost: number;
}

/** What a count's differences are worth, at each item's cost (in its own currency). */
export function countValue(lines: readonly { counted: number; expectedOnHand: number | null; costMinor: number | null; costCurrency: Currency | null }[]): CountValue {
  const value: CountValue = { lost: { USD: 0, KHR: 0 }, found: { USD: 0, KHR: 0 }, net: { USD: 0, KHR: 0 }, lostItems: 0, foundItems: 0, withoutCost: 0 };
  for (const line of lines) {
    const difference = countDifference(line);
    if (!difference) continue;
    if (difference < 0) value.lostItems += 1;
    else value.foundItems += 1;
    if (line.costMinor === null || !line.costCurrency) {
      value.withoutCost += 1;
      continue;
    }
    const amount = difference * line.costMinor;
    value[difference < 0 ? "lost" : "found"][line.costCurrency] += amount;
    value.net[line.costCurrency] += amount;
  }
  return value;
}
