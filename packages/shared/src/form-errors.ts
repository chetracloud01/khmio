import type { ZodError } from "zod";

// Every form schema reports problems as one of these codes (the Zod issue
// `message`), never as display text. The browser shows them through the
// "FormErrors" namespace in messages/*.json, and the API returns the same
// codes per field, so both sides speak one language.
export const FORM_ERROR_CODES = [
  "required",
  "too_short",
  "too_long",
  "phone_invalid",
  "tracking_code_invalid",
  "bakong_invalid",
  "slug_invalid",
  "price_invalid",
  "price_required",
  "wholesale_above_retail",
  "discount_range",
  "option_label_required",
  "sku_invalid",
  "sku_duplicate",
  "quantity_invalid",
  "cod_unavailable",
  "rate_invalid",
  "rate_out_of_band",
  "vat_range",
  "reason_required",
  "same_location",
  "id_number_invalid",
  "photo_required",
  "otp_invalid",
  "district_required",
  "province_required",
  "district_duplicate",
  "zone_empty",
  "delivery_required",
  "telegram_invalid",
  "telegram_taken",
  "slug_taken",
  "cart_empty",
  "product_unavailable",
  "delivery_unavailable",
  "payment_unavailable",
  "link_invalid",
  "map_link_invalid",
  "cash_short",
  "ends_before_start",
] as const;

export type FormErrorCode = (typeof FORM_ERROR_CODES)[number];

function isFormErrorCode(value: string): value is FormErrorCode {
  return (FORM_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Flattens a failed parse to `{ "field.path": code }`, first problem per field
 * wins. Paths join with dots, e.g. `variants.2.sku`. Unknown messages (a rule
 * that forgot its code) fall back to "required" rather than leaking English.
 */
export function toFieldErrors(error: ZodError): Record<string, FormErrorCode> {
  const errors: Record<string, FormErrorCode> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    errors[key] ??= isFormErrorCode(issue.message) ? issue.message : "required";
  }
  return errors;
}
