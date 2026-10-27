import { z } from "zod";
import type { PaymentMethod } from "./checkout";

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

export const stockAdjustmentReasonSchema = z.enum(["count_correction", "damaged", "lost", "returned", "other"]);
export type StockAdjustmentReason = z.infer<typeof stockAdjustmentReasonSchema>;

const quantitySchema = z
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
 * A change to one product option's stock at the shop's main branch (the live
 * Stock page, design/screens.md S13): stock arriving, or a correction with its
 * reason. Sales and their returns are written by orders, never typed.
 */
export const stockChangeInputSchema = z
  .object({
    variantId: z.string().uuid("required"),
    type: z.enum(["purchase", "adjust_in", "adjust_out"]),
    quantity: quantitySchema,
    reason: stockAdjustmentReasonSchema.optional(),
    note: noteSchema,
  })
  .superRefine(requireAdjustmentReason);
export type StockChangeInput = z.infer<typeof stockChangeInputSchema>;

/** Start tracking one product option's stock, from a count (0 = sold out until stock arrives). */
export const stockTrackInputSchema = z.object({
  variantId: z.string().uuid("required"),
  onHand: z.number({ invalid_type_error: "quantity_invalid" }).int("quantity_invalid").min(0, "quantity_invalid").max(MAX_STOCK_QUANTITY, "quantity_invalid"),
});
export type StockTrackInput = z.infer<typeof stockTrackInputSchema>;

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

/** At or below this many left, buyers see "Only N left" and the stock screen marks the item low. */
export const LOW_STOCK_THRESHOLD = 5;

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
