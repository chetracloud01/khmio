-- CreateEnum
CREATE TYPE "BusinessModule" AS ENUM ('options', 'choices', 'customFields', 'services', 'tables', 'jobCards');

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "modules" "BusinessModule"[] DEFAULT ARRAY[]::"BusinessModule"[];

-- Added by hand: every existing shop starts with its business type's modules,
-- the same sets as packages/shared business-modules.ts BUSINESS_TYPE_MODULES
-- (new shops get them from the API when they are made).
UPDATE stores SET modules = CASE business_type
  WHEN 'shop' THEN ARRAY['options', 'customFields']::"BusinessModule"[]
  WHEN 'restaurant' THEN ARRAY['options', 'choices', 'tables']::"BusinessModule"[]
  WHEN 'service' THEN ARRAY['services', 'customFields']::"BusinessModule"[]
  WHEN 'garage' THEN ARRAY['options', 'services', 'customFields', 'jobCards']::"BusinessModule"[]
  ELSE ARRAY['options']::"BusinessModule"[]
END;
