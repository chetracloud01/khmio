"use client";

import { addDays, currencySchema, DUE_DAY_CHOICES, phnomPenhDay, purchasePaymentMethodSchema, type Currency } from "@khmio/shared";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

// A New bill as it's being typed (design/screens.md S13 "New bill"): kept in
// this browser while typing, so a closed page or a dropped phone brings it
// back. Only this person's own browser keeps it; the bill itself is saved by
// the API. Read back through the schema: anything that isn't a draft is
// dropped, never trusted.

const DUE_DAYS: readonly number[] = DUE_DAY_CHOICES;

/** On credit: "none" (no day agreed), a number of days after the bill (DUE_DAY_CHOICES), or "other" (a day picked). */
export const dueChoiceSchema = z.union([z.enum(["none", "other"]), z.number().refine((days) => DUE_DAYS.includes(days))]);
export type DueChoice = z.infer<typeof dueChoiceSchema>;

const draftLineSchema = z.object({ variantId: z.string(), quantity: z.string(), cost: z.string() });
export type DraftLine = z.infer<typeof draftLineSchema>;

export const billDraftSchema = z.object({
  supplierId: z.string(),
  billRef: z.string(),
  purchasedOn: z.string(),
  currency: currencySchema,
  /** Riel per $1 as typed, for lines in the other currency; starts at the shop's rate. */
  exchangeRate: z.string().default(""),
  note: z.string(),
  paidNow: z.boolean(),
  method: purchasePaymentMethodSchema,
  dueChoice: dueChoiceSchema,
  dueOn: z.string(),
  lines: z.array(draftLineSchema),
});
export type BillDraft = z.infer<typeof billDraftSchema>;

/** A fresh bill: today, paid now in cash, at the shop's rate. */
export function emptyDraft(currency: Currency, shopRate: number): BillDraft {
  return { supplierId: "", billRef: "", purchasedOn: phnomPenhDay(new Date()), currency, exchangeRate: String(shopRate), note: "", paidNow: true, method: "cash", dueChoice: "none", dueOn: "", lines: [] };
}

/** The day a bill on credit is due, from its due choice; empty: none. */
export function dueOnOf(draft: Pick<BillDraft, "purchasedOn" | "dueChoice" | "dueOn">): string {
  if (draft.dueChoice === "none") return "";
  if (draft.dueChoice === "other") return draft.dueOn;
  return addDays(draft.purchasedOn, draft.dueChoice);
}

/** The bill's rate as typed, when it's a whole number of riel within the platform's band; else null. */
export function rateOf(text: string, band: { min: number; max: number }): number | null {
  const rate = /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
  return Number.isInteger(rate) && rate >= band.min && rate <= band.max ? rate : null;
}

/** Whether the draft holds anything worth keeping (lines, or something typed). */
export const draftHasWork = (draft: BillDraft) => draft.lines.length > 0 || draft.billRef.trim() !== "" || draft.note.trim() !== "";

function readDraft(key: string): BillDraft | null {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;
    const parsed = billDraftSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * The bill being typed, kept under `key` (one per shop) as it changes.
 * `start` is used when there's no kept draft — or always, when the page was
 * opened with something to buy (Create bill from the Stock list). Says
 * whether a kept draft was brought back.
 */
export function useBillDraft(key: string, start: () => BillDraft, startWins: boolean) {
  const [draft, setDraft] = useState<BillDraft>(start);
  const [restored, setRestored] = useState(false);

  // After the first paint (the browser's storage isn't there on the server).
  useEffect(() => {
    if (startWins) return;
    const kept = readDraft(key);
    if (kept && draftHasWork(kept)) {
      setDraft(kept);
      setRestored(true);
    }
  }, [key, startWins]);

  useEffect(() => {
    try {
      if (draftHasWork(draft)) window.localStorage.setItem(key, JSON.stringify(draft));
      else window.localStorage.removeItem(key);
    } catch {
      // A private window may refuse storage: the bill still works, it just isn't kept.
    }
  }, [key, draft]);

  const clear = useCallback(
    (next: BillDraft) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // As above.
      }
      setDraft(next);
      setRestored(false);
    },
    [key],
  );

  return { draft, setDraft, restored, clear };
}
