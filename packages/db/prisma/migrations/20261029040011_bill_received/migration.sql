-- Received or not yet (docs/blueprint.md "Cost price", suppliers and bills):
-- a bill can be saved before its goods arrive. Stock goes up — and each
-- item's average cost moves — only when the bill is received: at once when
-- saved as received (as before), or later with "Received". A bill keeps when
-- it was received and by whom; empty means not received yet. Receiving is
-- done once and never undone (a mistake goes back with a return). Every
-- existing bill already added its stock, so each is filled in as received at
-- its own save time. Only added: going back one version still works (the
-- old code ignores the columns; every old bill is received).

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "received_at" TIMESTAMPTZ(6),
ADD COLUMN     "received_by_id" UUID;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Added by hand (Prisma can't express these) ─────────────────────────────

-- Data fill-in: every existing bill and return already moved its stock, at its own save time.
UPDATE "purchases" SET "received_at" = "created_at", "received_by_id" = "created_by_id" WHERE "received_at" IS NULL;

-- A return always counts as received (it takes stock off when it's saved).
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_return_received" CHECK ("kind" <> 'return' OR "received_at" IS NOT NULL);

-- A bill stays locked to the app, except receiving it: these two columns only.
GRANT UPDATE ("received_at", "received_by_id") ON "purchases" TO khmer_micro_store_app;

-- Received once and for good: never back to "not received", never received again.
CREATE FUNCTION app_purchase_receive_once() RETURNS trigger
  LANGUAGE plpgsql AS $$
  BEGIN
    IF OLD.received_at IS NOT NULL THEN RAISE EXCEPTION 'bill already received'; END IF;
    IF NEW.received_at IS NULL THEN RAISE EXCEPTION 'a bill is only ever received'; END IF;
    RETURN NEW;
  END $$;
CREATE TRIGGER purchases_receive_once BEFORE UPDATE OF "received_at" ON "purchases"
  FOR EACH ROW EXECUTE FUNCTION app_purchase_receive_once();
