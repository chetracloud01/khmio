import { z } from "zod";
import type { DocumentSeries } from "./documents";
import { ID_FILTER, type ListSpec } from "./list-query";
import { currencySchema, minorAmountSchema, type Currency } from "./money";
import { unitCostIn } from "./profit";
import { MAX_SUPPLIER_LENGTH, quantitySchema } from "./stock";
import { optionalKhmerPhoneSchema } from "./store";
import { addDays, phnomPenhDay } from "./time";

// Suppliers and purchases (docs/blueprint.md "Cost price", level 2+;
// design/screens.md S13): a purchase is one supplier bill with many lines in
// one currency, received in one go — each line adds stock and moves its
// product's cost to the moving average, in the product's one cost currency
// (a line in the other currency is turned into it once, at the bill's rate,
// and the bill keeps the rate). A return sends goods back to the
// supplier, never more than that bill brought in. Bills are never edited: a
// mistake is fixed with a return. Pro plan, like stock.

export const MAX_SUPPLIER_NOTE_LENGTH = 200;
export const MAX_BILL_REF_LENGTH = 40;
export const MAX_PURCHASE_NOTE_LENGTH = 200;
/** Most lines one bill holds. */
export const MAX_PURCHASE_LINES = 100;

export const supplierInputSchema = z.object({
  name: z.string().trim().min(1, "required").max(MAX_SUPPLIER_LENGTH, "too_long"),
  /** 855…, or empty. */
  phone: optionalKhmerPhoneSchema.default(""),
  note: z.string().trim().max(MAX_SUPPLIER_NOTE_LENGTH, "too_long").default(""),
});
export type SupplierInput = z.infer<typeof supplierInputSchema>;

/** Out of the bill's supplier picker, or back in it. */
export const supplierArchiveInputSchema = z.object({ archived: z.boolean() });

/** A day as the bill shows it: YYYY-MM-DD (Phnom Penh). */
const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date_invalid")
  .refine((day) => !Number.isNaN(Date.parse(`${day}T00:00:00Z`)), "date_invalid");

/** A day that has already come (today or before, in Phnom Penh): a bill is dated, and a payment made, when it happened — never ahead. */
export const pastDaySchema = daySchema.refine((day) => day <= phnomPenhDay(new Date()), "date_in_future");

/** Every product option once per bill or return. */
function eachOptionOnce(lines: { variantId: string }[], ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    if (seen.has(line.variantId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "option_duplicate", path: ["lines", index, "variantId"] });
    seen.add(line.variantId);
  });
}

export const purchaseLineInputSchema = z.object({
  variantId: z.string().uuid("required"),
  quantity: quantitySchema,
  /** What one cost, in the bill's currency. */
  unitCost: minorAmountSchema,
});

/** How a supplier was paid. */
export const PURCHASE_PAYMENT_METHODS = ["cash", "bank", "khqr", "other"] as const;
export const purchasePaymentMethodSchema = z.enum(PURCHASE_PAYMENT_METHODS);
export type PurchasePaymentMethod = z.infer<typeof purchasePaymentMethodSchema>;

export const purchaseInputSchema = z
  .object({
    supplierId: z.string().uuid("required").optional(),
    billRef: z.string().trim().max(MAX_BILL_REF_LENGTH, "too_long").default(""),
    purchasedOn: pastDaySchema,
    /** The goods have arrived: stock goes up as the bill is saved. false: saved now, stock goes up when it's received. */
    received: z.boolean().default(true),
    /** Paid now, in full, this way (most small shops pay on the spot). Left out: bought on credit. */
    payment: z.object({ method: purchasePaymentMethodSchema }).optional(),
    /** Bought on credit: the day it should be paid by, on or after the bill's day. */
    dueOn: daySchema.optional(),
    /** The bill's currency, as invoiced. An item whose cost is kept in the other currency is turned into it once, at exchangeRate. */
    currency: currencySchema,
    /** Riel per $1 for this bill's lines in the other currency (the shop's rate unless the invoice says otherwise); the server checks it's within the platform's band, and that it's there when a line needs it. */
    exchangeRate: z.number({ invalid_type_error: "rate_invalid" }).int("rate_invalid").positive("rate_invalid").optional(),
    note: z.string().trim().max(MAX_PURCHASE_NOTE_LENGTH, "too_long").default(""),
    lines: z.array(purchaseLineInputSchema).min(1, "required").max(MAX_PURCHASE_LINES, "too_long"),
  })
  .superRefine((input, ctx) => {
    eachOptionOnce(input.lines, ctx);
    // A due day belongs to a bill bought on credit, never before the bill itself.
    if (input.dueOn && (input.payment || input.dueOn < input.purchasedOn)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "date_invalid", path: ["dueOn"] });
  });
