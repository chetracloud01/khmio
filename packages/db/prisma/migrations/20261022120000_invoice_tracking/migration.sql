-- Invoices and "Track my order" (design/screens.md B7, B8).

-- A tracking code: 8 characters without look-alikes (packages/shared invoice.ts
-- TRACKING_CODE_ALPHABET), from gen_random_uuid's random bytes (bytes 9–15 and
-- 0 — the version and variant bits sit in bytes 6 and 8). 256 is a multiple
-- of 32, so every character is equally likely.
CREATE FUNCTION app_new_tracking_code() RETURNS text
  LANGUAGE sql VOLATILE SET search_path = public
  AS $$
    SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + get_byte(r.b, i) % 32, 1), '' ORDER BY i)
    FROM (SELECT uuid_send(gen_random_uuid()) AS b) r, unnest(ARRAY[9, 10, 11, 12, 13, 14, 15, 0]) AS i
  $$;
REVOKE ALL ON FUNCTION app_new_tracking_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_new_tracking_code() TO khmer_micro_store_app;

-- Every order gets one when it's placed; existing orders get theirs now (a volatile default runs per row).
ALTER TABLE "orders" ADD COLUMN "tracking_code" TEXT NOT NULL DEFAULT app_new_tracking_code();
CREATE UNIQUE INDEX "orders_tracking_code_key" ON "orders"("tracking_code");

-- "Track my order": the order link for a tracking code and the phone it was placed with — both must match,
-- so a code alone never opens anyone's order. SECURITY DEFINER because the buyer has no store or order yet.
CREATE FUNCTION app_order_token_by_tracking(code text, phone text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT public_token FROM orders WHERE tracking_code = code AND buyer_phone = phone $$;
REVOKE ALL ON FUNCTION app_order_token_by_tracking(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_order_token_by_tracking(text, text) TO khmer_micro_store_app;

-- What the seller adds under "On your invoices" (design/screens.md S10). Empty = not shown.
ALTER TABLE "stores" ADD COLUMN "tax_number" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "invoice_note" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "telegram_link" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "facebook_link" TEXT NOT NULL DEFAULT '';
