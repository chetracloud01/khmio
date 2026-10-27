-- Services (Features › services; packages/shared services.ts): a product is an
-- item (every existing one) or a service; an order of only services keeps
-- the time the buyer would like it done. Both only added: nothing existing
-- changes meaning.

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('item', 'service');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "preferred_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "kind" "ProductKind" NOT NULL DEFAULT 'item';
