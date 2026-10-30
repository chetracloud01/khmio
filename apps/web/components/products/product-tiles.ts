import type { Product } from "../../lib/api";

// The Products page's status tiles (design/screens.md S6): which products a
// tile counts and its list view shows — hidden from the shop, on discount,
// without a cost price (their profit can't be known), without a photo (buyers
// need one). Pure, so the rules are tested without a page.

export const PRODUCT_TILE_VIEWS = ["hidden", "discounted", "nocost", "nophoto"] as const;
export type ProductTileView = (typeof PRODUCT_TILE_VIEWS)[number];
export const isProductTileView = (chip: string): chip is ProductTileView => (PRODUCT_TILE_VIEWS as readonly string[]).includes(chip);

type ProductFacts = Pick<Product, "isVisible" | "discountPercent" | "photos"> & { variants: readonly Pick<Product["variants"][number], "costMinor">[] };

/** Whether a product is in a view: the tile's count and the list chip use the same rule. */
export const IN_VIEW: Record<ProductTileView, (product: ProductFacts) => boolean> = {
  hidden: (product) => !product.isVisible,
  discounted: (product) => !!product.discountPercent,
  // Any option without its cost: its sales show "cost missing" in the profit.
  nocost: (product) => product.variants.some((variant) => variant.costMinor === null || variant.costMinor === undefined),
  nophoto: (product) => product.photos.length === 0,
};

/** How many products in all, shown in the shop, and in each view. */
export function productTileFigures(products: readonly ProductFacts[]): Record<"all" | "shown" | ProductTileView, number> {
  const count = (rule: (product: ProductFacts) => boolean) => products.filter(rule).length;
  return {
    all: products.length,
    shown: count((product) => product.isVisible),
    hidden: count(IN_VIEW.hidden),
    discounted: count(IN_VIEW.discounted),
    nocost: count(IN_VIEW.nocost),
    nophoto: count(IN_VIEW.nophoto),
  };
}
