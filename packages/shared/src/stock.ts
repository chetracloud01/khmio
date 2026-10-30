import { z } from "zod";
import type { PaymentMethod } from "./checkout";
import { currencySchema, minorAmountSchema } from "./money";

/** The longest supplier name a purchase or a supplier keeps (the database checks it too). */
export const MAX_SUPPLIER_LENGTH = 80;

// Stock is a ledger: every change is one movement, and a location's stock is
// the sum of its movements (docs/blueprint.md "Subscription tiers").

export const MAX_STOCK_QUANTITY = 1_000_000;

export const stockLocationTypeSchema = z.enum(["warehouse", "branch"]);
export type StockLocationType = z.infer<typeof stockLocationTypeSchema>;

/**
 * - purchase / sale: stock arriving from a supplier / leaving to a buyer.
 * - transfer_out / transfer_in: always written as a pair with one transferId,
 *   so moving stock between locations never changes the store's total.
 * - adjust_in / adjust_out: corrections after a count, damage or loss; a reason is required.
 */
export const stockMovementTypeSchema = z.enum([
  "purchase",
  "sale",
  "transfer_out",
  "transfer_in",
  "adjust_in",
  "adjust_out",
]);
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;

/** +1 adds to the location, -1 takes away. */
export function stockMovementSign(type: StockMovementType): 1 | -1 {
  return type === "purchase" || type === "transfer_in" || type === "adjust_in" ? 1 : -1;
}

/** Why stock went up or down other than a bill or a sale — the reasons a seller picks (STOCK_CHANGE_REASONS says which way each goes). */
export const stockAdjustmentReasonSchema = z.enum(["count_correction", "damaged", "lost", "returned", "other", "expired", "own_use", "given_away", "free_goods"]);
export type StockAdjustmentReason = z.infer<typeof stockAdjustmentReasonSchema>;

/**
 * The reasons for each way stock goes (design/screens.md S13 "Change stock"),
 * in the order they're offered. "Count" and "Other" go both ways; the rest one
 * way only: an expired item can't come back up.
 */
export const STOCK_CHANGE_REASONS = {
  adjust_in: ["count_correction", "returned", "free_goods", "other"],
  adjust_out: ["damaged", "expired", "lost", "own_use", "given_away", "count_correction", "other"],
} as const satisfies Record<"adjust_in" | "adjust_out", readonly StockAdjustmentReason[]>;

/** Every reason a movement can carry: the ones a seller picks, a return to the supplier (written by a purchase return) and opening stock (written when tracking starts). */
export const stockMovementReasonSchema = z.enum([...stockAdjustmentReasonSchema.options, "supplier_return", "opening_stock"]);
export type StockMovementReason = z.infer<typeof stockMovementReasonSchema>;

/** How many of something, as a count is typed. */
export const quantitySchema = z
  .number({ invalid_type_error: "quantity_invalid" })
  .int("quantity_invalid")
  .min(1, "quantity_invalid")
  .max(MAX_STOCK_QUANTITY, "quantity_invalid");

/** A stock change's note: a short line ("Box fell off the shelf"), not a story. */
export const MAX_STOCK_NOTE_LENGTH = 200;

const noteSchema = z.string().trim().max(MAX_STOCK_NOTE_LENGTH, "too_long").optional();

const locationSchema = z.object({
  type: stockLocationTypeSchema,
  id: z.string().min(1, "required"),
});

const itemFields = {
  productId: z.string().min(1, "required"),
  variantId: z.string().min(1).optional(),
  quantity: quantitySchema,
  note: noteSchema,
};

/** Purchase, sale or correction at one location. */
export const stockMovementInputSchema = z
  .object({
    type: z.enum(["purchase", "sale", "adjust_in", "adjust_out"]),
    locationType: stockLocationTypeSchema,
    locationId: z.string().min(1, "required"),
    reason: stockAdjustmentReasonSchema.optional(),
    ...itemFields,
  })
  .superRefine(requireAdjustmentReason);

