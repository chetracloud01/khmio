-- Suppliers and purchases (docs/blueprint.md "Cost price", level 2+;
-- design/screens.md S13): a purchase is one supplier bill with many lines,
-- received in one go — each line adds stock and moves its product's average
-- cost; a return sends goods back to the supplier and takes them out of
-- stock. Bills are never edited or deleted through the app: a mistake is
-- fixed with a return. Only added: no existing row changes, and going back
-- one version still works.

-- CreateEnum
CREATE TYPE "PurchaseKind" AS ENUM ('purchase', 'return');

-- AlterEnum
ALTER TYPE "StockAdjustmentReason" ADD VALUE 'supplier_return';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "purchase_id" UUID;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" "PurchaseKind" NOT NULL DEFAULT 'purchase',
    "returns_id" UUID,
    "supplier_id" UUID,
    "bill_ref" TEXT NOT NULL DEFAULT '',
    "purchased_on" DATE NOT NULL,
    "currency" "Currency" NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost_minor" INTEGER NOT NULL,
    "line_total_minor" INTEGER NOT NULL,

    CONSTRAINT "purchase_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_store_id_idx" ON "suppliers"("store_id");

-- CreateIndex
CREATE INDEX "purchases_store_id_purchased_on_idx" ON "purchases"("store_id", "purchased_on");

-- CreateIndex
CREATE INDEX "purchases_supplier_id_idx" ON "purchases"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_store_id_number_key" ON "purchases"("store_id", "number");

-- CreateIndex
CREATE INDEX "purchase_lines_purchase_id_idx" ON "purchase_lines"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_lines_variant_id_idx" ON "purchase_lines"("variant_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_returns_id_fkey" FOREIGN KEY ("returns_id") REFERENCES "purchases"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- =====================================================================
-- Added by hand.
-- =====================================================================

-- Each shop sees and writes only its own suppliers, bills and lines.
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON suppliers
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON purchases
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
ALTER TABLE purchase_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON purchase_lines
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());

-- A bill and its lines are history, like the stock movements: never edited or deleted through the app.
REVOKE UPDATE, DELETE ON purchases FROM khmer_micro_store_app;
REVOKE UPDATE, DELETE ON purchase_lines FROM khmer_micro_store_app;

-- A supplier's name is unique in the shop, whatever its case and spaces around it.
CREATE UNIQUE INDEX suppliers_store_name_key ON suppliers (store_id, lower(btrim(name)));
ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  ADD CONSTRAINT suppliers_phone_format CHECK (phone = '' OR phone ~ '^855[0-9]{8,9}$'),
  ADD CONSTRAINT suppliers_note_length CHECK (length(note) <= 200);

ALTER TABLE purchases
  ADD CONSTRAINT purchases_number_positive CHECK (number > 0),
  ADD CONSTRAINT purchases_total_not_negative CHECK (total_minor >= 0),
  ADD CONSTRAINT purchases_bill_ref_length CHECK (length(bill_ref) <= 40),
  ADD CONSTRAINT purchases_note_length CHECK (length(note) <= 200),
  -- A return always says which bill it sends goods back from; a purchase never does.
  ADD CONSTRAINT purchases_return_has_bill CHECK ((kind = 'return') = (returns_id IS NOT NULL));

ALTER TABLE purchase_lines
  ADD CONSTRAINT purchase_lines_quantity_positive CHECK (quantity > 0),
  ADD CONSTRAINT purchase_lines_cost_not_negative CHECK (unit_cost_minor >= 0),
  ADD CONSTRAINT purchase_lines_total_matches CHECK (line_total_minor = quantity * unit_cost_minor);

-- A movement linked to a bill is the bill's stock coming in (purchase) or going back (adjust_out).
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_purchase_kind CHECK (purchase_id IS NULL OR type IN ('purchase', 'adjust_out'));
CREATE INDEX stock_movements_purchase_id_idx ON stock_movements (purchase_id);
