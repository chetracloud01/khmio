-- CreateEnum
CREATE TYPE "JobCardStatus" AS ENUM ('open', 'in_progress', 'ready', 'handed_over', 'cancelled');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "plate" TEXT NOT NULL,
    "make_model" TEXT NOT NULL DEFAULT '',
    "owner_name" TEXT NOT NULL DEFAULT '',
    "owner_phone" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "JobCardStatus" NOT NULL DEFAULT 'open',
    "complaint" TEXT NOT NULL DEFAULT '',
    "mileage_km" INTEGER,
    "order_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_card_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "job_card_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_card_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicles_store_id_idx" ON "vehicles"("store_id");

-- CreateIndex
CREATE INDEX "job_cards_store_id_status_idx" ON "job_cards"("store_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "job_cards_store_id_number_key" ON "job_cards"("store_id", "number");

-- CreateIndex
CREATE INDEX "job_card_lines_job_card_id_idx" ON "job_card_lines"("job_card_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_lines" ADD CONSTRAINT "job_card_lines_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_lines" ADD CONSTRAINT "job_card_lines_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_lines" ADD CONSTRAINT "job_card_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- Added by hand (Features › jobCards; packages/shared job-cards.ts): the
-- rules and security.
-- =====================================================================

-- A plate is never blank, and one car is one row per shop whatever its
-- spacing or case; numbers and quantities are positive; a card is handed
-- over only with the sale it was billed by.
ALTER TABLE vehicles ADD CONSTRAINT vehicles_plate_not_blank CHECK (length(trim(plate)) > 0);
CREATE UNIQUE INDEX vehicles_store_plate ON vehicles (store_id, upper(replace(plate, ' ', '')));
ALTER TABLE job_cards ADD CONSTRAINT job_cards_number_positive CHECK (number > 0);
ALTER TABLE job_cards ADD CONSTRAINT job_cards_mileage_not_negative CHECK (mileage_km IS NULL OR mileage_km >= 0);
ALTER TABLE job_cards ADD CONSTRAINT job_cards_handed_over_billed CHECK (status <> 'handed_over' OR order_id IS NOT NULL);
ALTER TABLE job_card_lines ADD CONSTRAINT job_card_lines_quantity_positive CHECK (quantity > 0);

-- Each shop sees only its own cars, cards and lines.
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON vehicles
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON job_cards
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
ALTER TABLE job_card_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON job_card_lines
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
