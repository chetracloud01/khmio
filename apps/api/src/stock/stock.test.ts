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
  product: { id: "product-1", titleKm: "កាហ្វេ", titleEn: "Coffee" },
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
        { variantId: "v1", onHand: 12, reserved: 0 },
        { variantId: "v2", onHand: 3, reserved: 0 },
        { variantId: "v3", onHand: 0, reserved: 0 },
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
    const page = toStockPage([variant("v1")], [{ variantId: "v1", onHand: 5, reserved: 0 }], [], "basic");
    expect(page.tracksStock).toBe(false);
    expect(page.items[0]?.onHand).toBe(5);
  });

  it("names the order a sale or return came from", () => {
    const at = new Date("2026-10-24T03:00:00Z");
    const page = toStockPage(
      [],
      [],
      [{ id: "m1", variantId: "v1", type: "sale", quantity: 2, reason: null, note: "", unitCostMinor: null, costCurrency: null, supplier: "", createdAt: at, order: { id: "o1", orderNumber: 41, channel: "in_store" } }],
      "pro",
    );
    expect(page.movements[0]).toMatchObject({ orderNumber: 41, inStore: true, createdAt: "2026-10-24T03:00:00.000Z" });
  });

  it("says what the stock is worth, dollars and riel apart, and what has no cost yet", () => {
    const page = toStockPage(
      [variant("v1", { costMinor: 2300, costCurrency: "USD" }), variant("v2", { costMinor: 50000, costCurrency: "KHR" }), variant("v3"), variant("v4", { costMinor: 100, costCurrency: "USD" })],
      [
        { variantId: "v1", onHand: 4, reserved: 0 },
        { variantId: "v2", onHand: 2, reserved: 0 },
        { variantId: "v3", onHand: 5, reserved: 0 },
      ],
      [],
      "pro",
    );
    // v4 isn't tracked: it's not on the shelf count.
    expect(page.value).toEqual({ USD: 9200, KHR: 100000, withoutCost: 1 });
    expect(page.items[0]).toMatchObject({ costMinor: 2300, costCurrency: "USD" });
  });
});
