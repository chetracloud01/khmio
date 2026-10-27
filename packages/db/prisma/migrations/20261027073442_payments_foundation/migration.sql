-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('pending', 'paid', 'expired', 'failed');

-- CreateEnum
CREATE TYPE "PaymentCheckIssue" AS ENUM ('provider_unreachable', 'amount_mismatch', 'currency_mismatch', 'paid_after_expiry');

-- CreateEnum
CREATE TYPE "PaymentIssueStatus" AS ENUM ('open', 'confirmed', 'closed');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "stock_reserved" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_ref" TEXT NOT NULL,
    "qr_payload" TEXT NOT NULL DEFAULT '',
    "amount_minor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "check_count" INTEGER NOT NULL DEFAULT 0,
    "last_checked_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "raw_response" JSONB,
    "issue" "PaymentCheckIssue",
    "issue_status" "PaymentIssueStatus",
    "issue_note" TEXT NOT NULL DEFAULT '',
    "issue_closed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_reservations_store_id_idx" ON "stock_reservations"("store_id");

-- CreateIndex
CREATE INDEX "stock_reservations_variant_id_location_id_idx" ON "stock_reservations"("variant_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_reservations_order_id_variant_id_location_id_key" ON "stock_reservations"("order_id", "variant_id", "location_id");

-- CreateIndex
CREATE INDEX "payment_attempts_order_id_idx" ON "payment_attempts"("order_id");

-- CreateIndex
CREATE INDEX "payment_attempts_store_id_created_at_idx" ON "payment_attempts"("store_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_provider_ref_key" ON "payment_attempts"("provider", "provider_ref");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- CreateIndex
CREATE INDEX "orders_store_id_status_idx" ON "orders"("store_id", "status");

-- Added by hand: the column had no foreign key until now, so clear any value
-- that points at no location before adding one (none expected: nothing writes
-- it yet; null = the shop page sells from the main branch).
UPDATE stores SET online_stock_location_id = NULL
WHERE online_stock_location_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM stock_locations l WHERE l.id = stores.online_stock_location_id);

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_online_stock_location_id_fkey" FOREIGN KEY ("online_stock_location_id") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_issue_closed_by_fkey" FOREIGN KEY ("issue_closed_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- Added by hand (docs/blueprint.md "Payments" and "Stock without
-- overselling"): the rules, security, and the functions that hold stock for
-- an order waiting to be paid online.
-- =====================================================================

-- A payment attempt is for a real amount; an issue always has a handling
-- status (and the reverse); a paid attempt says when.
ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_amount_positive CHECK (amount_minor > 0 AND check_count >= 0);
ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_issue_has_status CHECK ((issue IS NULL) = (issue_status IS NULL));
ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_paid_has_time CHECK (status <> 'paid' OR paid_at IS NOT NULL);
ALTER TABLE stock_reservations ADD CONSTRAINT stock_reservations_quantity_positive CHECK (quantity > 0);

-- An order can be tried many times but paid only once.
CREATE UNIQUE INDEX payment_attempts_one_paid_per_order ON payment_attempts (order_id) WHERE status = 'paid';

-- The worker asks every few seconds which attempts are still waiting.
CREATE INDEX payment_attempts_pending ON payment_attempts (expires_at) WHERE status = 'pending';

-- Payment attempts: the seller reads their shop's; the buyer reads their own
-- order's (to show the QR again), and the API, as that buyer, adds a new
-- pending one when the order is placed. Nobody using the app changes or
-- deletes one: only the worker (the database owner), after asking the
-- provider's own status API, marks one paid, expired or failed.
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY seller_read ON payment_attempts FOR SELECT
  USING (store_id = app_current_store());
CREATE POLICY buyer_read ON payment_attempts FOR SELECT
  USING (store_id = app_public_store()
         AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.store_id = app_public_store() AND o.public_token = app_order_token()));
CREATE POLICY buyer_insert ON payment_attempts FOR INSERT
  WITH CHECK (store_id = app_public_store() AND status = 'pending' AND paid_at IS NULL AND issue IS NULL
              AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.store_id = app_public_store() AND o.public_token = app_order_token()));
REVOKE UPDATE, DELETE ON payment_attempts FROM khmer_micro_store_app;

-- Stock reservations: the seller reads their shop's; only the functions below write them.
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON stock_reservations
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
REVOKE INSERT, UPDATE, DELETE ON stock_reservations FROM khmer_micro_store_app;

