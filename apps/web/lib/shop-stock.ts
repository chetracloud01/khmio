import { getBuyerStockState, type BuyerStockState } from "@khmio/shared";
import type { PublicShop } from "./api";

// What a shop page says about stock (Pro and Advance shops; docs/blueprint.md
// "Stock"): the API sends free stock for each tracked option, and an option
// not in it sells without a limit.

export function variantStock(shop: Pick<PublicShop, "stock">, variantId: string): BuyerStockState {
  const free = shop.stock[variantId];
  return free === undefined ? { kind: "untracked" } : getBuyerStockState(true, free);
}

/** A product's tile: sold out only when every option is; a product without options shows its own note ("Only 3 left"). */
export function productStock(shop: Pick<PublicShop, "stock">, product: { hasOptions: boolean; variants: { id: string }[] }): { soldOut: boolean; single: BuyerStockState | null } {
  const states = product.variants.map((variant) => variantStock(shop, variant.id));
  return {
    soldOut: states.length > 0 && states.every((state) => state.kind === "sold_out"),
    single: product.hasOptions ? null : (states[0] ?? null),
  };
}
