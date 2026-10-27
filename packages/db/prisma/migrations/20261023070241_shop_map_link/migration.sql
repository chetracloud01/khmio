-- The shop's map link (design/screens.md S10, "Location and pickup"): what the
-- seller copied from Google Maps; the buyer's Map button opens it. Empty = no
-- link, and the Map button searches for the pickup address instead.
-- Existing shops get '' — nothing changes for them until they add one.
-- stores already has row-level security, so the new column is covered.
ALTER TABLE "stores" ADD COLUMN "map_url" TEXT NOT NULL DEFAULT '';

-- Added by hand (Prisma can't express it): the same rule as packages/shared
-- shopMapUrlSchema — empty, or a web link of at most 300 characters — so a
-- javascript: or other non-web link can never reach a buyer's Map button,
-- whatever writes the row.
ALTER TABLE "stores" ADD CONSTRAINT "stores_map_url_web_link"
  CHECK ("map_url" = '' OR ("map_url" ~* '^https?://\S+$' AND char_length("map_url") <= 300));
