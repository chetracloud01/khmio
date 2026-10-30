-- Reorder levels (docs/blueprint.md "Cost price", suppliers and bills): the
-- minimum/maximum rule of Odoo and ERPNext, per item at the main branch. An
-- item is to reorder when what's free is at or below its minimum; the
-- suggested order brings it up to its maximum. Both start empty, which keeps
-- today's rule (low at 5) for every item until the seller sets a level. Only
-- added: going back one version ignores the two columns.

-- AlterTable
ALTER TABLE "stock_levels" ADD COLUMN     "reorder_max" INTEGER,
ADD COLUMN     "reorder_min" INTEGER;

-- ── Added by hand (Prisma can't express these) ─────────────────────────────

-- Never below zero; a maximum needs a minimum and is never below it.
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_reorder_min_check" CHECK ("reorder_min" IS NULL OR "reorder_min" >= 0);
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_reorder_max_check"
  CHECK ("reorder_max" IS NULL OR ("reorder_min" IS NOT NULL AND "reorder_max" >= "reorder_min"));
