-- Stock (docs/blueprint.md "Stock", design/screens.md S13), roadmap Pro plan:
-- locations (warehouses, branches), levels (how many now, per product option
-- and location; no row = not tracked) and movements (the history, never
-- edited). Part 1 uses the main branch only.

-- CreateEnum
CREATE TYPE "StockLocationType" AS ENUM ('warehouse', 'branch');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('purchase', 'sale', 'transfer_out', 'transfer_in', 'adjust_in', 'adjust_out');

-- CreateEnum
CREATE TYPE "StockAdjustmentReason" AS ENUM ('count_correction', 'damaged', 'lost', 'returned', 'other');

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "type" "StockLocationType" NOT NULL,
    "name_km" TEXT NOT NULL,
    "name_en" TEXT NOT NULL DEFAULT '',
    "supplied_by_location_id" UUID,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "StockAdjustmentReason",
    "transfer_id" UUID,
    "order_id" UUID,
    "note" TEXT NOT NULL DEFAULT '',
    "actor_merchant_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_locations_store_id_idx" ON "stock_locations"("store_id");

-- CreateIndex
CREATE INDEX "stock_levels_store_id_idx" ON "stock_levels"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_variant_id_location_id_key" ON "stock_levels"("variant_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_movements_store_id_created_at_idx" ON "stock_movements"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_variant_id_idx" ON "stock_movements"("variant_id");

-- CreateIndex
CREATE INDEX "stock_movements_order_id_idx" ON "stock_movements"("order_id");

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_supplied_by_location_id_fkey" FOREIGN KEY ("supplied_by_location_id") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_merchant_id_fkey" FOREIGN KEY ("actor_merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- Added by hand (docs/blueprint.md "Stock"): the rules, security and the
-- main branch every shop sells from.
-- =====================================================================

-- Never below zero; held stock never more than what is there; a movement is
-- always a positive number (its type says which way); an adjustment says why.
ALTER TABLE stock_levels ADD CONSTRAINT stock_levels_amounts_valid CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand);
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_quantity_positive CHECK (quantity > 0);
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_adjustment_has_reason
  CHECK ((type IN ('adjust_in', 'adjust_out')) = (reason IS NOT NULL));

-- One main branch per shop.
CREATE UNIQUE INDEX stock_locations_one_main ON stock_locations (store_id) WHERE is_main;

-- Every shop's main branch: the existing ones now, each new shop as it is made.
INSERT INTO stock_locations (store_id, type, name_km, name_en, is_main)
SELECT id, 'branch', 'សាខាមេ', 'Main branch', true FROM stores;

CREATE FUNCTION app_add_main_branch() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
  AS $$
  BEGIN
    INSERT INTO stock_locations (store_id, type, name_km, name_en, is_main) VALUES (NEW.id, 'branch', 'សាខាមេ', 'Main branch', true);
    RETURN NEW;
  END $$;
CREATE TRIGGER stores_main_branch AFTER INSERT ON stores FOR EACH ROW EXECUTE FUNCTION app_add_main_branch();

-- Each shop sees only its own stock. Buyers on a shop page read its levels
-- (for "Sold out" and "Only N left") and locations, and never write either.
ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON stock_locations
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
CREATE POLICY public_read ON stock_locations FOR SELECT USING (store_id = app_public_store());

ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON stock_levels
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
CREATE POLICY public_read ON stock_levels FOR SELECT USING (store_id = app_public_store());

-- The history is never edited, by anyone through the app.
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_isolation ON stock_movements
  USING (store_id = app_current_store()) WITH CHECK (store_id = app_current_store());
REVOKE UPDATE, DELETE ON stock_movements FROM khmer_micro_store_app;

