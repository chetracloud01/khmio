"use client";

import { formatDocumentNumber, purchaseSeries } from "@khmio/shared";
import { formatMoney } from "@/components/order-ui";
import { useDateText } from "@/components/use-date-text";
import type { PurchaseRow } from "@/lib/api";

/** How a bill or a return is named and totalled, on the list and on its own page. */
export function usePurchaseText() {
  const { date } = useDateText();
  return {
    /** "BILL-0012" or "RET-0003": each kind counts on its own (packages/shared documents.ts). */
    title: (purchase: Pick<PurchaseRow, "kind" | "number">) => formatDocumentNumber(purchaseSeries(purchase.kind), purchase.number),
    /** A return's total is goods gone back: shown with a minus. */
    total: (purchase: Pick<PurchaseRow, "kind" | "totalMinor" | "currency">) => `${purchase.kind === "return" ? "−" : ""}${formatMoney(purchase.totalMinor, purchase.currency)}`,
    /** "28 Oct 2026" for the bill's day ("2026-10-28", a Phnom Penh day: read at its noon). */
    billDay: (dayKey: string) => date(`${dayKey}T12:00:00+07:00`),
  };
}