export type StockMovementInput = z.infer<typeof stockMovementInputSchema>;

/** An adjustment says why; "Other" says nothing on its own, so the note is what explains it later. */
function requireAdjustmentReason(movement: { type: string; reason?: StockAdjustmentReason; note?: string }, ctx: z.RefinementCtx): void {
  const isAdjustment = movement.type === "adjust_in" || movement.type === "adjust_out";
  if (isAdjustment && !movement.reason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "reason_required", path: ["reason"] });
  }
  if (isAdjustment && movement.reason === "other" && !movement.note) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required", path: ["note"] });
  }
}

/**
 * A correction to one product option's stock at the shop's main branch (the
 * live Stock page, design/screens.md S13), with its reason. Stock bought in
 * is a purchase (purchases.ts), which also carries its cost; sales and their
 * returns are written by orders, never typed.
 */
export const stockChangeInputSchema = z
  .object({
    variantId: z.string().uuid("required"),
    type: z.enum(["adjust_in", "adjust_out"]),
    quantity: quantitySchema,
    reason: stockAdjustmentReasonSchema.optional(),
    note: noteSchema,
  })
  .superRefine(requireAdjustmentReason)
  .superRefine((change, ctx) => {
    // Each reason goes one way (or both, for a count and "other").
    const allowed: readonly StockAdjustmentReason[] = STOCK_CHANGE_REASONS[change.type];
    if (change.reason && !allowed.includes(change.reason)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "choice_invalid", path: ["reason"] });
  });
export type StockChangeInput = z.infer<typeof stockChangeInputSchema>;

/** What's on the shelf of one option: 0 or more. */
const countItemSchema = z.object({
  variantId: z.string().uuid("required"),
  onHand: z.number({ invalid_type_error: "quantity_invalid" }).int("quantity_invalid").min(0, "quantity_invalid").max(MAX_STOCK_QUANTITY, "quantity_invalid"),
});

/**
 * Opening stock: start tracking one option from what's on the shelf (0 = sold
 * out until stock arrives), with what one cost if known — no bill; the cost
 * starts the item's average. A cost needs its currency.
 */
export const stockTrackInputSchema = countItemSchema
  .extend({ unitCost: minorAmountSchema.optional(), costCurrency: currencySchema.optional() })
  .superRefine((item, ctx) => {
    if (item.unitCost !== undefined && !item.costCurrency) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required", path: ["costCurrency"] });
  });
export type StockTrackInput = z.infer<typeof stockTrackInputSchema>;

/** Most product options started at once from the Stock list. */
export const MAX_TRACK_MANY = 100;

/** Each option once in a list of items: a second one is refused under its place. */
function eachOptionOnce(items: readonly { variantId: string }[], ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.variantId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "option_duplicate", path: ["items", index, "variantId"] });
    seen.add(item.variantId);
  });
}

/** Many options, each with what was counted on the shelf, at most `max` at once; an option listed twice is refused. */
const countsSchema = <Item extends z.ZodType<{ variantId: string }>>(item: Item, max: number) =>
  z.object({ items: z.array(item).min(1, "required").max(max, "too_long") }).superRefine((input, ctx) => eachOptionOnce(input.items, ctx));

/** Start tracking many options at once, each from its own count. */
export const stockTrackManyInputSchema = countsSchema(stockTrackInputSchema, MAX_TRACK_MANY);
export type StockTrackManyInput = z.infer<typeof stockTrackManyInputSchema>;

/** Most items one stock count saves at once (stock-count.ts). */
export const MAX_STOCK_COUNT = 500;


/** Moving stock from one location to another (Advance plan). */
export const stockTransferInputSchema = z
  .object({
    from: locationSchema,
    to: locationSchema,
    ...itemFields,
  })
  .refine((transfer) => transfer.from.type !== transfer.to.type || transfer.from.id !== transfer.to.id, {
    message: "same_location",
    path: ["to"],
  });

