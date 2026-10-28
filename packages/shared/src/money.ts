import { z } from "zod";

export const currencySchema = z.enum(["USD", "KHR"]);

/** Cents or riel, as a price or a cost is typed. The cap stops a slipped finger (an extra few zeros) from saving. */
export const minorAmountSchema = z
  .number({ invalid_type_error: "price_invalid" })
  .int("price_invalid")
  .min(0, "price_invalid")
  .max(1_000_000_000, "price_invalid");
export type Currency = z.infer<typeof currencySchema>;

/** USD stored as integer cents, e.g. $8.50 -> 850. */
export const usdCentsSchema = z.number().int().nonnegative();

/** KHR stored as integer riel, e.g. ៛34,850 -> 34850 (riel has no subunit). */
export const khrSchema = z.number().int().nonnegative();

/**
 * What a seller typed in a USD price box → cents. "8.5" → 850, "1,200" → 120000.
 * Blank → undefined (no price). Anything else — letters, a minus sign, more
 * than 2 decimals — → NaN, which every money schema rejects.
 */
export function parseUsdInput(text: string): number | undefined {
  const value = text.trim().replace(/,/g, "");
  if (!value) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return Number.NaN;
  return Math.round(Number(value) * 100);
}

/** Same for a KHR price box → riel. Riel has no decimals, so "5000.5" → NaN. */
export function parseKhrInput(text: string): number | undefined {
  const value = text.trim().replace(/,/g, "");
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) return Number.NaN;
  return Number(value);
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatKhr(riel: number): string {
  return `${riel.toLocaleString("en-US")}៛`;
}

export function convertUsdCentsToKhr(cents: number, usdToKhrRate: number): number {
  return Math.round((cents / 100) * usdToKhrRate);
}

export function convertKhrToUsdCents(riel: number, usdToKhrRate: number): number {
  return Math.round((riel / usdToKhrRate) * 100);
}

/** A saved USD price as the text of its price box: 850 → "8.50"; no price → "". */
export function usdInputText(cents: number | null | undefined): string {
  return cents != null ? (cents / 100).toFixed(2) : "";
}

/** A saved KHR price as the text of its price box: 34850 → "34850"; no price → "". */
export function khrInputText(riel: number | null | undefined): string {
  return riel != null ? riel.toString() : "";
}

/**
 * The KHR box filled from what was typed in the USD one, at the store's rate
 * (docs/blueprint.md "Multi-currency pricing and totals"). Only from a price
 * that reads correctly; a typo gives undefined and is left for the save check.
 */
export function khrTextFromUsdText(usdText: string, usdToKhrRate: number): string | undefined {
  const cents = parseUsdInput(usdText);
  if (cents === undefined || Number.isNaN(cents)) return undefined;
  return convertUsdCentsToKhr(cents, usdToKhrRate).toString();
}

/** The USD box filled from the KHR one, the same way. */
export function usdTextFromKhrText(khrText: string, usdToKhrRate: number): string | undefined {
  const riel = parseKhrInput(khrText);
  if (riel === undefined || Number.isNaN(riel)) return undefined;
  return usdInputText(convertKhrToUsdCents(riel, usdToKhrRate));
}
