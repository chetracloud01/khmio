import { describe, expect, it } from "vitest";
import { toFieldErrors } from "./form-errors";
import {
  LOW_STOCK_THRESHOLD,
  MAX_TRACK_MANY,
  needsReorder,
  reorderLevelsInputSchema,
  STOCK_CHANGE_REASONS,
  stockChangeInputSchema,
  stockTrackInputSchema,
  stockTrackManyInputSchema,
  suggestedOrder,
} from "./stock";

const id = (n: number) => `0b9f3c3e-1d2a-4c1f-9a51-${String(n).padStart(12, "0")}`;

describe("starting to track many options at once", () => {
  it("takes each option with its own count", () => {
    expect(stockTrackManyInputSchema.safeParse({ items: [{ variantId: id(1), onHand: 3 }, { variantId: id(2), onHand: 0 }] }).success).toBe(true);
  });

  it("refuses the same option twice, an empty list and too many at once", () => {
    const twice = stockTrackManyInputSchema.safeParse({ items: [{ variantId: id(1), onHand: 3 }, { variantId: id(1), onHand: 4 }] });
    expect(twice.success ? {} : toFieldErrors(twice.error)).toEqual({ "items.1.variantId": "option_duplicate" });
    expect(stockTrackManyInputSchema.safeParse({ items: [] }).success).toBe(false);
    const tooMany = Array.from({ length: MAX_TRACK_MANY + 1 }, (_, n) => ({ variantId: id(n + 1), onHand: 0 }));
    expect(stockTrackManyInputSchema.safeParse({ items: tooMany }).success).toBe(false);
  });

  it("refuses a count below zero", () => {
    expect(stockTrackManyInputSchema.safeParse({ items: [{ variantId: id(1), onHand: -1 }] }).success).toBe(false);
  });
});


describe("reorder levels", () => {
  it("reorder at the item's minimum, or the shop's rule without one", () => {
    expect(needsReorder(3, 3)).toBe(true);
    expect(needsReorder(4, 3)).toBe(false);
    expect(needsReorder(LOW_STOCK_THRESHOLD, null)).toBe(true);
    expect(needsReorder(0, 0)).toBe(true);
  });

  it("suggest ordering up to the maximum, or twice the minimum, never less than 1", () => {
    expect(suggestedOrder(2, 5, 20)).toBe(18);
    expect(suggestedOrder(2, 5, null)).toBe(8);
    expect(suggestedOrder(-3, 5, 20)).toBe(20);
    expect(suggestedOrder(0, 0, null)).toBe(1);
  });

  it("refuse a maximum below the minimum, or without one", () => {
    const below = reorderLevelsInputSchema.safeParse({ items: [{ variantId: id(1), min: 10, max: 5 }] });
    expect(below.success ? {} : toFieldErrors(below.error)).toEqual({ "items.0.max": "reorder_max_below_min" });
    expect(reorderLevelsInputSchema.safeParse({ items: [{ variantId: id(1), min: null, max: 5 }] }).success).toBe(false);
    expect(reorderLevelsInputSchema.safeParse({ items: [{ variantId: id(1), min: null, max: null }, { variantId: id(2), min: 0, max: 0 }] }).success).toBe(true);
  });
});

describe("why stock went up or down", () => {
  const change = (type: "adjust_in" | "adjust_out", reason: string, note?: string) => stockChangeInputSchema.safeParse({ variantId: id(1), type, quantity: 1, reason, ...(note ? { note } : {}) });

  it("offers each reason for the way it goes", () => {
    for (const reason of STOCK_CHANGE_REASONS.adjust_out) expect(change("adjust_out", reason, "why").success).toBe(true);
    for (const reason of STOCK_CHANGE_REASONS.adjust_in) expect(change("adjust_in", reason, "why").success).toBe(true);
  });

  it("refuses a reason the wrong way: an expired item can't come back up, nor free goods go down", () => {
    const up = change("adjust_in", "expired");
    expect(up.success ? {} : toFieldErrors(up.error)).toEqual({ reason: "choice_invalid" });
    expect(change("adjust_out", "free_goods").success).toBe(false);
  });

  it("asks \"Other\" for a note, whichever way", () => {
    expect(change("adjust_in", "other").success).toBe(false);
    expect(change("adjust_out", "other").success).toBe(false);
  });
});

describe("opening stock", () => {
  it("takes what's on the shelf, with what one cost if known", () => {
    expect(stockTrackInputSchema.safeParse({ variantId: id(1), onHand: 12 }).success).toBe(true);
    expect(stockTrackInputSchema.safeParse({ variantId: id(1), onHand: 12, unitCost: 450, costCurrency: "USD" }).success).toBe(true);
  });

  it("needs the cost's currency", () => {
    const noCurrency = stockTrackInputSchema.safeParse({ variantId: id(1), onHand: 12, unitCost: 450 });
    expect(noCurrency.success ? {} : toFieldErrors(noCurrency.error)).toEqual({ costCurrency: "required" });
  });

});
