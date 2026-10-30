import { describe, expect, it } from "vitest";
import { leftAfterEach, voucherFigures } from "./bill-left";

const payment = (id: string, amountMinor: number, voided = false) => ({ id, number: 1, paidOn: "2026-10-29", amountMinor, method: "cash" as const, note: "", createdAt: "", voided });

describe("what's left after each payment", () => {
  it("counts down from the total less returns, part payment by part payment", () => {
    const left = leftAfterEach({ totalMinor: 10000, payment: { paid: 7000, returned: 1000, owed: 2000, state: "part" }, payments: [payment("a", 4000), payment("b", 3000)] });
    expect([...left]).toEqual([
      ["a", 5000],
      ["b", 2000],
    ]);
  });

  it("skips a voided payment: it lowers nothing and shows nothing", () => {
    const left = leftAfterEach({ totalMinor: 10000, payment: { paid: 10000, returned: 0, owed: 0, state: "paid" }, payments: [payment("a", 6000, true), payment("b", 10000)] });
    expect(left.has("a")).toBe(false);
    expect(left.get("b")).toBe(0);
  });
});

describe("a payment voucher's figures", () => {
  const bill = { totalMinor: 10000, payment: { paid: 7000, returned: 1000, owed: 2000, state: "part" as const }, payments: [payment("a", 4000), payment("x", 500, true), payment("b", 3000)] };

  it("shows the bill after returns, what was paid before, this payment and what's left", () => {
    expect(voucherFigures(bill, "b")).toEqual({ billDue: 9000, paidBefore: 4000, amount: 3000, leftAfter: 2000, voided: false });
    expect(voucherFigures(bill, "a")).toEqual({ billDue: 9000, paidBefore: 0, amount: 4000, leftAfter: 5000, voided: false });
  });

  it("a voided payment settled nothing: no balance after, and it never counts as paid before", () => {
    expect(voucherFigures(bill, "x")).toEqual({ billDue: 9000, paidBefore: 4000, amount: 500, leftAfter: null, voided: true });
  });

  it("is nothing for a payment that isn't the bill's", () => {
    expect(voucherFigures(bill, "nope")).toBeNull();
  });
});
