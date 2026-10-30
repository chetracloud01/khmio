import { amountIn, type Currency } from "@khmio/shared";
import { formatMoney } from "../order-ui";

type Money = Record<Currency, number>;

/**
 * A report's money, as written (design/screens.md S17): each currency apart —
 * the shop's first, the other as a second line when there is some — or, with
 * "show all in one currency", both turned into one at the shop's rate and
 * marked "≈" (for reading only). `sign` writes a + or − before each amount (none before nothing).
 */
export function moneyLines(money: Money, mainCurrency: Currency, inOne: Currency | null, rate: number, sign = false): { main: string; other: string | null } {
  const write = (amount: number, currency: Currency, approx = false) => `${approx ? "≈ " : ""}${amount < 0 ? "−" : sign && amount > 0 ? "+" : ""}${formatMoney(Math.abs(amount), currency)}`;
  if (inOne) return { main: write(amountIn(money.USD, "USD", inOne, rate) + amountIn(money.KHR, "KHR", inOne, rate), inOne, money.USD !== 0 && money.KHR !== 0), other: null };
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";
  // Only the other currency has some: it leads.
  if (money[mainCurrency] === 0 && money[other] !== 0) return { main: write(money[other], other), other: null };
  return { main: write(money[mainCurrency], mainCurrency), other: money[other] !== 0 ? write(money[other], other) : null };
}

/** An amount in one currency in the report's view: as it is, or turned into the one shown. */
export function oneAmount(amount: number, currency: Currency, inOne: Currency | null, rate: number): string {
  if (!inOne || inOne === currency) return formatMoney(amount, currency);
  return `≈ ${formatMoney(amountIn(amount, currency, inOne, rate), inOne)}`;
}

/** A chart's amount: in one currency when all is shown in one (turned at the shop's rate), else the shop's own currency only (the other is in the table). */
export function chartAmount(money: Money, mainCurrency: Currency, inOne: Currency | null, rate: number): number {
  return inOne ? amountIn(money.USD, "USD", inOne, rate) + amountIn(money.KHR, "KHR", inOne, rate) : money[mainCurrency];
}
