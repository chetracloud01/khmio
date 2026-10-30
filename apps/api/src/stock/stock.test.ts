import type { Currency } from "@khmio/shared";
import { describe, expect, it } from "vitest";
import { toStockPage, tracksStock } from "./stock";

const variant = (id: string, overrides: Partial<{ isDefault: boolean; labelEn: string; costMinor: number | null; costCurrency: Currency | null }> = {}) => ({
  id,
  sku: `SKU-${id}`,
  labelKm: "ធំ",
  labelEn: "Large",
  isDefault: false,
  costMinor: null,
  costCurrency: null,
  product: { id: "product-1", titleKm: "កាហ្វេ", titleEn: "Coffee", categoryId: "category-1", brandId: null },
  ...overrides,
});

describe("the Stock page", () => {
  it("follows stock on Pro and Advance only", () => {
    expect([tracksStock("free"), tracksStock("basic"), tracksStock("pro"), tracksStock("advance")]).toEqual([false, false, true, true]);
  });

  it("shows each option's count, null when it isn't tracked, and marks the low ones", () => {
    const page = toStockPage(
      [variant("v1"), variant("v2"), variant("v3"), variant("v4", { isDefault: true })],
      [
        { variantId: "v1", onHand: 12, reserved: 0, reorderMin: null, reorderMax: null },
        { variantId: "v2", onHand: 3, reserved: 0, reorderMin: null, reorderMax: null },
        { variantId: "v3", onHand: 0, reserved: 0, reorderMin: null, reorderMax: null },
      ],
      [],
      "pro",
    );
    expect(page.tracksStock).toBe(true);
    expect(page.items.map((item) => [item.onHand, item.low])).toEqual([
      [12, false],
      [3, true],
      [0, true],
      [null, false],
    ]);
    // A product without options has no option name.
    expect(page.items[3]?.optionEn).toBe("");
  });

  it("keeps the counts but locks writing on a lower plan", () => {
    const page = toStockPage([variant("v1")], [{ variantId: "v1", onHand: 5, reserved: 0, reorderMin: null, reorderMax: null }], [], "basic");
    expect(page.tracksStock).toBe(false);
    expect(page.items[0]?.onHand).toBe(5);
  });

  it("names the order a sale or return came from", () => {
    const at = new Date("2026-10-24T03:00:00Z");
    const page = toStockPage(
      [],
      [],
      [{ id: "m1", variantId: "v1", type: "sale", quantity: 2, reason: null, note: "", unitCostMinor: null, costCurrency: null, supplier: "", createdAt: at, order: { id: "o1", orderNumber: 41, channel: "in_store" }, purchase: null }],
      "pro",
    );
    expect(page.movements[0]).toMatchObject({ orderNumber: 41, inStore: true, createdAt: "2026-10-24T03:00:00.000Z", purchaseId: null });
  });

  it("names the bill a purchase came in on", () => {
    const at = new Date("2026-10-28T03:00:00Z");
    const page = toStockPage(
      [],
      [],
      [{ id: "m2", variantId: "v1", type: "purchase", quantity: 10, reason: null, note: "", unitCostMinor: 2000, costCurrency: "USD", supplier: "Chhay Auto", createdAt: at, order: null, purchase: { id: "p1", number: 7, currency: "KHR", exchangeRateUsed: 4100 } }],
      "pro",
    );
    expect(page.movements[0]).toMatchObject({ purchaseId: "p1", purchaseNumber: 7, orderId: null, supplier: "Chhay Auto", billCurrency: "KHR", billRate: 4100 });
  });

  it("says what the stock is worth, dollars and riel apart, and what has no cost yet", () => {
    const page = toStockPage(
      [variant("v1", { costMinor: 2300, costCurrency: "USD" }), variant("v2", { costMinor: 50000, costCurrency: "KHR" }), variant("v3"), variant("v4", { costMinor: 100, costCurrency: "USD" })],
      [
        { variantId: "v1", onHand: 4, reserved: 0, reorderMin: null, reorderMax: null },
        { variantId: "v2", onHand: 2, reserved: 0, reorderMin: null, reorderMax: null },
        { variantId: "v3", onHand: 5, reserved: 0, reorderMin: null, reorderMax: null },
      ],
      [],
      "pro",
    );
    // v4 isn't tracked: it's not on the shelf count.
    expect(page.value).toEqual({ USD: 9200, KHR: 100000, withoutCost: 1 });
    expect(page.items[0]).toMatchObject({ costMinor: 2300, costCurrency: "USD" });
  });

  it("marks what to reorder at each item's own minimum, with how many and where it was last bought", () => {
    const page = toStockPage(
      [variant("v1"), variant("v2"), variant("v3")],
      [
        { variantId: "v1", onHand: 3, reserved: 0, reorderMin: 3, reorderMax: 12 },
        { variantId: "v2", onHand: 4, reserved: 0, reorderMin: 3, reorderMax: null },
        { variantId: "v3", onHand: 6, reserved: 2, reorderMin: null, reorderMax: null },
      ],
      [],
      "pro",
      [{ variantId: "v1", supplierId: "s1", supplierName: "Chhay Auto", unitCostMinor: 2600 }],
    );
    const [first, second, third] = page.items;
    expect(first).toMatchObject({ low: true, suggested: 9, lastSupplierName: "Chhay Auto", lastCostMinor: 2600 });
    expect(second).toMatchObject({ low: false, suggested: null, lastSupplierId: null });
    // 6 on hand, 2 held for unpaid orders: 4 free is under the shop's rule (5); order up to 10.
    expect(third).toMatchObject({ low: true, suggested: 6 });
  });
});
