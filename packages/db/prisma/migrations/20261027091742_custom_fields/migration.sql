-- CreateEnum
CREATE TYPE "CustomFieldTarget" AS ENUM ('product', 'orderLine');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('text', 'number', 'date', 'yesNo', 'pick');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "custom_values" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "custom_values" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "target" "CustomFieldTarget" NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "label_km" TEXT NOT NULL,
    "label_en" TEXT NOT NULL DEFAULT '',
    "options" JSONB NOT NULL DEFAULT '[]',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_field_definitions_store_id_idx" ON "custom_field_definitions"("store_id");

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- Added by hand (packages/shared custom-fields.ts): the rules and security.
-- =====================================================================

-- Values are always field id -> value; a pick-list is always a list; only a
-- product field can be shown to buyers.
ALTER TABLE products ADD CONSTRAINT products_custom_values_is_object CHECK (jsonb_typeof(custom_values) = 'object');
ALTER TABLE order_items ADD CONSTRAINT order_items_custom_values_is_object CHECK (jsonb_typeof(custom_values) = 'object');
ALTER TABLE custom_field_definitions ADD CONSTRAINT custom_field_definitions_options_is_list CHECK (jsonb_typeof(options) = 'array');
ALTER TABLE custom_field_definitions ADD CONSTRAINT custom_field_definitions_public_on_products CHECK (NOT public OR target = 'product');

-- Each shop sees only its own fields. Buyers on a shop page read only the
-- fields the shop shows them (public product fields), never the others.
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON custom_field_definitions
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
CREATE POLICY public_read ON custom_field_definitions FOR SELECT
  USING (store_id = app_public_store() AND public AND target = 'product');

-- Order lines stay unchangeable by the app (step 4 revoked UPDATE): the one
-- thing a seller may fill in afterwards is an item's own fields (the IMEI
-- handed over), on their own shop's order only. The API has already checked
-- the values against the shop's fields. Returns false when no such line.
CREATE FUNCTION app_set_order_line_values(target_item uuid, target_order uuid, new_values jsonb) RETURNS boolean
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
  AS $$
  BEGIN
    IF jsonb_typeof(new_values) <> 'object' THEN RAISE EXCEPTION 'values must be an object'; END IF;
    UPDATE order_items SET custom_values = new_values
    WHERE id = target_item AND order_id = target_order AND store_id = app_current_store();
    RETURN FOUND;
  END $$;
REVOKE ALL ON FUNCTION app_set_order_line_values(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_set_order_line_values(uuid, uuid, jsonb) TO khmer_micro_store_app;
