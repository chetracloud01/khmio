-- Cost price and profit (packages/shared profit.ts): what each product option
-- costs the shop, and the cost frozen on each order line when it's sold, so
-- editing a cost later never changes an old order's profit. Only added; every
-- existing option and line starts with no cost ("cost missing" in the report).
-- Like wholesale prices, cost is the seller's only: the API never sends it to
-- the shop page (apps/api products.ts toProductDto).
-- One amount in one currency (not dollars and riel side by side, like
-- prices): a cost is one fact, and the moving average planned for purchases
-- (docs/blueprint.md "Cost price", level 2) needs a single currency.

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "unit_cost_minor" INTEGER;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "cost_currency" "Currency",
ADD COLUMN     "cost_minor" INTEGER;

-- Added by hand: a cost is never negative, and an amount always has its currency (both or neither).
ALTER TABLE product_variants ADD CONSTRAINT product_variants_cost_not_negative
  CHECK (cost_minor IS NULL OR cost_minor >= 0);
ALTER TABLE product_variants ADD CONSTRAINT product_variants_cost_has_currency
  CHECK ((cost_minor IS NULL) = (cost_currency IS NULL));
ALTER TABLE order_items ADD CONSTRAINT order_items_unit_cost_not_negative
  CHECK (unit_cost_minor IS NULL OR unit_cost_minor >= 0);
