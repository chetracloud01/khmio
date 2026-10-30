-- A bill in either currency (docs/blueprint.md "Cost price", suppliers and
-- bills): an item's cost stays in its one cost currency, so a bill line in
-- the other currency is turned into it once, at the bill's rate (riel per
-- $1: the shop's rate unless the invoice says otherwise), when the bill is
-- saved. The bill keeps the rate it used, and each line keeps both its price
-- as invoiced and the cost of one in the item's own currency (what went into
-- its average). Only added: going back one version ignores the new columns.

-- AlterTable
ALTER TABLE "purchase_lines" ADD COLUMN     "item_cost_currency" "Currency",
ADD COLUMN     "item_cost_minor" INTEGER;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "exchange_rate_used" INTEGER;

-- ── Added by hand (Prisma can't express these) ─────────────────────────────

-- A rate is above zero; an item cost is never negative and always has its currency.
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_exchange_rate_used_check" CHECK ("exchange_rate_used" IS NULL OR "exchange_rate_used" > 0);
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_item_cost_check"
  CHECK (("item_cost_minor" IS NULL) = ("item_cost_currency" IS NULL) AND ("item_cost_minor" IS NULL OR "item_cost_minor" >= 0));

-- Data fill-in: before this, every line was in its item's own currency (a bill
-- in the other one was refused), so each line's item cost is its own price, in
-- its bill's currency. Old bills keep no rate: nothing on them was turned.
UPDATE "purchase_lines" AS line
   SET "item_cost_minor" = line."unit_cost_minor", "item_cost_currency" = bill."currency"
  FROM "purchases" AS bill
 WHERE bill."id" = line."purchase_id";
