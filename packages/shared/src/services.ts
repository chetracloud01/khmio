import { z } from "zod";
import { getDeliveryQuote, type DeliveryChoice, type DeliveryQuote, type DeliverySettings } from "./delivery";
import type { FormErrorCode } from "./form-errors";

// Services (Features › "services", business-modules.ts; blueprint step 14):
// a product may be a service — no stock, nothing to deliver. A cart of only
// services asks for a preferred date and time, and where: at the shop
// ("pickup", open even when the shop doesn't offer pickup of goods) or at the
// buyer's place (the delivery address, with its fee as for goods).

export const productKindSchema = z.enum(["item", "service"]);
export type ProductKind = z.infer<typeof productKindSchema>;

/** How far ahead a buyer can ask for a time: further than this is almost always a typo. */
export const MAX_BOOKING_DAYS_AHEAD = 90;

/** True when every line is a service (an empty cart is not). */
export function isServiceOnly(kinds: readonly ProductKind[]): boolean {
  return kinds.length > 0 && kinds.every((kind) => kind === "service");
}

/** The buyer's preferred time for a service-only order: needed, in the future, within MAX_BOOKING_DAYS_AHEAD. null = fine. */
export function bookingProblem(preferredAt: string | undefined, now: Date): FormErrorCode | null {
  if (!preferredAt) return "required";
  const at = Date.parse(preferredAt);
  if (!Number.isFinite(at)) return "date_invalid";
  if (at <= now.getTime()) return "booking_in_past";
  if (at - now.getTime() > MAX_BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000) return "booking_too_far";
  return null;
}

/** The delivery quote for an order: a service done at the shop is always there and free; anything else as for goods. */
export function getOrderQuote(settings: DeliverySettings, choice: DeliveryChoice, serviceOnly: boolean): DeliveryQuote {
  if (serviceOnly && choice.fulfilment === "pickup") return { status: "ok", fee: {} };
  return getDeliveryQuote(settings, choice);
}
