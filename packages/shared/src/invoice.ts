import { z } from "zod";
import { khmerPhoneSchema } from "./phone";
import type { PaymentMethod } from "./checkout";
import type { OrderStatus } from "./orders";

// Invoices, receipts and tracking codes (design/screens.md B7 and B8).

/** What the document says at the top and stamps across it. */
export const invoiceStateSchema = z.enum(["unpaid", "paid", "cancelled"]);
export type InvoiceState = z.infer<typeof invoiceStateSchema>;

/**
 * "Invoice" until the buyer has paid, then "Receipt". KHQR is paid from the
 * "paid" status on; cash is paid once it's handed over — at delivery (or
 * pickup), so "delivered" and "completed".
 */
export function getInvoiceState(order: { status: OrderStatus; paymentMethod: PaymentMethod }): InvoiceState {
  if (order.status === "cancelled") return "cancelled";
  if (order.paymentMethod === "cod") return order.status === "delivered" || order.status === "completed" ? "paid" : "unpaid";
  return order.status === "awaiting_payment" ? "unpaid" : "paid";
}

/** 32 letters and digits without look-alikes: no 0/O, no 1/I. */
export const TRACKING_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const TRACKING_CODE_LENGTH = 8;
const CODE = new RegExp(`^[${TRACKING_CODE_ALPHABET}]{${TRACKING_CODE_LENGTH}}$`);

/** The shop part in front of a code: the first three letters or digits of its link ("mekong-auto-garage" → "MEK"). */
export function trackingCodePrefix(slug: string): string {
  return slug.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
}

/** How a code is shown and printed: MEK-7K4P-9QXR. */
export function formatTrackingCode(slug: string, code: string): string {
  const prefix = trackingCodePrefix(slug);
  return `${prefix ? `${prefix}-` : ""}${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * The 8-character code from what a buyer typed: any case, with or without the
 * shop part and dashes or spaces. Null when it can't be a code.
 */
export function parseTrackingCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const code = compact.length > TRACKING_CODE_LENGTH ? compact.slice(-TRACKING_CODE_LENGTH) : compact;
  return CODE.test(code) ? code : null;
}

/** The "Track my order" form: both are needed, so a code alone never shows anyone's order. */
export const trackOrderInputSchema = z.object({
  code: z.string().trim().min(1, "required").max(40, "too_long").refine((value) => parseTrackingCode(value) !== null, "tracking_code_invalid"),
  phone: khmerPhoneSchema,
});
export type TrackOrderInput = z.infer<typeof trackOrderInputSchema>;

export const MAX_INVOICE_NOTE_LENGTH = 300;

/** "On your invoices" (design/screens.md S10): printed as plain text, each only when filled in. */
export const invoiceDetailsSchema = z.object({
  taxNumber: z.string().trim().max(40, "too_long"),
  invoiceNote: z.string().trim().max(MAX_INVOICE_NOTE_LENGTH, "too_long"),
  telegramLink: z.string().trim().max(100, "too_long"),
  facebookLink: z.string().trim().max(100, "too_long"),
});
export type InvoiceDetails = z.infer<typeof invoiceDetailsSchema>;

const SOCIAL_HOMES = { telegram: "https://t.me/", facebook: "https://facebook.com/" } as const;
export type SocialNetwork = keyof typeof SOCIAL_HOMES;

/**
 * A seller's Telegram or Facebook as they typed it ("t.me/shop", "@shop",
 * "https://facebook.com/shop" or just "shop") as a link a buyer can open.
 * Only http(s) links come out: the text is the seller's, never a javascript: URL.
 */
export function socialLinkUrl(network: SocialNetwork, text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  if (value.includes(".")) return `https://${value}`;
  return `${SOCIAL_HOMES[network]}${value.replace(/^@/, "")}`;
}
