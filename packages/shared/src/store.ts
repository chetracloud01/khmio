import { z } from "zod";
import { businessTypeSchema } from "./business";
import { requirePickupAddress, shopLocationFields } from "./delivery";
import { invoiceDetailsSchema } from "./invoice";
import { normalizeKhmerPhone } from "./phone";

// The shop's own details, as the merchant enters them in onboarding and the
// shop profile. Same schema for the form now and the API later.

export const shopNameSchema = z
  .string()
  .trim()
  .min(2, "too_short")
  .max(60, "too_long");

/** The shop link: lowercase letters and digits in words joined by single dashes, e.g. `sokha-coffee`. */
export const shopSlugSchema = z
  .string()
  .min(3, "too_short")
  .max(40, "too_long")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug_invalid");

/** A shop link from any text: lowercase English letters and digits joined by dashes. Khmer letters give "". */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** Links the platform keeps for itself (its own pages), so no shop can take them. */
export const RESERVED_SLUGS: readonly string[] = ["admin", "api", "app", "auth", "dashboard", "help", "login", "m", "s", "shop", "support", "www"];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug);
}

/** What onboarding sends to create a store: the two questions. */
export const createStoreInputSchema = z.object({
  businessType: businessTypeSchema,
  shopName: shopNameSchema,
  slug: shopSlugSchema.refine((slug) => !isReservedSlug(slug), "slug_invalid"),
});
export type CreateStoreInput = z.infer<typeof createStoreInputSchema>;

/** A Bakong account ID, e.g. `sokha@aclb`. The API also checks it exists with Bakong. */
export const bakongAccountIdSchema = z
  .string()
  .trim()
  .min(1, "required")
  .max(64, "too_long")
  .regex(/^[^\s@]+@[^\s@]+$/, "bakong_invalid");

/** Where the shop delivers from / where a buyer wants delivery. Cash on delivery is Phnom Penh only. */
export const deliveryAreaSchema = z.enum(["phnom_penh", "province"]);
export type DeliveryArea = z.infer<typeof deliveryAreaSchema>;

/** Optional phone: blank is fine, anything else must be a real Cambodian number (saved as 855…). */
export const optionalKhmerPhoneSchema = z
  .string()
  .transform((value, ctx) => {
    if (!value.trim()) return "";
    const normalized = normalizeKhmerPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "phone_invalid" });
      return z.NEVER;
    }
    return normalized;
  });

export const storeProfileSchema = z.object({
  shopName: shopNameSchema,
  businessType: businessTypeSchema,
  phone: optionalKhmerPhoneSchema,
  area: deliveryAreaSchema,
  description: z.string().trim().max(300, "too_long"),
  /**
   * Optional here: a new shop can be saved before it's set up to get paid.
   * Until it's added, checkout offers no KHQR (see getAvailablePaymentMethods).
   */
  bakongId: z.union([z.literal(""), bakongAccountIdSchema]),
});

export type StoreProfileInput = z.input<typeof storeProfileSchema>;

/**
 * The shop details page sends the profile plus the logo and the payment QR
 * picture (each an uploaded photo's key, or null to remove it).
 */
export const storeDetailsSaveSchema = storeProfileSchema.extend({
  logoKey: z.string().min(1).max(200).nullable(),
  /** The seller's own KHQR picture, shown to buyers paying at the counter (design/screens.md P2). */
  paymentQrKey: z.string().min(1).max(200).nullable(),
});
export type StoreDetailsSave = z.infer<typeof storeDetailsSaveSchema>;

/**
 * Shop details as one save, in its groups (design/screens.md S10): the shop,
 * its location and pickup, getting paid (with cash on delivery), prices and
 * tax, and what goes on invoices — what PUT /store runs. The exchange rate
 * must sit in today's band (admin Settings). Whether pickup may be switched
 * off also depends on the delivery settings (offersAnyFulfilment), which the
 * API checks.
 */
export function shopDetailsSaveSchema(band: ExchangeRateBand) {
  return storeDetailsSaveSchema
    .merge(shopLocationFields)
    .merge(storeSettingsSchema(band).omit({ onlineStockLocation: true }))
    .merge(invoiceDetailsSchema)
    .superRefine(requirePickupAddress);
}
export type ShopDetailsSave = z.infer<ReturnType<typeof shopDetailsSaveSchema>>;
export type StoreProfile = z.output<typeof storeProfileSchema>;

/** The band the super admin allows a store's USD→KHR rate in (admin Settings). */
export interface ExchangeRateBand {
  min: number;
  max: number;
}

export const MAX_VAT_PERCENT = 20;

/**
 * How the shop sells: the numbers every buyer total is built from
 * (docs/blueprint.md "Multi-currency pricing and totals"). The rate is
 * checked against the platform band on save — rejected, never silently
 * clamped at checkout. Delivery fees live in delivery.ts (per zone).
 */
export function storeSettingsSchema(band: ExchangeRateBand) {
  return z.object({
    defaultCurrency: z.enum(["USD", "KHR"]),
    usdToKhrRate: z
      .number({ invalid_type_error: "rate_invalid" })
      .int("rate_invalid")
      .min(band.min, "rate_out_of_band")
      .max(band.max, "rate_out_of_band"),
    allowCod: z.boolean(),
    vatPercent: z
      .number({ invalid_type_error: "vat_range" })
      .int("vat_range")
      .min(0, "vat_range")
      .max(MAX_VAT_PERCENT, "vat_range"),
    /**
     * Advance plan: the warehouse or branch whose stock the buyer shop page
     * sells from. Unset = the main branch (the only location on Pro).
     */
    onlineStockLocation: z
      .object({ type: z.enum(["warehouse", "branch"]), id: z.string().min(1, "required") })
      .optional(),
  });
}

export type StoreSettings = z.infer<ReturnType<typeof storeSettingsSchema>>;

/** The rate checkout actually uses. Settings are checked on save; this also covers a band the admin narrowed later. */
export function clampExchangeRate(rate: number, band: ExchangeRateBand): number {
  return Math.min(band.max, Math.max(band.min, rate));
}
