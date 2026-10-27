-- CreateTable
CREATE TABLE "waitlist_signups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "business_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_signups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waitlist_signups_created_at_idx" ON "waitlist_signups"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_signups_product_phone_key" ON "waitlist_signups"("product", "phone");

-- =====================================================================
-- Website waitlist (platform website, Stage 3). No store_id: the sign-ups
-- belong to the platform, not a shop, so there is no row-level security to
-- add. The app user can't read or change the table at all; only SystemDb
-- (the public waitlist endpoint and the admin) touches it.
-- =====================================================================

ALTER TABLE waitlist_signups
  ADD CONSTRAINT waitlist_signups_product_known CHECK (product IN ('shop', 'class', 'rent')),
  ADD CONSTRAINT waitlist_signups_business_type_known CHECK (business_type IN ('teacher', 'school', 'landlord', 'other')),
  ADD CONSTRAINT waitlist_signups_name_length CHECK (length(name) BETWEEN 2 AND 60),
  ADD CONSTRAINT waitlist_signups_phone_format CHECK (phone ~ '^855[0-9]{8,9}$');

REVOKE ALL ON waitlist_signups FROM khmer_micro_store_app;
