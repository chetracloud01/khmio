import { describe, expect, it } from "vitest";
import { toFieldErrors } from "./form-errors";
import { productInputSchema, type ProductFormInput } from "./product";

const product = (overrides: Partial<ProductFormInput>): ProductFormInput => ({ titleKm: "កាហ្វេ", titleEn: "Coffee", categoryId: "category-1", retailPriceUsdCents: 250, ...overrides });
const option = (id: string, costMinor?: number) => ({ id, sku: "", labelKm: id, labelEn: id, retailPriceUsdCents: 250, costMinor });
const errorsOf = (input: ProductFormInput) => {
  const result = productInputSchema.safeParse(input);
  return result.success ? {} : toFieldErrors(result.error);
};

describe("a product's cost price (docs/blueprint.md \"Cost price\")", () => {
  it("is optional: no cost, no currency needed", () => {
    expect(errorsOf(product({}))).toEqual({});
  });

  it("takes one amount with its currency", () => {
    expect(errorsOf(product({ costMinor: 120, costCurrency: "USD" }))).toEqual({});
    expect(errorsOf(product({ costMinor: 5000, costCurrency: "KHR" }))).toEqual({});
  });

  it("refuses an amount without its currency", () => {
    expect(errorsOf(product({ costMinor: 120 }))).toEqual({ costCurrency: "required" });
  });

  it("needs the currency once any option has a cost", () => {
    expect(errorsOf(product({ options: [option("S"), option("M", 300)] }))).toEqual({ costCurrency: "required" });
    expect(errorsOf(product({ costCurrency: "KHR", options: [option("S"), option("M", 300)] }))).toEqual({});
  });

  it("refuses a cost below zero", () => {
    expect(errorsOf(product({ costMinor: -1, costCurrency: "USD" }))).toEqual({ costMinor: "price_invalid" });
  });
});