-- The plan of the shop page's store, for "does it track stock" (packages/shared
-- plans.ts decides): buyers can't read subscriptions or platform settings.
CREATE FUNCTION app_public_store_plan() RETURNS TABLE (plan "PlanId", status "SubscriptionStatus", beta_all_basic boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
    SELECT s.plan, s.status, (SELECT p.beta_all_basic FROM platform_settings p WHERE p.id = 1)
    FROM stores st LEFT JOIN subscriptions s ON s.store_id = st.id
    WHERE st.id = app_public_store()
  $$;
REVOKE ALL ON FUNCTION app_public_store_plan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_public_store_plan() TO khmer_micro_store_app;

-- The order a request may move stock for: the seller's own shop's, or the
-- buyer's own order on the shop page they are on. NULL = neither.
CREATE FUNCTION app_stock_order(target_order uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
    SELECT id FROM orders
    WHERE id = target_order
      AND (store_id = app_current_store() OR (store_id = app_public_store() AND public_token = app_order_token()))
  $$;
REVOKE ALL ON FUNCTION app_stock_order(uuid) FROM PUBLIC;

-- Takes an order's tracked items off the main branch, with one statement per
-- item that only succeeds while enough is left: two buyers can never both get
-- the last one. Returns NULL when done, or the first product option without
-- enough; the caller then rolls the whole transaction back. Options whose
-- stock isn't tracked (no level row) are left alone. Called only for shops
-- whose plan tracks stock (the API checks packages/shared plans.ts).
CREATE FUNCTION app_take_order_stock(target_order uuid) RETURNS uuid
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
  AS $$
  DECLARE
    found_order orders%ROWTYPE;
    main_location uuid;
    line record;
    changed integer;
    took boolean := false;
  BEGIN
    SELECT * INTO found_order FROM orders WHERE id = app_stock_order(target_order);
    IF found_order.id IS NULL THEN RAISE EXCEPTION 'no such order'; END IF;
    IF found_order.stock_taken THEN RETURN NULL; END IF;
    SELECT id INTO main_location FROM stock_locations WHERE store_id = found_order.store_id AND is_main;
    FOR line IN
      SELECT i.variant_id, sum(i.quantity)::integer AS quantity
      FROM order_items i
      WHERE i.order_id = found_order.id
        AND EXISTS (SELECT 1 FROM stock_levels l WHERE l.variant_id = i.variant_id AND l.location_id = main_location)
      GROUP BY i.variant_id
    LOOP
      UPDATE stock_levels SET on_hand = on_hand - line.quantity, updated_at = now()
      WHERE variant_id = line.variant_id AND location_id = main_location AND on_hand - reserved >= line.quantity;
      GET DIAGNOSTICS changed = ROW_COUNT;
      IF changed = 0 THEN RETURN line.variant_id; END IF;
      INSERT INTO stock_movements (store_id, variant_id, location_id, type, quantity, order_id, actor_merchant_id)
      VALUES (found_order.store_id, line.variant_id, main_location, 'sale', line.quantity, found_order.id, app_current_merchant());
      took := true;
    END LOOP;
    IF took THEN UPDATE orders SET stock_taken = true WHERE id = found_order.id; END IF;
    RETURN NULL;
  END $$;
REVOKE ALL ON FUNCTION app_take_order_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_take_order_stock(uuid) TO khmer_micro_store_app;

-- Puts back what an order took (a cancelled order, a voided counter sale) as
-- "returned" corrections, whatever the plan is now. Options no longer tracked
-- get nothing back.
CREATE FUNCTION app_return_order_stock(target_order uuid) RETURNS void
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
  AS $$
  DECLARE
    found_order orders%ROWTYPE;
    taken record;
  BEGIN
    SELECT * INTO found_order FROM orders WHERE id = app_stock_order(target_order);
    IF found_order.id IS NULL THEN RAISE EXCEPTION 'no such order'; END IF;
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
REVOKE ALL ON FUNCTION app_return_order_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_return_order_stock(uuid) TO khmer_micro_store_app;

-- A buyer cancelling their own order now also gets its stock put back.
CREATE OR REPLACE FUNCTION app_buyer_cancel_order(expected "OrderStatus") RETURNS boolean
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
  AS $$
  DECLARE cancelled_id uuid;
  DECLARE cancelled_store uuid;
  BEGIN
    IF app_public_store() IS NULL OR app_order_token() IS NULL THEN RAISE EXCEPTION 'no order chosen'; END IF;
    UPDATE orders SET status = 'cancelled', cancel_reason = 'buyer_cancelled', updated_at = now()
    WHERE public_token = app_order_token()
      AND store_id = app_public_store()
      AND status = expected
      AND (status IN ('awaiting_payment', 'cod_pending') OR (status = 'confirmed' AND payment_method = 'cod'))
    RETURNING id, store_id INTO cancelled_id, cancelled_store;
    IF cancelled_id IS NULL THEN RETURN false; END IF;
    PERFORM app_return_order_stock(cancelled_id);
    INSERT INTO order_status_events (store_id, order_id, status, actor) VALUES (cancelled_store, cancelled_id, 'cancelled', 'buyer');
    INSERT INTO outbox_events (store_id, kind, payload) VALUES (cancelled_store, 'order_cancelled_by_buyer', jsonb_build_object('orderId', cancelled_id));
    INSERT INTO outbox_events (store_id, kind, payload) VALUES (cancelled_store, 'order_status_changed', jsonb_build_object('orderId', cancelled_id, 'status', 'cancelled'));
    RETURN true;
  END $$;
