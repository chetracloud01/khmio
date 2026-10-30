-- Opening stock with its cost (docs/blueprint.md "Stock"; design/screens.md S13
-- "Set opening stock"): a shop starting out enters what's on the shelf and what
-- one cost, with no bill. Until now only a purchase movement could carry a
-- cost; an opening-stock movement may now too (its cost starts the item's
-- average). Every existing row already meets the new rule. Going back one
-- version still works: the old code never writes an opening-stock movement.

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_cost_on_purchase_only;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_cost_on_purchase_or_opening
  CHECK (unit_cost_minor IS NULL OR type = 'purchase' OR (type = 'adjust_in' AND reason = 'opening_stock'));
