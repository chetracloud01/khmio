import { describe, expect, it } from "vitest";
import { toFieldErrors } from "./form-errors";
import { listQueryFromParams, listQuerySchemaFor } from "./list-query";
import { billPaymentState, itemCostOf, MAX_PURCHASE_LINES, PURCHASE_LIST_SPEC, purchaseInputSchema, purchasePaymentInputSchema, purchasePeriodDays, purchaseReturnInputSchema, purchaseTotals, returnableQuantities, supplierInputSchema } from "./purchases";

const purchaseListQuery = (params: Record<string, string>) => listQuerySchemaFor(PURCHASE_LIST_SPEC).safeParse(listQueryFromParams(params));

const id = (n: number) => `0b9f3c3e-1d2a-4c1f-9a51-${String(n).padStart(12, "0")}`;
const bill = (lines: unknown[], extra: Record<string, unknown> = {}) => purchaseInputSchema.safeParse({ purchasedOn: "2026-10-28", currency: "USD", lines, ...extra });

describe("a supplier bill", () => {
  it("takes many lines in one currency, with a day and an optional supplier", () => {
    const parsed = bill([{ variantId: id(1), quantity: 10, unitCost: 2000 }, { variantId: id(2), quantity: 4, unitCost: 0 }], { supplierId: id(9), billRef: " INV-7 " });
    expect(parsed.success && parsed.data.billRef).toBe("INV-7");
  });

  it("refuses the same option twice, no lines, too many lines", () => {
    const twice = bill([{ variantId: id(1), quantity: 1, unitCost: 1 }, { variantId: id(1), quantity: 2, unitCost: 1 }]);
    expect(twice.success ? {} : toFieldErrors(twice.error)).toEqual({ "lines.1.variantId": "option_duplicate" });
    expect(bill([]).success).toBe(false);
    expect(bill(Array.from({ length: MAX_PURCHASE_LINES + 1 }, (_, n) => ({ variantId: id(n + 1), quantity: 1, unitCost: 1 }))).success).toBe(false);
  });

  it("refuses a day that isn't one, a zero quantity, a cost with a fraction", () => {
    expect(bill([{ variantId: id(1), quantity: 1, unitCost: 1 }], { purchasedOn: "2026-13-40" }).success).toBe(false);
    expect(bill([{ variantId: id(1), quantity: 0, unitCost: 1 }]).success).toBe(false);
    expect(bill([{ variantId: id(1), quantity: 1, unitCost: 1.5 }]).success).toBe(false);
  });

  it("adds up quantity × cost per line, then the lines", () => {
    const totals = purchaseTotals([{ quantity: 10, unitCost: 2000 }, { quantity: 3, unitCost: 125 }]);
    expect(totals.lines.map((line) => line.lineTotal)).toEqual([20000, 375]);
    expect(totals.total).toBe(20375);
  });
});

describe("a return to the supplier", () => {
  it("may send back what the bill brought in, less earlier returns", () => {
    const left = returnableQuantities([{ variantId: id(1), quantity: 10 }, { variantId: id(2), quantity: 4 }], [{ variantId: id(1), quantity: 3 }, { variantId: id(1), quantity: 2 }]);
    expect(left.get(id(1))).toBe(5);
    expect(left.get(id(2))).toBe(4);
    expect(left.get(id(3))).toBeUndefined();
  });

  it("names each option once", () => {
    const twice = purchaseReturnInputSchema.safeParse({ lines: [{ variantId: id(1), quantity: 1 }, { variantId: id(1), quantity: 1 }] });
    expect(twice.success ? {} : toFieldErrors(twice.error)).toEqual({ "lines.1.variantId": "option_duplicate" });
  });
});

describe("a supplier", () => {
  it("needs a name; a phone is saved as 855…", () => {
    expect(supplierInputSchema.safeParse({ name: " ", phone: "" }).success).toBe(false);
    const parsed = supplierInputSchema.safeParse({ name: "Angkor Parts", phone: "012 345 678" });
    expect(parsed.success && parsed.data.phone).toBe("85512345678");
  });
});

describe("a supplier without a phone", () => {
  it("is saved with none", () => {
    const parsed = supplierInputSchema.safeParse({ name: "Angkor Parts" });
    expect(parsed.success && parsed.data.phone).toBe("");
  });
});

