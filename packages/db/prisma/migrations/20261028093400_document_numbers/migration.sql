-- Separate document numbers (docs/blueprint.md "Cost price", suppliers and
-- bills): each kind of document counts 1, 2, 3… on its own in each shop —
-- bills, returns to the supplier, and (next) payments — shown as BILL-0001,
-- RET-0001, PAY-0001 (the prefixes are packages/shared documents.ts, never
-- stored). A shop's counter row is taken and moved on in one statement, so
-- two documents saved at once never share a number. Existing numbers are
-- kept as they are; each counter starts after the highest number its kind
-- already has. Going back one version still works: the old code numbers by
-- max + 1 across all kinds, which the looser rule below still accepts.

-- CreateEnum
CREATE TYPE "DocumentSeries" AS ENUM ('bill', 'return', 'payment');

-- One number per shop and kind (was: per shop).
DROP INDEX "purchases_store_id_number_key";

-- CreateTable
CREATE TABLE "document_counters" (
    "store_id" UUID NOT NULL,
    "series" "DocumentSeries" NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("store_id","series")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchases_store_id_kind_number_key" ON "purchases"("store_id", "kind", "number");

-- AddForeignKey
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Added by hand (Prisma can't express these) ─────────────────────────────

-- A number is never below zero.
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_last_number_check" CHECK ("last_number" >= 0);

-- Each shop sees and moves only its own counters (same policy as every shop table).
ALTER TABLE "document_counters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON "document_counters"
  USING ("store_id" = app_current_store())
  WITH CHECK ("store_id" = app_current_store());

-- A counter is never deleted by the app (a deleted row would hand out numbers again from 1).
REVOKE DELETE ON "document_counters" FROM khmer_micro_store_app;

-- Data fill-in: each shop's bill and return counters start after the highest
-- number that kind already has, so no new document repeats an old one.
INSERT INTO "document_counters" ("store_id", "series", "last_number")
SELECT "store_id", CASE "kind" WHEN 'purchase' THEN 'bill'::"DocumentSeries" ELSE 'return'::"DocumentSeries" END, MAX("number")
FROM "purchases"
GROUP BY "store_id", "kind";
