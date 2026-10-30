-- Paying supplier bills (docs/blueprint.md "Cost price", suppliers and
-- bills): a bill is paid now (most small shops pay on the spot) or bought on
-- credit with a day it's due; payments against it, in the bill's currency,
-- are numbered PAY-0001… per shop (document_counters). What's owed is the
-- bill's total less its returns less its payments. A payment is never edited
-- or deleted: one made by mistake is voided, once, and stays in the history.
-- Before this, nobody tracked unpaid bills, so every existing bill is filled
-- in as paid on its own day (below). Only added: going back one version
-- ignores the new table and column.

-- CreateEnum
CREATE TYPE "PurchasePaymentMethod" AS ENUM ('cash', 'bank', 'khqr', 'other');

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "due_on" DATE;

-- CreateTable
CREATE TABLE "purchase_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "paid_on" DATE NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "method" "PurchasePaymentMethod" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(6),
    "voided_by_id" UUID,

    CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_payments_purchase_id_idx" ON "purchase_payments"("purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_payments_store_id_number_key" ON "purchase_payments"("store_id", "number");

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Added by hand (Prisma can't express these) ─────────────────────────────

-- A payment is money paid: above zero, a short note, a number from 1; a bill is due on or after its own day.
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_amount_check" CHECK ("amount_minor" > 0);
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_number_check" CHECK ("number" > 0);
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_note_check" CHECK (length("note") <= 200);
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_due_on_check" CHECK ("due_on" IS NULL OR "due_on" >= "purchased_on");

-- Each shop sees only its own payments.
ALTER TABLE "purchase_payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "purchase_payments"
  USING ("store_id" = app_current_store()) WITH CHECK ("store_id" = app_current_store());

-- The app adds payments and may only void one: no other change, no delete.
REVOKE UPDATE, DELETE ON "purchase_payments" FROM khmer_micro_store_app;
GRANT UPDATE ("voided_at", "voided_by_id") ON "purchase_payments" TO khmer_micro_store_app;

-- Voided once and for good: a voided payment can't be brought back or voided again.
CREATE FUNCTION app_purchase_payment_void_once() RETURNS trigger
  LANGUAGE plpgsql AS $$
  BEGIN
    IF OLD.voided_at IS NOT NULL THEN RAISE EXCEPTION 'payment already voided'; END IF;
    IF NEW.voided_at IS NULL THEN RAISE EXCEPTION 'a payment is only ever voided'; END IF;
    RETURN NEW;
  END $$;
CREATE TRIGGER purchase_payments_void_once BEFORE UPDATE OF "voided_at" ON "purchase_payments"
  FOR EACH ROW EXECUTE FUNCTION app_purchase_payment_void_once();

-- Data fill-in: every existing bill counts as paid on its own day (what it
-- still owes after its returns), numbered PAY-0001… in each shop in the
-- order of the bills, and each shop's payment counter starts after them.
INSERT INTO "purchase_payments" ("store_id", "purchase_id", "number", "paid_on", "amount_minor", "method", "created_by_id")
SELECT bill."store_id", bill."id",
       ROW_NUMBER() OVER (PARTITION BY bill."store_id" ORDER BY bill."purchased_on", bill."number"),
       bill."purchased_on", bill."total_minor" - COALESCE(sent."total", 0), 'other', bill."created_by_id"
  FROM "purchases" bill
  LEFT JOIN (SELECT "returns_id", SUM("total_minor") AS "total" FROM "purchases" WHERE "kind" = 'return' GROUP BY "returns_id") sent ON sent."returns_id" = bill."id"
 WHERE bill."kind" = 'purchase' AND bill."total_minor" - COALESCE(sent."total", 0) > 0;

INSERT INTO "document_counters" ("store_id", "series", "last_number")
SELECT "store_id", 'payment', MAX("number") FROM "purchase_payments" GROUP BY "store_id";