export type PurchaseInput = z.infer<typeof purchaseInputSchema>;

export const MAX_PAYMENT_NOTE_LENGTH = 200;

/** On credit: the usual "due in" choices, in days after the bill (New bill's chips). */
export const DUE_DAY_CHOICES = [7, 15, 30] as const;

/** Money paid to the supplier against one bill, in the bill's currency: above zero, never more than it still owes (the server checks). */
export const purchasePaymentInputSchema = z.object({
  amount: minorAmountSchema.refine((amount) => amount > 0, "price_invalid"),
  paidOn: pastDaySchema,
  method: purchasePaymentMethodSchema,
  note: z.string().trim().max(MAX_PAYMENT_NOTE_LENGTH, "too_long").default(""),
});
export type PurchasePaymentInput = z.infer<typeof purchasePaymentInputSchema>;

/** Where a bill stands with its supplier. */
export const PURCHASE_PAYMENT_STATES = ["unpaid", "part", "paid", "overdue"] as const;
export type PurchasePaymentState = (typeof PURCHASE_PAYMENT_STATES)[number];

/**
 * What a bill still owes — its total less its returns less what was paid —
 * and where it stands: paid (nothing owed, or the supplier owes the shop),
 * overdue (owed after its due day), part paid, or unpaid. Days are
 * "YYYY-MM-DD" in Phnom Penh.
 */
export function billPaymentState(bill: { total: number; returned: number; paid: number; dueOn: string | null }, today: string): { owed: number; state: PurchasePaymentState } {
  const owed = bill.total - bill.returned - bill.paid;
  if (owed <= 0) return { owed, state: "paid" };
  if (bill.dueOn && bill.dueOn < today) return { owed, state: "overdue" };
  return { owed, state: bill.paid > 0 ? "part" : "unpaid" };
}

/** Goods sent back to the supplier from one bill: which options, how many (never more than the bill brought in). */
export const purchaseReturnInputSchema = z
  .object({
    lines: z.array(z.object({ variantId: z.string().uuid("required"), quantity: quantitySchema })).min(1, "required").max(MAX_PURCHASE_LINES, "too_long"),
    note: z.string().trim().max(MAX_PURCHASE_NOTE_LENGTH, "too_long").default(""),
  })
  .superRefine((input, ctx) => eachOptionOnce(input.lines, ctx));
export type PurchaseReturnInput = z.infer<typeof purchaseReturnInputSchema>;

/** A bill counts in the BILL series, a return in RET (documents.ts). */
export const purchaseSeries = (kind: "purchase" | "return"): DocumentSeries => (kind === "return" ? "return" : "bill");

/**
 * A bill line's cost of one in its item's own cost currency (what goes into
 * the item's average): the line's own price when the currencies match or the
 * item has no cost currency yet; else turned once at the bill's rate,
 * rounded like a price (whole cents or riel). null: it needs turning and the
 * bill has no rate.
 */
