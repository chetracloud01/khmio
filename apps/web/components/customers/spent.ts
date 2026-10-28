import type { Currency } from "@khmio/shared";
import { formatMoney } from "../order-ui";

/**
 * What a customer spent, as lines: the shop's main currency first, then the
 * other only when they paid in it too (dollars and riel are never added
 * together). Nothing spent yet = zero in the main currency.
 */
export function spentLines(spent: Record<Currency, number>, mainCurrency: Currency): [string, ...string[]] {
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";
  const [first, ...rest] = [mainCurrency, other].filter((currency) => spent[currency] > 0).map((currency) => formatMoney(spent[currency], currency));
  return first === undefined ? [formatMoney(0, mainCurrency)] : [first, ...rest];
}
