import { describe, expect, it } from "vitest";
import { purchaseSearchWhere, toListedPurchase } from "./purchase-list";
import { owedTotals, type BillBalance } from "./bill-balances";
import { toSupplier, toSupplierStats } from "./suppliers";

const balance = (overrides: Partial<BillBalance>): BillBalance => ({ id: "p1", supplierId: "s1", currency: "USD", purchasedOn: "2026-10-20", received: true, total: 20375, returned: 0, paid: 0, dueOn: null, owed: 20375, state: "unpaid", ...overrides });

describe("the purchase list", () => {
  it("shows the bill's day as written, who it came from, and what it still owes", () => {
    const row = {
      id: "p1",
      number: 7,
      kind: "purchase" as const,
      billRef: "INV-7",
      purchasedOn: new Date("2026-10-28T00:00:00Z"),
      dueOn: new Date("2026-11-28T00:00:00Z"),
      receivedAt: null,
      currency: "USD" as const,
      totalMinor: 20375,
      supplier: { id: "s1", name: "Angkor Parts" },
      returns: null,
      _count: { lines: 2 },
    };
    expect(toListedPurchase(row, balance({ paid: 5000, owed: 15375, state: "part" }))).toMatchObject({
      purchasedOn: "2026-10-28",
      dueOn: "2026-11-28",
      supplierName: "Angkor Parts",
      returnsNumber: null,
      lineCount: 2,
      payment: { paid: 5000, owed: 15375, state: "part" },
      receivedAt: null,
    });
    // A return pays nothing itself: what it sends back lowers its bill's.
    expect(toListedPurchase({ ...row, kind: "return" }, undefined).payment).toBeNull();
  });

  it("adds up what the shop owes, each currency apart, never netting off what a supplier owes back", () => {
    expect(owedTotals([balance({ owed: 15375 }), balance({ id: "p2", currency: "KHR", owed: 80000 }), balance({ id: "p3", owed: -14500, state: "paid" })])).toEqual({ USD: 15375, KHR: 80000 });
  });

  it("searches the supplier, their bill number, and our number", () => {
    expect(purchaseSearchWhere("  ")).toBeNull();
    expect(purchaseSearchWhere("#12")?.OR).toContainEqual({ number: 12 });
    expect(purchaseSearchWhere("BILL-0012")?.OR).toContainEqual({ number: 12, kind: "purchase" });
    expect(purchaseSearchWhere("ret 3")?.OR).toContainEqual({ number: 3, kind: "return" });
    expect(purchaseSearchWhere("PAY-1")?.OR).toHaveLength(2);
    expect(purchaseSearchWhere("angkor")?.OR).toHaveLength(2);
  });
});

describe("a supplier", () => {
  it("says whether it's archived and how many bills it has", () => {
    expect(toSupplier({ id: "s1", name: "Angkor Parts", phone: "", note: "", archivedAt: new Date(), _count: { purchases: 3 } })).toEqual({ id: "s1", name: "Angkor Parts", phone: "", note: "", archived: true, purchaseCount: 3, bought: { USD: 0, KHR: 0 }, owed: { USD: 0, KHR: 0 }, lastBillOn: null });
  });

  it("adds up what was bought: bills less returns, each currency apart, and the last bill's day", () => {
    const stats = toSupplierStats([
      { supplierId: "s1", kind: "purchase", currency: "USD", _sum: { totalMinor: 59500 }, _max: { purchasedOn: new Date("2026-10-28T00:00:00Z") } },
      { supplierId: "s1", kind: "return", currency: "USD", _sum: { totalMinor: 14500 }, _max: { purchasedOn: new Date("2026-10-29T00:00:00Z") } },
      { supplierId: "s1", kind: "purchase", currency: "KHR", _sum: { totalMinor: 80000 }, _max: { purchasedOn: new Date("2026-09-02T00:00:00Z") } },
      { supplierId: null, kind: "purchase", currency: "USD", _sum: { totalMinor: 100 }, _max: { purchasedOn: null } },
    ]);
    expect(stats.get("s1")).toEqual({ bought: { USD: 45000, KHR: 80000 }, owed: { USD: 0, KHR: 0 }, lastBillOn: "2026-10-28" });
    expect(stats.size).toBe(1);
  });
});
