import { khrInputText, parseKhrInput, parseUsdInput, usdInputText, type Currency } from "@khmio/shared";
import { localText } from "../../lib/local-name";

/** A product option as the Stock list, a bill and a return name it: "Brake pads · Front", in the page's language (the other one when it's empty). */
export function itemName(locale: string, item: { titleKm: string; titleEn: string; optionKm: string; optionEn: string }): string {
  return [localText(locale, item.titleKm, item.titleEn), localText(locale, item.optionKm, item.optionEn)].filter(Boolean).join(" · ");
}

/** How a cost of one is typed in each currency (messages "Stock"), read back from the box, and written into it. */
export const COST_INPUT = {
  USD: { label: "costOfOneUsd", inputMode: "decimal", parse: parseUsdInput, text: usdInputText },
  KHR: { label: "costOfOneKhr", inputMode: "numeric", parse: parseKhrInput, text: khrInputText },
} as const;

/** A product's one cost currency: its options share it (null = no cost yet). */
export function productCostCurrency<I extends { productId: string; costCurrency: Currency | null }>(items: readonly I[], item: I): Currency | null {
  return item.costCurrency ?? items.find((other) => other.productId === item.productId && other.costCurrency)?.costCurrency ?? null;
}
