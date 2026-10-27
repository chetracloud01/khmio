import { describe, expect, it } from "vitest";
import type { Product, ProductVariant } from "./api";
import { discounted, priceText, startingVariant } from "./product-price";

const variant = (id: string, priceUsdCents: number | null, priceKhr: number | null): ProductVariant => ({
  id,
  sku: id.toUpperCase(),
  labelKm: id,
  labelEn: id,
  valueIds: [],
  priceUsdCents,
  priceKhr,
});

const product = (variants: ProductVariant[], discountPercent: number | null = null): Product => ({
  id: "p",
  titleKm: "ទំនិញ",
  titleEn: "Item",
  descriptionKm: "",
  descriptionEn: "",
  categoryId: "c",
  brandId: null,
  unitId: null,
  discountPercent,
  isVisible: true,
  photos: [],
  hasOptions: variants.length > 1,
  variants,
  variantGroups: [],
  choiceGroups: [],
  customValues: {},
  kind: "item",
});

describe("discounted", () => {
  it("takes the discount off and rounds to a whole cent or riel", () => {
    expect(discounted(850, 10)).toBe(765);
    expect(discounted(125, 10)).toBe(113);
    expect(discounted(34850, 15)).toBe(29623);
  });

  it("leaves the price alone without a discount", () => {
    expect(discounted(850, null)).toBe(850);
    expect(discounted(850, 0)).toBe(850);
  });
});

describe("startingVariant", () => {
  it("picks the cheapest option, comparing a riel-only price at the store's rate", () => {
    const small = variant("small", 200, null);
    const large = variant("large", null, 7000); // $1.71 at 4100
    expect(startingVariant(product([small, large]), 4100)?.id).toBe("large");
    expect(startingVariant(product([small, large]), 3000)?.id).toBe("small"); // 7000៛ = $2.33
  });

  it("is the only variant of a product without options", () => {
    expect(startingVariant(product([variant("default", 850, null)]), 4100)?.id).toBe("default");
  });
});

describe("priceText", () => {
  it("shows every currency the seller set, after the discount", () => {
    expect(priceText(variant("v", 850, 34850), null)).toBe("$8.50 · 34,850៛");
    expect(priceText(variant("v", null, 5000), 10)).toBe("4,500៛");
  });

  it("can show the price before the discount", () => {
    expect(priceText(variant("v", 850, null), 10, true)).toBe("$8.50");
  });

  it("shows a dash when there is nothing to show", () => {
    expect(priceText(undefined, null)).toBe("—");
  });
});
