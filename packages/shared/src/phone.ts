import { z } from "zod";

/**
 * Normalizes a Cambodian phone number to `855XXXXXXXX(X)`.
 * Accepts input like "012 345 678", "097 123 4567", "+855 97 123 4567",
 * "855971234567". Strips spaces/dashes, the +855 or 855 prefix, and a
 * leading 0, then requires 8-9 remaining digits.
 */
export function normalizeKhmerPhone(input: string): string | null {
  let digits = input.replace(/[\s-]/g, "");

  if (digits.startsWith("+855")) {
    digits = digits.slice(4);
  } else if (digits.startsWith("855")) {
    digits = digits.slice(3);
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (!/^\d{8,9}$/.test(digits)) {
    return null;
  }

  return `855${digits}`;
}

/** Fewest digits a phone search looks for, so "1" doesn't match every number. */
export const MIN_PHONE_SEARCH_DIGITS = 3;

/**
 * What a search box's text means as part of a saved `855…` number, however it
 * was typed ("012 345", "+855 12 345", "855 12"): the digits without the
 * country code or the leading 0. null when the text isn't a phone (it has
 * letters) or is too short to search for.
 */
export function phoneSearchDigits(text: string): string | null {
  const typed = text.trim();
  if (!/^[\d\s+#-]+$/.test(typed)) return null;
  const digits = typed.replace(/\D/g, "").replace(/^855/, "").replace(/^0/, "");
  return digits.length >= MIN_PHONE_SEARCH_DIGITS ? digits : null;
}

/**
 * A saved `855…` number back in the way Cambodians write it: 8 digits →
 * "012 345 678", 9 digits → "097 123 4567". Anything else is returned as is.
 */
export function formatKhmerPhoneLocal(saved: string): string {
  const normalized = normalizeKhmerPhone(saved);
  if (!normalized) return saved;
  const local = `0${normalized.slice(3)}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/**
 * A saved number with its middle hidden, "012 ••• 678": for pages a link may
 * be forwarded to, like the buyer's invoice. The buyer still recognises it.
 */
export function maskKhmerPhone(saved: string): string {
  const parts = formatKhmerPhoneLocal(saved).split(" ");
  if (parts.length !== 3) return "•••";
  return `${parts[0]} ${"•".repeat(parts[1]!.length)} ${parts[2]}`;
}

export const khmerPhoneSchema = z
  .string()
  .transform((val, ctx) => {
    const normalized = normalizeKhmerPhone(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "phone_invalid",
      });
      return z.NEVER;
    }
    return normalized;
  });
