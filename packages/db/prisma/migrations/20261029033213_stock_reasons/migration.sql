-- More reasons a stock count changes (docs/blueprint.md "Stock"; design/screens.md
-- S13 "Change stock"): went down — expired, used in the shop, given away; went
-- up — free goods from a supplier; and the opening stock an item starts from
-- (no bill). Existing movements keep their reasons. Only added: going back one
-- version still works (it never writes the new ones). PostgreSQL 12+ adds several
-- values in one migration; a new value can't be used in the step that adds it,
-- so the rule that lets opening stock carry a cost is the next migration.

ALTER TYPE "StockAdjustmentReason" ADD VALUE 'expired';
ALTER TYPE "StockAdjustmentReason" ADD VALUE 'own_use';
ALTER TYPE "StockAdjustmentReason" ADD VALUE 'given_away';
ALTER TYPE "StockAdjustmentReason" ADD VALUE 'free_goods';
ALTER TYPE "StockAdjustmentReason" ADD VALUE 'opening_stock';
