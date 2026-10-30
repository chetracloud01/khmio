-- Stock counts (design/screens.md S13 "Count stock"; the ERP physical
-- inventory). A count is a numbered document (CNT-0001, from the shop's
-- document counter) of what's on the shelf, over every item or chosen
-- categories. Each item counted is a line keeping what the app had for it the
-- moment it was typed; a draft is left and continued on any device. Applied
-- once, each item's correction (counted − expected then) goes onto today's
-- stock as a count_correction movement linked to the count, and each line's
-- cost is fixed so the count's value never changes after; or cancelled, and
-- nothing moves. Counts are never deleted; at most one draft per shop. Only
-- added: going back one version still works (the old code never reads these
-- tables; the new movement column is empty). No data to fill in.

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('draft', 'applied', 'cancelled');

-- AlterEnum
ALTER TYPE "DocumentSeries" ADD VALUE 'count';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "stock_count_id" UUID;

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'draft',
    "location_id" UUID NOT NULL,
    "category_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "note" TEXT NOT NULL DEFAULT '',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_by_id" UUID,
    "applied_at" TIMESTAMPTZ(6),
    "applied_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_id" UUID,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "count_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "counted" INTEGER NOT NULL,
    "expected_on_hand" INTEGER,
    "counted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cost_minor" INTEGER,
    "cost_currency" "Currency",

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("count_id","variant_id")
);

-- CreateIndex
CREATE INDEX "stock_counts_store_id_started_at_idx" ON "stock_counts"("store_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_store_id_number_key" ON "stock_counts"("store_id", "number");

-- CreateIndex
CREATE INDEX "stock_count_lines_store_id_idx" ON "stock_count_lines"("store_id");

-- CreateIndex
CREATE INDEX "stock_movements_stock_count_id_idx" ON "stock_movements"("stock_count_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "stock_counts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_applied_by_id_fkey" FOREIGN KEY ("applied_by_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Added by hand (Prisma can't express these) ─────────────────────────────

-- A count always says what it covers: an empty list is every item, never "unknown".
ALTER TABLE "stock_counts" ALTER COLUMN "category_ids" SET NOT NULL;

-- Each shop sees and writes only its own counts and lines (same policy as every shop table).
ALTER TABLE "stock_counts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "stock_counts"
  USING ("store_id" = app_current_store()) WITH CHECK ("store_id" = app_current_store());
ALTER TABLE "stock_count_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "stock_count_lines"
  USING ("store_id" = app_current_store()) WITH CHECK ("store_id" = app_current_store());

-- A count is history: never deleted, and only its status and who/when applied or cancelled ever change.
REVOKE UPDATE, DELETE ON "stock_counts" FROM khmer_micro_store_app;
GRANT UPDATE ("status", "applied_at", "applied_by_id", "cancelled_at", "cancelled_by_id") ON "stock_counts" TO khmer_micro_store_app;

-- At most one draft per shop: opening Count always continues it.
CREATE UNIQUE INDEX "stock_counts_one_draft" ON "stock_counts" ("store_id") WHERE "status" = 'draft';

ALTER TABLE "stock_counts"
  ADD CONSTRAINT "stock_counts_number_positive" CHECK ("number" > 0),
  ADD CONSTRAINT "stock_counts_note_length" CHECK (length("note") <= 200),
  ADD CONSTRAINT "stock_counts_category_count" CHECK (coalesce(array_length("category_ids", 1), 0) <= 50),
  -- Applied has its time, cancelled has its time, a draft has neither.
  ADD CONSTRAINT "stock_counts_applied_when" CHECK (("status" = 'applied') = ("applied_at" IS NOT NULL)),
  ADD CONSTRAINT "stock_counts_cancelled_when" CHECK (("status" = 'cancelled') = ("cancelled_at" IS NOT NULL));

ALTER TABLE "stock_count_lines"
  ADD CONSTRAINT "stock_count_lines_counted_not_negative" CHECK ("counted" >= 0),
  ADD CONSTRAINT "stock_count_lines_expected_not_negative" CHECK ("expected_on_hand" IS NULL OR "expected_on_hand" >= 0),
  ADD CONSTRAINT "stock_count_lines_cost_not_negative" CHECK ("cost_minor" IS NULL OR "cost_minor" >= 0),
  ADD CONSTRAINT "stock_count_lines_cost_currency" CHECK (("cost_minor" IS NULL) = ("cost_currency" IS NULL));

-- A count is applied or cancelled once, from a draft, and never changes again.
CREATE FUNCTION app_stock_count_once() RETURNS trigger
  LANGUAGE plpgsql AS $$
  BEGIN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'stock count already %', OLD.status; END IF;
    IF NEW.status = 'draft' THEN RAISE EXCEPTION 'a draft count is only applied or cancelled'; END IF;
    RETURN NEW;
  END $$;
CREATE TRIGGER stock_counts_once BEFORE UPDATE ON "stock_counts"
  FOR EACH ROW EXECUTE FUNCTION app_stock_count_once();

-- A count's lines change only while it's a draft, and only for the shop's own count
-- (another shop's count is hidden by its policy, so it isn't found).
CREATE FUNCTION app_stock_count_line_draft() RETURNS trigger
  LANGUAGE plpgsql AS $$
  DECLARE
    line_count UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.count_id ELSE NEW.count_id END;
    line_store UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.store_id ELSE NEW.store_id END;
    count_status "StockCountStatus";
  BEGIN
    -- Only the app is held to it: the owner deleting a whole shop (its counts go with it) is not.
    IF current_user <> 'khmer_micro_store_app' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
    SELECT status INTO count_status FROM stock_counts WHERE id = line_count AND store_id = line_store;
    IF count_status IS NULL THEN RAISE EXCEPTION 'no such stock count'; END IF;
    -- Fixing the costs as it's applied happens just before the status changes, while it's still a draft.
    IF count_status <> 'draft' THEN RAISE EXCEPTION 'stock count already %', count_status; END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END $$;
CREATE TRIGGER stock_count_lines_draft BEFORE INSERT OR UPDATE OR DELETE ON "stock_count_lines"
  FOR EACH ROW EXECUTE FUNCTION app_stock_count_line_draft();

-- A movement linked to a count is that count's correction.
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_count_kind" CHECK ("stock_count_id" IS NULL OR "reason" = 'count_correction');