export function itemCostOf(unitCost: number, billCurrency: Currency, itemCurrency: Currency | null, rate: number | null): { minor: number; currency: Currency } | null {
  if (itemCurrency === null || itemCurrency === billCurrency) return { minor: unitCost, currency: billCurrency };
  if (rate === null) return null;
  return { minor: unitCostIn({ costMinor: unitCost, costCurrency: billCurrency }, itemCurrency, rate) ?? unitCost, currency: itemCurrency };
}

/** A bill's lines with their totals, and the bill's total: quantity × cost each, then the sum (whole cents or riel, never rounded). */
export function purchaseTotals<L extends { quantity: number; unitCost: number }>(lines: readonly L[]): { lines: (L & { lineTotal: number })[]; total: number } {
  const withTotals = lines.map((line) => ({ ...line, lineTotal: line.quantity * line.unitCost }));
  return { lines: withTotals, total: withTotals.reduce((sum, line) => sum + line.lineTotal, 0) };
}

/**
 * How much of each option a return may still send back from its bill: what
 * the bill brought in, less what earlier returns from it already sent back.
 */
export function returnableQuantities(bought: readonly { variantId: string; quantity: number }[], returned: readonly { variantId: string; quantity: number }[]): Map<string, number> {
  const left = new Map<string, number>();
  for (const line of bought) left.set(line.variantId, (left.get(line.variantId) ?? 0) + line.quantity);
  for (const line of returned) left.set(line.variantId, (left.get(line.variantId) ?? 0) - line.quantity);
  return left;
}

/**
 * The purchase list's date filter, by the day on the bill (Phnom Penh): today,
 * the last 7 or 30 days (today included), this or last calendar month, this
 * year. The payables report links to the list with the first three.
 */
export const PURCHASE_PERIODS = ["today", "week", "month", "this_month", "last_month", "this_year"] as const;
export type PurchasePeriod = (typeof PURCHASE_PERIODS)[number];

/** Whether a bill's goods arrived (stock went up): the list's "goods" filter and the payables report. */
export const GOODS_STATES = ["received", "not_received"] as const;
export type GoodsState = (typeof GOODS_STATES)[number];

/**
 * The list's payment filter: each standing, or "open" — unpaid or part paid,
 * not late yet (the Purchases page's "Unpaid" tile).
 */
export const PURCHASE_PAYMENT_FILTERS = [...PURCHASE_PAYMENT_STATES, "open"] as const;
/** The list's due filter: owed and falling due within DUE_SOON_DAYS (payables.ts). */
export const PURCHASE_DUE_FILTERS = ["due_soon"] as const;

/** The purchase list: newest first unless the seller picks another column; chips for bills, returns and bills not received yet; filters by supplier, currency, period, payment, whether the goods arrived, and what falls due soon. */
export const PURCHASE_LIST_SPEC = {
  sorts: ["date", "number", "supplier", "total"],
  chips: ["purchase", "return", "not_received"],
  filters: { supplier: ID_FILTER, currency: ["USD", "KHR"], period: PURCHASE_PERIODS, payment: PURCHASE_PAYMENT_FILTERS, goods: GOODS_STATES, due: PURCHASE_DUE_FILTERS },
  defaultSort: { key: "date", dir: "desc" },
} as const satisfies ListSpec;

/** How many days "week" and "month" read back, today included. */
const LAST_DAYS = { week: 7, month: 30 } as const;

/** The first and last day ("YYYY-MM-DD") of a period, for a given Phnom Penh day. */
export function purchasePeriodDays(period: PurchasePeriod, today: string): { from: string; to: string } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (period === "today") return { from: today, to: today };
  // 7 or 30 days, today the last of them.
  if (period === "week" || period === "month") return { from: addDays(today, -(LAST_DAYS[period] - 1)), to: today };
  if (period === "this_year") return { from: day(year, 1, 1), to: day(year, 12, 31) };
  const [y, m] = period === "this_month" ? [year, month] : month === 1 ? [year - 1, 12] : [year, month - 1];
  return { from: day(y, m, 1), to: day(y, m, lastDay(y, m)) };
}
