-- Selling in the shop (design/screens.md P1–P4): a sale at the counter is an
-- order with channel 'in_store', paid in cash or by the seller's own QR.
-- Every existing order becomes 'online' and keeps working as before.

-- Where the order was made.
CREATE TYPE "OrderChannel" AS ENUM ('online', 'in_store');

-- Handed over on the spot (no delivery, no pickup).
ALTER TYPE "Fulfilment" ADD VALUE 'in_store';

-- A counter sale undone by the seller.
ALTER TYPE "OrderCancelReason" ADD VALUE 'counter_void';

-- Paid at the counter: cash (not cash on delivery), or the shop's own QR,
-- checked by the seller in their bank app.
ALTER TYPE "PaymentMethod" ADD VALUE 'cash';
ALTER TYPE "PaymentMethod" ADD VALUE 'shop_qr';

-- channel: every existing row gets 'online'.
-- customer_id: a walk-in buyer may give no phone, so a counter sale may have no customer.
-- cash_received_minor / change_minor: for the receipt and the day's cash count.
-- sold_by_merchant_id: who rang the sale up (audit; staff later).
ALTER TABLE "orders" ADD COLUMN "cash_received_minor" INTEGER,
ADD COLUMN "change_minor" INTEGER,
ADD COLUMN "channel" "OrderChannel" NOT NULL DEFAULT 'online',
ADD COLUMN "sold_by_merchant_id" UUID,
ALTER COLUMN "customer_id" DROP NOT NULL;

-- The seller's payment QR picture, a storage key like the logo; '' = none yet.
ALTER TABLE "stores" ADD COLUMN "payment_qr_key" TEXT NOT NULL DEFAULT '';

ALTER TABLE "orders" ADD CONSTRAINT "orders_sold_by_merchant_id_fkey" FOREIGN KEY ("sold_by_merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Added by hand: the rules a counter sale must keep, whatever writes the row.
-- The new enum values are compared as text: PostgreSQL won't use a value
-- added in the same transaction.

-- An online order still always has its customer.
ALTER TABLE "orders" ADD CONSTRAINT "orders_online_has_customer"
  CHECK ("channel" = 'in_store' OR "customer_id" IS NOT NULL);

-- A counter sale is handed over on the spot, with no delivery fee, and paid
-- in cash or by the shop's QR; those two are for the counter only.
ALTER TABLE "orders" ADD CONSTRAINT "orders_counter_sale_shape"
  CHECK (
    ("channel" = 'in_store') = ("fulfilment"::text = 'in_store')
    AND ("channel" = 'in_store') = ("payment_method"::text IN ('cash', 'shop_qr'))
    AND ("channel" <> 'in_store' OR "delivery_fee_minor" = 0)
  );

-- Cash: received covers the total and the change is exactly the rest; no
-- other payment carries these amounts.
ALTER TABLE "orders" ADD CONSTRAINT "orders_cash_change"
  CHECK (
    ("cash_received_minor" IS NULL AND "change_minor" IS NULL)
    OR ("payment_method"::text = 'cash'
        AND "cash_received_minor" >= "total_minor"
        AND "change_minor" = "cash_received_minor" - "total_minor")
  );

-- A buyer on the shop page can only ever place an online order (row-level
-- security already limits them to this shop and their own order link).
DROP POLICY buyer_insert ON "orders";
CREATE POLICY buyer_insert ON "orders" FOR INSERT
  WITH CHECK (store_id = app_public_store() AND public_token = app_order_token() AND "channel" = 'online');
