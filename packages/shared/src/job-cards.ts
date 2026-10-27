import { z } from "zod";
import { MAX_LINE_QUANTITY, MAX_ORDER_LINES } from "./order-total";
import { MAX_ITEM_NOTE_LENGTH } from "./product-options";
import { optionalKhmerPhoneSchema } from "./store";

// Vehicles and job cards (Features › "jobCards", business-modules.ts): a
// garage books a car in, writes what's wrong, adds the parts and labour (its
// own products; labour is a service), and bills it at the counter when the
// car is handed back — the sale is an ordinary counter sale.

export const jobCardStatusSchema = z.enum(["open", "in_progress", "ready", "handed_over", "cancelled"]);
export type JobCardStatus = z.infer<typeof jobCardStatusSchema>;

/** A plate as kept: trimmed and upper-case ("pp 2a-1234" → "PP 2A-1234"). */
const plateSchema = z
  .string()
  .trim()
  .min(1, "required")
  .max(20, "too_long")
  .transform((plate) => plate.toUpperCase());

export const vehicleInputSchema = z.object({
  plate: plateSchema,
  makeModel: z.string().trim().max(60, "too_long").default(""),
  ownerName: z.string().trim().max(60, "too_long").default(""),
  ownerPhone: optionalKhmerPhoneSchema,
});
export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export const jobCardLineInputSchema = z.object({
  variantId: z.string().uuid("product_unavailable"),
  quantity: z.number({ invalid_type_error: "quantity_invalid" }).int("quantity_invalid").min(1, "quantity_invalid").max(MAX_LINE_QUANTITY, "quantity_invalid"),
  note: z.string().trim().max(MAX_ITEM_NOTE_LENGTH, "too_long").default(""),
});

/** A new job card, or its changes while it's still being worked on. */
export const jobCardInputSchema = z.object({
  vehicleId: z.string().uuid("required"),
  complaint: z.string().trim().max(500, "too_long").default(""),
  mileageKm: z.number({ invalid_type_error: "number_invalid" }).int("number_invalid").min(0, "number_invalid").max(10_000_000, "number_invalid").optional(),
  lines: z.array(jobCardLineInputSchema).max(MAX_ORDER_LINES, "too_long").default([]),
});
export type JobCardInput = z.infer<typeof jobCardInputSchema>;

/** The steps a person moves a card through. "handed_over" comes only from billing it at the counter. */
const NEXT: Record<JobCardStatus, readonly JobCardStatus[]> = {
  open: ["in_progress", "cancelled"],
  in_progress: ["ready", "open", "cancelled"],
  ready: ["in_progress", "cancelled"],
  handed_over: [],
  cancelled: [],
};

export function canMoveJobCard(from: JobCardStatus, to: JobCardStatus): boolean {
  return NEXT[from].includes(to);
}

export function nextJobCardSteps(from: JobCardStatus): readonly JobCardStatus[] {
  return NEXT[from];
}

/** Still at the garage: its details and work can change, and it can be billed. */
export function isJobCardOpen(status: JobCardStatus): boolean {
  return status === "open" || status === "in_progress" || status === "ready";
}

export const jobCardStatusRequestSchema = z.object({ status: jobCardStatusSchema });
