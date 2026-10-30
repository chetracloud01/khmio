import { describe, expect, it } from "vitest";
import type { PayablesSupplierRow, Supplier } from "@/lib/api";
import { inTile, standingOf, SUPPLIER_TILES, supplierStandings, supplierTileFigures, supplierTileOf, supplierTileSearch } from "./supplier-tiles";

const supplier = (id: string, overrides: Partial<Supplier> = {}): Supplier => ({
  id,
  name: id,
  phone: "",
  note: "",
  archived: false,
  purchaseCount: 1,
  owed: { USD: 0, KHR: 0 },
  bought: { USD: 1000, KHR: 0 },
  lastBillOn: null,
  ...overrides,
});
const cell = (count: number) => ({ count, bought: 0, owed: 0 });
const row = (supplierId: string | null, currency: "USD" | "KHR", overdue: number, notReceived: number): PayablesSupplierRow => ({
  key: `${supplierId}:${currency}`,
  supplierId,
  supplierName: "",
  currency,
  billCount: 1,
  bought: 0,
  returned: 0,
  paid: 0,
  owed: 0,
  overdue,
  dueSoon: 0,
  dueSoonCount: 0,
  notReceived: cell(notReceived),
});

describe("the Suppliers page's tiles", () => {
  const standings = supplierStandings({ suppliers: [row("a", "USD", 21400, 0), row("a", "KHR", 40000, 1), row("b", "USD", 0, 2), row(null, "USD", 999, 5)] });
  const suppliers = [
    supplier("a", { owed: { USD: 52400, KHR: 40000 } }),
    supplier("b", { owed: { USD: 1350, KHR: 0 }, bought: { USD: 5000, KHR: 0 } }),
    supplier("c", { bought: { USD: 121800, KHR: 540000 } }),
    supplier("d", { archived: true, bought: { USD: 300, KHR: 0 } }),
  ];

  it("join each supplier with the report: overdue in each currency, bills not received; a bill with no supplier left out", () => {
    expect(standingOf(standings, { id: "a" })).toEqual({ overdue: { USD: 21400, KHR: 40000 }, notReceived: 1 });
    expect(standingOf(standings, { id: "c" })).toEqual({ overdue: { USD: 0, KHR: 0 }, notReceived: 0 });
  });

  it("group suppliers: overdue is also owed; settled is in use and owes nothing; archived apart", () => {
    const a = suppliers[0]!;
    expect(SUPPLIER_TILES.filter((tile) => inTile(tile, a, standingOf(standings, a)))).toEqual(["overdue", "owed", "waiting"]);
    expect(inTile("settled", suppliers[3]!, standingOf(standings, suppliers[3]!))).toBe(false);
    expect(inTile("archived", suppliers[3]!, standingOf(standings, suppliers[3]!))).toBe(true);
  });

  it("count suppliers and add their amounts, dollars and riel apart", () => {
    const figures = supplierTileFigures(suppliers, standings);
    expect(figures.overdue).toEqual({ count: 1, amount: { USD: 21400, KHR: 40000 }, bills: 0 });
    expect(figures.owed).toEqual({ count: 2, amount: { USD: 53750, KHR: 40000 }, bills: 0 });
    expect(figures.waiting).toMatchObject({ count: 2, bills: 3 });
    expect(figures.settled).toEqual({ count: 1, amount: { USD: 121800, KHR: 540000 }, bills: 0 });
    expect(figures.archived.count).toBe(1);
  });

  it("follow the list's chip and write its address", () => {
    expect(supplierTileOf("waiting")).toBe("waiting");
    expect(supplierTileOf("live")).toBeNull();
    expect(supplierTileSearch("tab=owed&q=angkor", "overdue")).toBe("tab=overdue");
  });
});
