-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "kitchen_done_at" TIMESTAMPTZ(6),
ADD COLUMN     "table_name" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "dine_tables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dine_tables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dine_tables_store_id_idx" ON "dine_tables"("store_id");

-- AddForeignKey
ALTER TABLE "dine_tables" ADD CONSTRAINT "dine_tables_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- Added by hand (Features › tables; packages/shared tables.ts): a table has
-- a name, unique in its shop; each shop sees only its own tables. Orders
-- copy the table's name, so renaming or removing a table never changes an
-- old order.
-- =====================================================================
ALTER TABLE dine_tables ADD CONSTRAINT dine_tables_name_not_blank CHECK (length(trim(name)) > 0);
CREATE UNIQUE INDEX dine_tables_store_name ON dine_tables (store_id, lower(name));

ALTER TABLE dine_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON dine_tables
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
