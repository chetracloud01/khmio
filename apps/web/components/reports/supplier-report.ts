import { payablesInOne, type Currency, type PayablesSupplierRow as SharedRow } from "@khmio/shared";
import type { PayablesReport, PayablesSupplierRow } from "@/lib/api";

// What the Suppliers report (design/screens.md S17 "Suppliers") works out
// from the bills report: the table's rows (each currency apart, or one row
// per supplier in one currency), the charts' rows (one currency: the one
// shown, or the shop's), each supplier's return rate, the top suppliers'
// share and the totals. Pure, so it's tested without a page.

type Money = Record<Currency, number>;

/** The table's rows: each supplier in each currency, or — in one currency — one row each. */
export function tableRows(report: PayablesReport, inOne: Currency | null, rate: number): SharedRow[] {
  return inOne ? payablesInOne(report, inOne, rate).suppliers : report.suppliers;
}

/** The charts' rows, in one currency: the one shown, or the shop's (the other is in the table). */
export function chartRows(report: PayablesReport, inOne: Currency | null, rate: number, mainCurrency: Currency): { currency: Currency; rows: SharedRow[] } {
  if (inOne) return { currency: inOne, rows: payablesInOne(report, inOne, rate).suppliers };
  return { currency: mainCurrency, rows: report.suppliers.filter((row) => row.currency === mainCurrency) };
}

/** What went back of what came: returned ÷ (bought + returned), in whole percent; null when nothing came. */
export const returnRate = (row: Pick<PayablesSupplierRow, "bought" | "returned">): number | null => {
  const came = row.bought + row.returned;
  return came > 0 ? Math.round((row.returned / came) * 100) : null;
};

/** The top suppliers by what was bought, and the rest together: the share ring's parts. */
export function shareParts(rows: readonly SharedRow[], top: number): { key: string; supplierName: string; bought: number; others: boolean }[] {
  const bought = [...rows].filter((row) => row.bought > 0).sort((a, b) => b.bought - a.bought);
  const rest = bought.slice(top).reduce((sum, row) => sum + row.bought, 0);
  return [...bought.slice(0, top).map((row) => ({ key: row.key, supplierName: row.supplierName, bought: row.bought, others: false })), ...(rest > 0 ? [{ key: "others", supplierName: "", bought: rest, others: true }] : [])];
}

/** The report's totals, each currency apart (the page writes them in one when asked, marked "≈"). */
export function totals(report: PayablesReport): Record<"bought" | "returned" | "paid" | "owed" | "overdue", Money> {
  const pick = (field: "bought" | "returned" | "paid" | "owed" | "overdue"): Money => ({ USD: report.currencies.USD.figures[field], KHR: report.currencies.KHR.figures[field] });
  return { bought: pick("bought"), returned: pick("returned"), paid: pick("paid"), owed: pick("owed"), overdue: pick("overdue") };
}