-- Holds an order's tracked items at the main branch while it waits to be paid
-- online: one statement per item that only succeeds while enough is free, so
-- two buyers can never both hold the last one. Returns NULL when done, or the
-- first product option without enough; the caller then rolls the whole
-- transaction back. Untracked options are left alone, as for a sale.
CREATE FUNCTION app_reserve_order_stock(target_order uuid) RETURNS uuid
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
  AS $$
  DECLARE
    found_order orders%ROWTYPE;
    main_location uuid;
    line record;
    changed integer;
    held boolean := false;
  BEGIN
    SELECT * INTO found_order FROM orders WHERE id = app_stock_order(target_order);
    IF found_order.id IS NULL THEN RAISE EXCEPTION 'no such order'; END IF;
    IF found_order.stock_reserved OR found_order.stock_taken THEN RETURN NULL; END IF;
    SELECT id INTO main_location FROM stock_locations WHERE store_id = found_order.store_id AND is_main;
    FOR line IN
      SELECT i.variant_id, sum(i.quantity)::integer AS quantity
      FROM order_items i
      WHERE i.order_id = found_order.id
        AND EXISTS (SELECT 1 FROM stock_levels l WHERE l.variant_id = i.variant_id AND l.location_id = main_location)
      GROUP BY i.variant_id
    LOOP
      UPDATE stock_levels SET reserved = reserved + line.quantity, updated_at = now()
      WHERE variant_id = line.variant_id AND location_id = main_location AND on_hand - reserved >= line.quantity;
      GET DIAGNOSTICS changed = ROW_COUNT;
      IF changed = 0 THEN RETURN line.variant_id; END IF;
      INSERT INTO stock_reservations (store_id, order_id, variant_id, location_id, quantity)
      VALUES (found_order.store_id, found_order.id, line.variant_id, main_location, line.quantity);
      held := true;
    END LOOP;
    IF held THEN UPDATE orders SET stock_reserved = true WHERE id = found_order.id; END IF;
    RETURN NULL;
  END $$;
REVOKE ALL ON FUNCTION app_reserve_order_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_reserve_order_stock(uuid) TO khmer_micro_store_app;

-- The order is paid: what it held becomes a sale (taken off the shelf, a
-- "sale" in the history). Called by the worker only, after the provider's
-- status API confirmed the exact amount. Options no longer tracked are skipped.
CREATE FUNCTION app_settle_reserved_stock(target_order uuid) RETURNS void
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
  AS $$
  DECLARE
    found_order orders%ROWTYPE;
    held record;
  BEGIN
    SELECT * INTO found_order FROM orders WHERE id = target_order FOR UPDATE;
    IF found_order.id IS NULL OR NOT found_order.stock_reserved THEN RETURN; END IF;
    FOR held IN SELECT variant_id, location_id, quantity FROM stock_reservations WHERE order_id = found_order.id LOOP
      UPDATE stock_levels SET on_hand = on_hand - held.quantity, reserved = reserved - held.quantity, updated_at = now()
      WHERE variant_id = held.variant_id AND location_id = held.location_id;
      IF FOUND THEN
        INSERT INTO stock_movements (store_id, variant_id, location_id, type, quantity, order_id)
        VALUES (found_order.store_id, held.variant_id, held.location_id, 'sale', held.quantity, found_order.id);
      END IF;
    END LOOP;
    DELETE FROM stock_reservations WHERE order_id = found_order.id;
    UPDATE orders SET stock_reserved = false, stock_taken = true WHERE id = found_order.id;
  END $$;
REVOKE ALL ON FUNCTION app_settle_reserved_stock(uuid) FROM PUBLIC;

-- What an unpaid order held goes back on sale (the code expired, or the order
-- was cancelled before it was paid). No history line: nothing left the shelf.
CREATE FUNCTION app_release_reserved_stock(target_order uuid) RETURNS void
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
  AS $$
  DECLARE
    found_order orders%ROWTYPE;
    held record;
  BEGIN
    SELECT * INTO found_order FROM orders WHERE id = target_order FOR UPDATE;
    IF found_order.id IS NULL OR NOT found_order.stock_reserved THEN RETURN; END IF;
    FOR held IN SELECT variant_id, location_id, quantity FROM stock_reservations WHERE order_id = found_order.id LOOP
      UPDATE stock_levels SET reserved = reserved - held.quantity, updated_at = now()
      WHERE variant_id = held.variant_id AND location_id = held.location_id;
    END LOOP;
    DELETE FROM stock_reservations WHERE order_id = found_order.id;
    UPDATE orders SET stock_reserved = false WHERE id = found_order.id;
  END $$;
REVOKE ALL ON FUNCTION app_release_reserved_stock(uuid) FROM PUBLIC;

-- Cancelling an order (seller, buyer, or a voided counter sale) now also lets
-- go of stock it was only holding, as well as putting back what it took.
CREATE OR REPLACE FUNCTION app_return_order_stock(target_order uuid) RETURNS void
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
  AS $$
  DECLARE
    found_order orders%ROWTYPE;
    taken record;
  BEGIN
    SELECT * INTO found_order FROM orders WHERE id = app_stock_order(target_order);
    IF found_order.id IS NULL THEN RAISE EXCEPTION 'no such order'; END IF;
    PERFORM app_release_reserved_stock(found_order.id);
    IF NOT found_order.stock_taken THEN RETURN; END IF;
    FOR taken IN
      SELECT m.variant_id, m.location_id, sum(m.quantity)::integer AS quantity
      FROM stock_movements m WHERE m.order_id = found_order.id AND m.type = 'sale'
      GROUP BY m.variant_id, m.location_id
    LOOP
      UPDATE stock_levels SET on_hand = on_hand + taken.quantity, updated_at = now()
      WHERE variant_id = taken.variant_id AND location_id = taken.location_id;
      IF FOUND THEN
        INSERT INTO stock_movements (store_id, variant_id, location_id, type, quantity, reason, order_id, actor_merchant_id)
        VALUES (found_order.store_id, taken.variant_id, taken.location_id, 'adjust_in', taken.quantity, 'returned', found_order.id, app_current_merchant());
      END IF;
    END LOOP;
    UPDATE orders SET stock_taken = false WHERE id = found_order.id;
  END $$;
