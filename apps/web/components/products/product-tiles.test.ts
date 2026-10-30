import { describe, expect, it } from "vitest";
import { IN_VIEW, isProductTileView, productTileFigures } from "./product-tiles";

const product = (over: Partial<Parameters<typeof productTileFigures>[0][number]> = {}) => ({ isVisible: true, discountPercent: null, photos: [{ key: "a.jpg", url: "https://x/a.jpg" }], variants: [{ costMinor: 100 }], ...over });

describe("the Products page's tiles", () => {
  it("counts every product, those shown, and each view", () => {
    const products = [product(), product({ isVisible: false }), product({ discountPercent: 10 }), product({ variants: [{ costMinor: 100 }, { costMinor: null }] }), product({ photos: [] })];
    expect(productTileFigures(products)).toEqual({ all: 5, shown: 4, hidden: 1, discounted: 1, nocost: 1, nophoto: 1 });
  });

  it("a product lacks a cost when any of its options does; a 0% discount isn't a discount", () => {
    expect(IN_VIEW.nocost(product({ variants: [{ costMinor: undefined }] }))).toBe(true);
    expect(IN_VIEW.nocost(product({ variants: [{ costMinor: 0 }] }))).toBe(false);
    expect(IN_VIEW.discounted(product({ discountPercent: 0 }))).toBe(false);
  });

  it("knows its views from anything else in the address", () => {
    expect([isProductTileView("nocost"), isProductTileView("all"), isProductTileView("category:x")]).toEqual([true, false, false]);
  });
});
