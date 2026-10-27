import { describe, expect, it } from "vitest";
import { fitCartToShop } from "./cart";
import { productStock, variantStock } from "./shop-stock";

const product = (ids: string[], hasOptions = ids.length > 1) => ({ hasOptions, variants: ids.map((id) => ({ id })) });

describe("stock on the shop page", () => {
  const shop = { stock: { a: 0, b: 3, c: 20 }, products: [product(["a", "b"]), product(["c"]), product(["d"])] };

  it("reads each option: untracked, sold out, low or in stock", () => {
    expect(variantStock(shop, "d")).toEqual({ kind: "untracked" });
    expect(variantStock(shop, "a")).toEqual({ kind: "sold_out" });
    expect(variantStock(shop, "b")).toEqual({ kind: "low", available: 3 });
    expect(variantStock(shop, "c")).toEqual({ kind: "in_stock", available: 20 });
  });

  it("calls a product sold out only when every option is", () => {
    expect(productStock(shop, product(["a", "b"])).soldOut).toBe(false);
    expect(productStock(shop, product(["a"], false))).toEqual({ soldOut: true, single: { kind: "sold_out" } });
  });

  it("cuts the cart to what's left, drops sold out and gone options, and says when it did", () => {
    expect(fitCartToShop(shop, { a: 1, b: 5, c: 2, gone: 1 })).toEqual({ quantities: { b: 3, c: 2 }, changed: true });
    expect(fitCartToShop(shop, { b: 2, d: 9 })).toEqual({ quantities: { b: 2, d: 9 }, changed: false });
  });
});
