# Database changes

Every change to the database, in plain words: one line per migration, newest
at the bottom. The SQL itself is in
`packages/db/prisma/migrations/<name>/migration.sql`. How a migration is
made and the rules it follows: `docs/engineering-standard.md` §5.

**Safe?** says whether going back to the previous app version still works
with this change applied. "Yes" for additions; "Check" means read the note
first.

| Date | Migration | What changed | Why | Safe? |
| --- | --- | --- | --- | --- |
| 2026-10-01 | `step2_data_login` | First tables: merchants and their login methods, sessions, stores, shop members, payment settings, subscriptions, categories, units, platform settings, audit log. Row-level security on every shop table | Sign-up, login and a shop of one's own (roadmap step 2) | Yes |
| 2026-10-01 | `step3_catalog` | Brands, products, product options (variants) and photos; checks that every option has a price and no price is negative; platform setting `beta_all_basic` | Products and the catalog (step 3) | Yes |
| 2026-10-01 | `step4_checkout` | Delivery zones and their districts, drivers, customers, orders, order lines, order status history; each shop's running order number | Buyer checkout (step 4) | Yes |
| 2026-10-01 | `step6_orders` | Delivery dispatches (who takes an order where) and the outbox of events waiting to be sent | Seller order handling and alerts (step 6) | Yes |
| 2026-10-02 | `step7_admin` | Admin users with roles, their sessions and two-step backup codes | The platform admin area (step 7) | Yes |
| 2026-10-02 | `release1_telegram` | Telegram link codes, shop alert chats (groups) and buyers following an order | Telegram alerts for sellers and buyers | Yes |
| 2026-10-02 | `b1_rate_limits` | Rate-limit counters | Slowing down repeated tries (login, sign-ups) | Yes |
| 2026-10-06 | `brand_khmio` | Platform name and support handle changed to Khmio, only where still the old defaults | The new brand name. Data only, no shape change | Yes |
| 2026-10-07 | `website_waitlist` | Waitlist sign-ups, one per product and phone | The website's "coming soon" products | Yes |
| 2026-10-07 | `backup_runs` | Backup runs (one at a time) and when a restore test last passed | Backups from the admin area | Yes |
| 2026-10-07 | `worker_heartbeat` | When the worker was last seen | The admin can see the worker is alive | Yes |
| 2026-10-22 | `garage_business_type` | New business type `garage` | Garages as a kind of shop | Yes (a value is only added) |
| 2026-10-22 | `invoice_tracking` | A unique tracking code on every order (filled in for old orders too); the shop's tax number | Invoices and "Track my order" | Yes |
| 2026-10-23 | `shop_map_link` | The shop's map link (empty for every existing shop), with a check that it is empty or a web link of at most 300 characters | The buyer's Map button opens the shop's exact place (Shop details → Location and pickup) | Yes (a column is only added) |
| 2026-10-23 | `counter_sales` | Orders get where they were made (online or in the shop; all existing orders are online), two counter payments (cash, the shop's own QR), "in shop" handover, a "voided at the counter" reason, optional customer for counter sales, cash received and change, who made the sale; stores get the payment QR picture. Checks: a counter sale has no delivery fee and pays by cash or shop QR only, the change is exactly received minus total, an online order always has a customer, and a buyer on the shop page can only write online orders | Selling at the counter (Sell in shop) | Check — going back one version after counter sales exist: the old app doesn't know the new values, so its orders list can fail on those rows; online orders are unaffected |