export type StockTransferInput = z.infer<typeof stockTransferInputSchema>;

/** A new warehouse or branch. Khmer name required; English optional. */
export const stockLocationInputSchema = z.object({
  nameKm: z.string().trim().min(1, "required").max(60, "too_long"),
  nameEn: z.string().trim().max(60, "too_long"),
});

/** At or below this many left, buyers see "Only N left"; the seller's item is low (to reorder) there too, unless it has its own minimum. */
export const LOW_STOCK_THRESHOLD = 5;

const reorderLevelSchema = z.number({ invalid_type_error: "quantity_invalid" }).int("quantity_invalid").min(0, "quantity_invalid").max(MAX_STOCK_QUANTITY, "quantity_invalid").nullable();

/**
 * Reorder levels for tracked items (the minimum/maximum rule): reorder when
 * what's free is at or below the minimum, up to the maximum. Empty = the
 * shop's rule. A maximum needs a minimum and is never below it.
 */
export const reorderLevelsInputSchema = z
  .object({
    items: z
      .array(z.object({ variantId: z.string().uuid("required"), min: reorderLevelSchema, max: reorderLevelSchema }))
      .min(1, "required")
      .max(MAX_STOCK_COUNT, "too_long"),
  })
  .superRefine((input, ctx) => {
    eachOptionOnce(input.items, ctx);
    input.items.forEach((item, index) => {
      if (item.max !== null && (item.min === null || item.max < item.min)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "reorder_max_below_min", path: ["items", index, "max"] });
    });
  });
export type ReorderLevelsInput = z.infer<typeof reorderLevelsInputSchema>;

/** The level an item is reordered at: its own minimum, or the shop's rule. */
export const reorderPoint = (min: number | null): number => min ?? LOW_STOCK_THRESHOLD;

/** Whether a tracked item needs ordering: what's free (on hand less what's held) is at or below its reorder point. */
export const needsReorder = (free: number, min: number | null): boolean => free <= reorderPoint(min);

/** How many to order: up to the maximum (twice the reorder point without one), never less than 1. */
export function suggestedOrder(free: number, min: number | null, max: number | null): number {
  return Math.max(1, (max ?? 2 * reorderPoint(min)) - Math.max(0, free));
}

/**
 * What the buyer's shop page says about one item (docs/blueprint.md
 * "Subscription tiers"): Free and Basic stores don't track stock, so their
 * items are always orderable and never show a count.
 */
export type BuyerStockState =
  | { kind: "untracked" }
  | { kind: "in_stock"; available: number }
  | { kind: "low"; available: number }
  | { kind: "sold_out" };

export function getBuyerStockState(tracksStock: boolean, onHand: number): BuyerStockState {
  if (!tracksStock) return { kind: "untracked" };
  const available = Math.max(0, Math.floor(onHand));
  if (available === 0) return { kind: "sold_out" };
  return available <= LOW_STOCK_THRESHOLD ? { kind: "low", available } : { kind: "in_stock", available };
}

/** The most of one item a buyer can have in their cart. null = no limit (stock not tracked). */
export function maxOrderQuantity(state: BuyerStockState): number | null {
  if (state.kind === "untracked") return null;
  return state.kind === "sold_out" ? 0 : state.available;
}

/**
 * Whether an online order takes its stock the moment it's placed: only when
 * it's paid in cash. An order waiting for KHQR or PayWay must hold its stock
 * instead (reserved, given back if it's never paid — Stock part 2), or an
 * unpaid order would keep the stock forever.
 */
export function takesStockWhenPlaced(method: PaymentMethod): boolean {
  return method === "cod";
}

/** Whether one more of this item can go in the cart. */
export function canAddMore(state: BuyerStockState, inCart: number): boolean {
  const max = maxOrderQuantity(state);
  return max === null || inCart < max;
}

/** Whole units typed in a quantity box → number. Blank or anything but digits → NaN. */
export function parseQuantityInput(text: string): number {
  const value = text.trim();
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}
