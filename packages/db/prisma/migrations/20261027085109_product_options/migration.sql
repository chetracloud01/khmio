-- CreateEnum
CREATE TYPE "OptionGroupKind" AS ENUM ('variant', 'choice');

-- CreateEnum
CREATE TYPE "ChoicePick" AS ENUM ('one', 'many');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "choices" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "note" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "product_option_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "kind" "OptionGroupKind" NOT NULL,
    "name_km" TEXT NOT NULL,
    "name_en" TEXT NOT NULL DEFAULT '',
    "pick" "ChoicePick" NOT NULL DEFAULT 'one',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_option_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "label_km" TEXT NOT NULL,
    "label_en" TEXT NOT NULL DEFAULT '',
    "extra_usd_cents" INTEGER,
    "extra_khr" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_option_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_values" (
    "variant_id" UUID NOT NULL,
    "value_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,

    CONSTRAINT "product_variant_values_pkey" PRIMARY KEY ("variant_id","value_id")
);

-- CreateIndex
CREATE INDEX "product_option_groups_product_id_idx" ON "product_option_groups"("product_id");

-- CreateIndex
CREATE INDEX "product_option_values_group_id_idx" ON "product_option_values"("group_id");

-- CreateIndex
CREATE INDEX "product_variant_values_value_id_idx" ON "product_variant_values"("value_id");

-- AddForeignKey
ALTER TABLE "product_option_groups" ADD CONSTRAINT "product_option_groups_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_groups" ADD CONSTRAINT "product_option_groups_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "product_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_values" ADD CONSTRAINT "product_variant_values_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_values" ADD CONSTRAINT "product_variant_values_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_values" ADD CONSTRAINT "product_variant_values_value_id_fkey" FOREIGN KEY ("value_id") REFERENCES "product_option_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- Added by hand (packages/shared product-options.ts): the rules, security,
-- and today's options moved into a group.
-- =====================================================================

-- Extra prices are never negative.
ALTER TABLE product_option_values ADD CONSTRAINT product_option_values_extra_not_negative
  CHECK ((extra_usd_cents IS NULL OR extra_usd_cents >= 0) AND (extra_khr IS NULL OR extra_khr >= 0));
-- An order line's choices are always a list.
ALTER TABLE order_items ADD CONSTRAINT order_items_choices_is_list CHECK (jsonb_typeof(choices) = 'array');

-- Each shop sees only its own options. Buyers on a shop page read the
-- options of products they can see, and never write them.
ALTER TABLE product_option_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON product_option_groups
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
CREATE POLICY public_read ON product_option_groups FOR SELECT
  USING (store_id = app_public_store()
         AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.is_visible AND p.deleted_at IS NULL));

ALTER TABLE product_option_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON product_option_values
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
CREATE POLICY public_read ON product_option_values FOR SELECT
  USING (store_id = app_public_store()
         AND EXISTS (SELECT 1 FROM product_option_groups g JOIN products p ON p.id = g.product_id
                     WHERE g.id = group_id AND p.is_visible AND p.deleted_at IS NULL));

ALTER TABLE product_variant_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON product_variant_values
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
CREATE POLICY public_read ON product_variant_values FOR SELECT
  USING (store_id = app_public_store());

-- Today's options become one variant group per product ("Option"), each
-- option a value of it. A value takes its variant's id, so the link from
-- variant to value is simply the same id twice. Nothing is removed: the
-- variants keep their labels (add first, remove in a later release).
INSERT INTO product_option_groups (store_id, product_id, kind, name_km, name_en)
SELECT DISTINCT v.store_id, v.product_id, 'variant'::"OptionGroupKind", 'ជម្រើស', 'Option'
FROM product_variants v
WHERE v.deleted_at IS NULL AND NOT v.is_default;

INSERT INTO product_option_values (id, store_id, group_id, label_km, label_en, sort_order)
SELECT v.id, v.store_id, g.id, coalesce(nullif(v.label_km, ''), v.label_en), v.label_en, v.sort_order
FROM product_variants v
JOIN product_option_groups g ON g.product_id = v.product_id AND g.kind = 'variant'
WHERE v.deleted_at IS NULL AND NOT v.is_default;

INSERT INTO product_variant_values (variant_id, value_id, store_id)
SELECT v.id, v.id, v.store_id
FROM product_variants v
WHERE v.deleted_at IS NULL AND NOT v.is_default;
