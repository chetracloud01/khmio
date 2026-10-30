-- Purchases with their cost ("Cost price", level 2, docs/blueprint.md): stock
-- arriving from a supplier keeps what one cost and who it came from, and moves
-- the product option's average cost (apps/api stock.ts, packages/shared
-- profit.ts movingAverageCost). Only added: every existing movement starts
-- with no cost and no supplier, so going back one version still works.

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "cost_currency" "Currency",
ADD COLUMN     "supplier" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "unit_cost_minor" INTEGER;

-- Added by hand: a cost is never negative, always has its currency (both or
-- neither), and belongs to a purchase only — sales freeze their cost on the
-- order line, corrections and returns move no cost.
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_cost_not_negative
  CHECK (unit_cost_minor IS NULL OR unit_cost_minor >= 0);
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_cost_has_currency
  CHECK ((unit_cost_minor IS NULL) = (cost_currency IS NULL));
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_cost_on_purchase_only
  CHECK (unit_cost_minor IS NULL OR type = 'purchase');
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_supplier_length
  CHECK (length(supplier) <= 80);