describe("the purchase list's periods", () => {
  it("covers this month, last month (across a new year) and this year", () => {
    expect(purchasePeriodDays("this_month", "2026-02-14")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(purchasePeriodDays("last_month", "2026-01-05")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(purchasePeriodDays("this_year", "2026-10-28")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(purchasePeriodDays("today", "2026-10-28")).toEqual({ from: "2026-10-28", to: "2026-10-28" });
    expect(purchasePeriodDays("week", "2026-10-28")).toEqual({ from: "2026-10-22", to: "2026-10-28" });
    expect(purchasePeriodDays("month", "2026-03-01")).toEqual({ from: "2026-01-31", to: "2026-03-01" });
  });

  it("filters by a supplier's id, and nothing else", () => {
    expect(purchaseListQuery({ "f.supplier": "0b9f3c3e-1d2a-4c1f-9a51-000000000001" }).success).toBe(true);
    expect(purchaseListQuery({ "f.supplier": "drop table" }).success).toBe(false);
    expect(purchaseListQuery({ "f.period": "forever" }).success).toBe(false);
  });
});

describe("paying a bill", () => {
  const today = "2026-10-28";
  it("owes the total less returns less payments, and says where it stands", () => {
    expect(billPaymentState({ total: 59500, returned: 14500, paid: 0, dueOn: null }, today)).toEqual({ owed: 45000, state: "unpaid" });
    expect(billPaymentState({ total: 59500, returned: 14500, paid: 20000, dueOn: "2026-11-30" }, today)).toEqual({ owed: 25000, state: "part" });
    expect(billPaymentState({ total: 59500, returned: 0, paid: 0, dueOn: "2026-10-27" }, today)).toEqual({ owed: 59500, state: "overdue" });
    expect(billPaymentState({ total: 59500, returned: 0, paid: 0, dueOn: today }, today).state).toBe("unpaid");
    // Paid in full, then goods went back: the supplier owes the shop, and the bill counts as paid.
    expect(billPaymentState({ total: 59500, returned: 14500, paid: 59500, dueOn: null }, today)).toEqual({ owed: -14500, state: "paid" });
  });

  it("is paid now or due on a day on or after the bill's, never both", () => {
    const line = [{ variantId: id(1), quantity: 1, unitCost: 100 }];
    expect(bill(line, { payment: { method: "cash" } }).success).toBe(true);
    expect(bill(line, { dueOn: "2026-11-28" }).success).toBe(true);
    const both = bill(line, { payment: { method: "cash" }, dueOn: "2026-11-28" });
    expect(both.success ? {} : toFieldErrors(both.error)).toEqual({ dueOn: "date_invalid" });
    expect(bill(line, { dueOn: "2026-10-01" }).success).toBe(false);
  });

  it("takes an amount above zero, a day and a way it was paid", () => {
    expect(purchasePaymentInputSchema.safeParse({ amount: 20000, paidOn: today, method: "khqr" }).success).toBe(true);
    expect(purchasePaymentInputSchema.safeParse({ amount: 0, paidOn: today, method: "cash" }).success).toBe(false);
    expect(purchasePaymentInputSchema.safeParse({ amount: 100, paidOn: today, method: "cheque" }).success).toBe(false);
  });
});

describe("a bill line in the other currency", () => {
  it("keeps its price when the item's cost is in the bill's currency, or the item has none yet", () => {
    expect(itemCostOf(2_400, "USD", "USD", null)).toEqual({ minor: 2_400, currency: "USD" });
    expect(itemCostOf(100_000, "KHR", null, null)).toEqual({ minor: 100_000, currency: "KHR" });
  });

  it("is turned once into the item's currency at the bill's rate, rounded like a price", () => {
    // ៛100,000 at 4,100 = $24.390… → $24.39
    expect(itemCostOf(100_000, "KHR", "USD", 4_100)).toEqual({ minor: 2_439, currency: "USD" });
    // $24.39 at 4,100 = ៛99,999
    expect(itemCostOf(2_439, "USD", "KHR", 4_100)).toEqual({ minor: 99_999, currency: "KHR" });
  });

  it("can't be turned without a rate", () => {
    expect(itemCostOf(100_000, "KHR", "USD", null)).toBeNull();
  });
});

describe("a bill's and a payment's day", () => {
  const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  it("is never ahead of today", () => {
    const ahead = bill([{ variantId: id(1), quantity: 1, unitCost: 100 }], { purchasedOn: tomorrow });
    expect(ahead.success ? {} : toFieldErrors(ahead.error)).toEqual({ purchasedOn: "date_in_future" });
    expect(purchasePaymentInputSchema.safeParse({ amount: 100, paidOn: tomorrow, method: "cash" }).success).toBe(false);
  });

  it("may be due later, on credit", () => {
    expect(bill([{ variantId: id(1), quantity: 1, unitCost: 100 }], { dueOn: tomorrow }).success).toBe(true);
  });
});

describe("received or not yet", () => {
  it("is received unless the bill says the goods haven't arrived", () => {
    const line = [{ variantId: id(1), quantity: 1, unitCost: 100 }];
    const plain = bill(line);
    const waiting = bill(line, { received: false });
    expect(plain.success && plain.data.received).toBe(true);
    expect(waiting.success && waiting.data.received).toBe(false);
  });
});
