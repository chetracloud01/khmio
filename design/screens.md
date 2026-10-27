# Screens

What each screen contains. How it must look and behave is in
`design/design-standard.md`. Phone first (360 px), then tablet and desktop.

Status: **Built** = matches the docs · **Mockup** = built as a mockup, backend later · **Change** = exists, needs the
changes listed · **New** = not built yet.
Phase: from `docs/blueprint.md` "Market and how we win" — L = launch, 2 = delivery and
switching, 3 = growth.

## Mascot

Mio, the Khmio rabbit (docs/platform-launch-plan.md, Stage 1), drawn only
by the `Mio` component in `packages/ui`. Decoration unless it says
something: then it gets a label from the translation files.

| Screen | Mio | Status |
| --- | --- | --- |
| S1 Login | Mio's face above the sign-in buttons | Built |
| S4 Orders list, empty | Mio above "No orders yet" | Built |
| B5 KHQR payment, paid | Mio with a riel coin, a small hop, "Paid!", then B6 | Mockup |
| Telegram bot photo, stickers | From the designer's final artwork | Later |

## Buyer

Flow: Shop → (Product) → Cart → Checkout → Pay → Order status.

### B1. Shop page `/s/[slug]` — Built · L
- Banner, logo, shop name, Verified badge (after KYC), rating, delivery time.
- Language ខ្មែរ/EN and theme, top right.
- Pinned: search and category chips only.
- Special offers strip; product grid (2 / 3 / 4 columns).
- Product card: photo, title, price in the buyer's currency (other currency
  small), discount badge, Sold out / Only N left (Pro, Advance), + button.
- Floating cart bar: item count, goods total, "View cart".
- Closed notice when the shop is paused.
- Shop name and logo from the seller's profile. Tapping a card opens B2.
- One line under the name: "Delivery from $1.00 · Pickup · Provinces" and
  a call button; it opens "Shop info" (every district and fee, pickup
  address and hours, provinces, how to pay).
- Grey placeholder blocks while loading.
- Later (needs the backend): real rating and delivery time.
- **Change (shop profile, built):** the top reads like a profile in a phone
  app — logo, name, Open now, then one row of round buttons: Call (phone),
  Map (Google Maps), Telegram, Facebook, Shop info. A button shows only when
  the seller filled that in. No description, numbers bar or VAT TIN; the
  "Delivery from …" button and call icon are gone. "Shop info" opens the
  delivery and payment sheet, which ends with the shop's number.
- **Change (Shop info sheet, built):** the header keeps only logo, name,
  Open now and one "Shop info & contact" row. The sheet holds the round
  buttons (Call, Map, Telegram, Facebook — each opens the phone's own app),
  then Contact (phone → call, address → map, opening hours), Delivery (each
  Phnom Penh zone with its fee, provinces, pickup) and How to pay. One sheet
  component for the live shop and the mockup.

### B2. Product detail — Built · L
- Photo carousel (swipe, dots), title, description.
- Price with discount; options (size/colour) as chips with their own price
  and stock; quantity stepper.
- "Add to cart" full width, pinned to the bottom, with the amount.
- On a phone: opens as a bottom sheet over the shop page. Tablet and
  desktop: a centred window with the photo beside the details. Also
  reachable by its own link, `?product=ID` on the shop page (for Facebook
  and TikTok posts), with a Share button.
- Nothing reaches the cart until the button is pressed; an item already in
  the cart opens with its quantity and the button reads "Update cart".
- Later (needs the backend): photo and title in the link preview.

### B3. Cart — Built · L
- Lines with photo, name, price, − / + (capped at stock), remove.
- Add more items; promo code; summary (subtotal, discounts, delivery fee,
  VAT); total in the buyer's currency with the other one small.
- "Checkout" pinned to the bottom.

### B4. Checkout (one page) — Built · L
- Name; phone (+855 prefix).
- **How to get it:** two cards — Delivery (with fee) or Pickup (free, shows
  the shop's pickup address and hours).
- **Where (delivery only):** Phnom Penh → choose district (fee from the
  shop's zones); Province → choose province (sent by bus, fee shown).
  Landmark / note (optional).
- Pay in: USD / KHR.
- Payment cards: only what the shop has set up — KHQR, ABA PayWay, Cash on
  delivery (Phnom Penh delivery or pickup only).
- Order summary; "Place order · total" pinned to the bottom.
- "Remember my details on this phone" (on by default).
- Later: a map pin for the exact spot.

### B5. KHQR payment — Built · L
- Official KHQR card: red header with the KHQR mark, shop name, amount,
  currency, dashed divider, QR with the Bakong mark in the centre.
- Countdown (10:00); "Open bank app"; "Save QR".
- Moves to B6 by itself when paid, after a 1.5-second "Paid!" moment with
  Mio (see Mascot). Expired state with "Try again".
- Time bar and "pay within 10 minutes or the order is cancelled"; three
  "how to pay" steps.
- The QR is scannable but its content is a mock until Bakong is connected.

### B6. Order status — Built · L
- A link the buyer can reopen any time (also sent on Telegram).
- Header: order number and the current status in plain words.
- Status steps (design standard §7) with the time of each step.
- Out for delivery: driver name and phone, tracking link; or bus company
  and ticket number for provinces.
- Items, fees, total paid; delivery or pickup details; shop phone (tap to call).
- Buttons by status: "Pay now" (awaiting payment), "Cancel order" (before
  packing), "Order again" (delivered).
- Cash on delivery orders land here directly, as "COD pending".
- **Change:** today this is a one-time "Order placed" screen with no
  statuses and no link.
- **Change (invoice):** shows the order's tracking code (copy button) and a
  "View invoice" button (B7); "Order placed" says to keep the code to track
  the order without Telegram.

### B7. Invoice / receipt `/o/[token]/invoice` — Built · L
- One document for buyer and seller (the seller opens it from S5).
- Header: shop logo, name, phone, address (the pickup address), tax number
  (VAT TIN) and Telegram / Facebook page — each only when the seller set it.
- Title "Invoice" until the order is paid or completed, then "Receipt";
  order number, date, tracking code; a stamp: UNPAID / PAID / CANCELLED.
- Buyer: name, phone, delivery address and landmark, or "Pickup at the shop".
- Items: product, option, quantity, unit price, line total. Totals:
  subtotal, discount, delivery, VAT, total in the order's currency with
  "≈" the other currency underneath — the saved amounts, never recomputed.
- Payment: cash on delivery or KHQR (with reference when paid).
- Footer: the seller's invoice note (e.g. warranty), a QR code to the order
  page, "Thank you".
- Two sizes: A4 and 80 mm receipt (switch above the document).
- Buttons (never printed): Print · Download PDF · Save image · Share (the
  phone's share sheet with the file, for Telegram, Messenger…). The PDF and
  image are a picture of the document, so Khmer always renders correctly.

### B8. Track my order `/track` — Built · L
- For buyers without Telegram: tracking code + phone number → B6.
- The code is 8 letters and digits without look-alikes (no 0/O, 1/I),
  shown as `MEK-7K4P-9QXR` (first three letters of the shop's link, then the code).
- Wrong code or phone: one message for both ("We couldn't find that
  order"), never which one was wrong; too many tries are slowed down.
- Linked from the shop page footer, the "Order placed" screen and B7's QR.
- **Change (back to the shop, built):** Track my order and My orders
  (`/orders`) have the top bar with a back arrow. The shop page's links add
  `?shop=<link>`, so back returns to that shop; opened directly, back goes to
  the shop of this phone's latest order, else Khmio's home page.

## Seller

Phone first; sidebar from tablet width; tables on desktop.

### S1. Login — Built · L
- Continue with Telegram; Continue with phone (SMS code). Google later.
- Mio's face at the top (see Mascot).

### S2. Onboarding — Built · L
- Step 1 business type; step 2 shop name, link, optional logo.
- "Your shop is ready": QR code, copy / share link.
- The dashboard checklist (S3) takes over the remaining steps from the
  onboarding workflow, in this order: add products → connect payment
  (Bakong ID) → set delivery → connect Telegram → place a test order →
  share the link. Logo and verification sit underneath as "Good to have".

### S3. Dashboard home — Built · L
- Setup checklist until its six steps are done; plan / payment banner.
- Numbers from the real orders: orders to handle, sales today, cash to
  collect. Dollars and riel are shown side by side, never added together.
- Orders needing action (newest first, five shown) with the next button on
  each; "All caught up" when there are none.
- Sales chart with Today / 7 days / 30 days — sample data until the
  backend has daily totals, and labelled so.

### S4. Orders list — Built · L
- Tabs with counts: To confirm · Packing · Sending · Delivered · Problems
  (cancelled, failed delivery) · All.
- Search by order number, buyer name or phone; date filter.
- Card (phone/tablet) or table row (desktop): order number, buyer, total,
  payment (KHQR paid / COD), delivery or pickup, time, status, next button.
- Uses the shared data grid. Empty list: Mio above "No orders yet".

### S5. Order detail — Built · L (delivery booking: 2)
- Status header with the one next button (design standard §7).
- Items; totals; payment (paid by KHQR with reference, or COD amount to collect).
- Buyer: name, phone (tap to call), address, landmark.
- **Send the order** — three routes: own or partner driver (driver name,
  phone, fee; phase 2: quote and tracking link by Telegram) · buyer picks
  up · province bus (company, ticket number).
- COD: "Cash received from driver" before the order completes.
- Problems: cancel with a reason; failed delivery → rebook.
- Print or share the order slip. **Change (invoice):** "Invoice" opens B7 for this order;
  search also finds an order by its tracking code.
- Desktop: two columns (order on the left, actions and timeline on the right).

### S6. Products list — Built · L
- Data grid: search, category / brand / unit filters, bulk delete, export.
- Later (2): "Import" from Google Sheets or Excel.

### S7. Product form — Built · L
- Photos (up to 6); Khmer title, English title + auto-translate;
  category, brand, unit; discount; retail price USD / KHR with auto-fill;
  wholesale price (Pro+); options with their own prices.
- Description in Khmer and English (shown on B2); "Show in shop" switch —
  a hidden product leaves the shop and any cart, and nothing is deleted;
  a new product is kept as a draft on the device while it's typed.
- Later: "Write it for me" from a photo (AI) — shown as "Coming soon".

### S8. Delivery settings — Built · L
- Phnom Penh zones: districts grouped into zones, each with a fee.
  Districts in no zone aren't delivered to.
- Pickup: on/off, address, opening hours.
- Provinces: on/off, bus fee, note for buyers.
- Drivers: own and partner drivers (name, phone) for "Send the order".
- Later: free delivery above an order amount.
- **Change (shop details, built):** pickup is set on S10 with the shop
  address; here it is one row ("Pickup is on · address · hours — Change")
  linking to S10. Delivery still refuses to switch off the last way to get
  an order.

### S9. Store settings — Built · L
- Default currency, exchange rate, VAT, cash on delivery, online stock location.
- Delivery fees are on S8; this page links to it.
- **Change (into S10, built):** no longer its own page. Cash on delivery
  joins "Getting paid" on S10; currency, exchange rate, VAT (and the
  Advance-plan online stock location) are S10's "Prices & tax" group, saved
  with the rest. The old address opens that group.

### S10. Shop profile — Built · L
- Shop details, getting paid (Bakong ID), order alerts, login methods.
- **Change (invoice):** an "On your invoices" section — tax number (VAT TIN),
  invoice note (up to 300 characters), Telegram and Facebook page; with a
  small preview of the invoice header.
- **Change (grouped, built):** one form in groups, with jump links at the
  top — Your shop · Location and pickup (shop address, Google Maps link with
  a "Check your map link" test, pickup on/off and hours) · Getting paid
  (Bakong ID, cash on delivery) · Prices & tax (currency, exchange rate in
  the allowed band, VAT; Advance: online stock location; once S9) ·
  On your invoices (VAT TIN, Telegram, Facebook, note, header preview) ·
  Alerts. One Save. The map link is what the buyer's Map button opens; without
  it the button searches for the address. Pickup can't be switched off when
  it's the shop's only way to get an order (once delivery is set up). The
  separate "On your invoices" page is gone; its old link opens this group.

### S11. Verification (KYC) — Built · L
### S12. Plan and billing — Built · L
### S13. Stock — Built · L (Pro, Advance)
- **Live, part 1 (Pro, main branch):** `/m/stock` from the Products page:
  each product option with its count, "Not tracked" until the seller starts
  it from a count, Low / Out marks, stock in and corrections (reason; "Other"
  needs a note), stop tracking, and the latest changes (sales and returns
  name their order). Online cash orders and counter sales take stock in the
  same transaction and are refused when too little is left; cancel and void
  put it back. Buyers see "Sold out" and "Only N left", and the cart and the
  counter stop at what's left. Lower plans see their counts, locked.
- Part 2 (Advance): several warehouses and branches, transfers, which
  location the shop and each counter sell from, KHQR reservations.

### S14. Customers — New · 2
- Buyers with order count, total spent, last order; buyer detail with history.

### S15. Discounts — New · 3
- Promo codes (percent or amount, dates, limit); today codes are sample data only.

### S16. Staff — New · 3
- Invite by phone; owner / staff roles.

### S17. Reports — New · 3
- Daily sales, best sellers, delivery success rate.

### P. Sell in shop (counter) — Built · 2 (Basic and up)
Selling to a customer standing at the counter; owner only in v1, needs
internet. Plan feature `counterSales` (packages/shared plans.ts).
- **P1 Sell** `/dashboard/sell`: the shop's products (search, categories,
  grid or list) — tap + to add, a product with options opens its options.
  The sale beside them on a laptop (CounterCart: − n +, subtotal, discount,
  VAT, total, the other currency small), a Charge bar on a phone. Currency
  of the sale ($ or ៛) at the top; "Today · n" links to P4.
- **P2 Take payment**: the sale (still editable), then Cash or Shop QR.
  Cash: one-tap amounts (exact, then the notes a buyer hands over), cash
  received, change to give. Shop QR: the seller's own uploaded KHQR with the
  exact amount; the seller ticks "I see {amount} in my bank app" only after
  checking their bank app — Khmio never sees this payment. Customer name and
  phone optional. Complete sale.
- **P3 Done**: "Sale complete", the change to give in big type, Receipt
  (the invoice screen at 80 mm, no order QR or tracking code) and New sale.
- **P4 Today's sales** `/dashboard/sell/today`: totals (all, cash, shop QR;
  dollars and riel never added together), each sale with time, items,
  method and its receipt; Void (with the money handed back by the seller).
- **Payment QR** on S10 › Getting paid: upload the picture of the KHQR the
  bank app makes, with "How to get your payment QR" — a 7-step guide (open
  the bank app, find Receive / My QR / KHQR, pick the account, no amount,
  save as a picture, upload, test once) and a warning never to trust a
  customer's screenshot.
- Later: Bakong KHQR with a confirmed status, stock taken off (Pro, Advance),
  shifts and end-of-day count, staff and permissions, offline sales.

## Admin (laptop first)

### A1. Overview — Built
### A2. Merchants — Built
### A3. KYC review — Built
### A4. Plans — Built (read-only)
### A5. Audit log — Built
### A6. Settings — Built
### A7. Subscriptions, Invoices — Built · L
- Subscriptions: every store's plan, status and what happens next; tabs for
  renewing this week, overdue, paused, trial ending; extend a period.
- Invoices: list with KHQR reference; statuses Due, Overdue, Paid, Void.
  "Mark as paid" by hand needs a bank reference and reopens the shop;
  "Void" needs a reason. Both go to the audit log.
### A8. Buyer payments, Failed checks — Built · L
- Buyer payments: today's attempts across all stores, read-only; totals per
  currency, never added together.
- Failed checks: attempts a person must look at (no answer, wrong amount,
  wrong currency, paid after expiry). "Check again" or "Close with a note" —
  never "mark as paid".
### A9. Admin users — Built · L
- Roles Owner, Support, Finance from packages/shared admin-roles.ts, with a
  table of what each can do. Invite by Telegram, change role, disable (never
  delete). There is always one active Owner.
- Later (needs the backend): enforcing roles per admin, and 2FA login.
- New role **Website editor** (with A10–A12): may edit, preview and publish
  website content, nothing else — no shops, money or settings.

### A10. Website pages — Mockup · Website
- List of pages (Home, each product page, Pricing, Help, Terms, Privacy):
  status (published / draft changes), last published, by whom.
- A page: its sections in order, each with on/off, move up/down, edit,
  remove; "Add section" from the site kit. Editing opens a form built from
  the section's schema, with Khmer and English side by side (tabs on a
  phone) and the usual field checks.
- Link preview: title, description, picture.
- **Draft → Preview → Publish.** Edits stay a draft until Publish; Preview
  shows the page exactly as visitors will, at phone and desktop width.
  Publish refuses a page with missing Khmer or English text or a picture
  without a description, and lists what's missing.
- History: every published version with date and editor; "Restore" makes
  that version the new draft. Publish, restore and remove go to the audit
  log.

### A11. Promotions — Mockup · Website
- A promotion is a "Promotion banner" section of one website page, so A10
  and A11 always show the same thing; edits go to that page's draft and go
  live when the page is published (a "Publish <page>" button here).
- List with filters: title, where it shows (page and position), start and
  end, status (showing / scheduled / ended / switched off / not published
  yet), "changes not published", on/off.
- Form: page (when new) and position, then title, line, picture, button
  text and link (Khmer and English), start and end date and time (Phnom
  Penh time). A new one starts at the next full hour and runs a week. An
  end before the start is refused.
- Promotions are switched off, never removed — here or in A10 — so the
  record of what ran when is kept.

### A12. Pictures — Mockup · Website
- Library of uploaded pictures: thumbnail, description (Khmer and English),
  size, where it's used (live page, draft, or an earlier version). Upload
  shrinks the picture in the browser first (as product photos do) and needs
  both descriptions.
- Pages point to a library picture as "library:<id>"; every picture field
  in A10 and A11 has "Choose from the library", which also fills in the
  description (still editable).
- A picture in use — live, in a draft or in a version that could be
  restored — can't be deleted. Replacing its file updates every page that
  uses it right away, after a confirmation that names those pages.

### A13. Backups — Built (list, Backup now, restore test) · Go-live; restore one shop's catalog: Mockup, after go-live
Decided 2026-10-06. The nightly backup already exists (go-live step B3):
the worker backs up the whole database at 03:00 Phnom Penh time into the
private R2 bucket `khmio-backups`, keeps every backup 14 days and the newest
three always, and tells the admin alerts chat when one fails. This screen
makes it visible, adds "Backup now", and lets one shop's catalog go back to
a backup — never orders or money.

**Backups list**
- The latest successful backup at the top: when, how big, how long it took.
  A red banner when the latest success is older than 26 hours ("the nightly
  backup didn't run") with the failure reason if there is one.
- A table of backups: date and time, nightly or manual (and who started
  it), size, status (done / failed + reason), kept until.
- **Backup now** — confirm, then queued → running → done, shown live. One
  at a time: the button waits while a backup runs. Every manual backup goes
  to the audit log.
- **No download button, ever.** A backup holds every buyer's phone and
  address; it stays in the private bucket. (The restore procedure reads it
  from there.)

**Full restore — a procedure, not a button**
- A card explaining that restoring the whole platform replaces the live
  database, so it is done by hand, step by step, never from the admin: the
  steps from `docs/go-live.md` "When something goes wrong" (restore into a
  new database, compare the counts it prints, then switch the app over),
  with a link to them.
- The monthly restore test (blueprint "The routine") is recorded here: the
  date it last passed, so a forgotten test is visible.

**Restore one shop's catalog** ("undo the shop's catalog changes")
- For when a seller deleted or broke their products or settings by mistake.
- Steps: choose the shop (search by name, link or phone) → choose a backup
  (date) → choose what comes back (all ticked by default):
  - products, their options, prices, descriptions and photos;
  - categories, brands and units;
  - shop settings and delivery zones.
- **Never restored:** orders, payments, buyers, stock movements,
  subscription and invoices — they are records of what really happened and
  only move forward. Old orders are safe anyway: each order line keeps its
  own copy of the title and price.
- **Preview before anything changes:** counts and lists of what will come
  back (deleted since the backup), what will be removed (added since), and
  what will change, per kind; products that have orders since the backup
  are marked (their orders keep their own copy, and the product is hidden
  rather than removed).
- **Confirm** by typing the shop's link (e.g. `sokha-coffee`). Just before
  the restore, the system takes an automatic backup of that shop's current
  catalog, so the restore itself can be undone the same way.
- After: the audit log records the shop, the backup date and the counts;
  the seller gets a Telegram message ("Your shop's catalog was restored to
  <date> by Khmio support").
- Photos come back only if their files still exist: photo files are never
  deleted while any backup could still need them (at least the 14 days
  backups are kept).

**Who may do what** (new permissions in `packages/shared/admin-roles.ts`)
- `backups_view` — the list and the procedure: Owner, Support, Finance.
- `backups_run` — Backup now: Owner, Support.
- `shop_restore` — restore a shop's catalog: Owner only.

**Done when:** at go-live the list shows the first nightly backup; Backup
now creates one that appears in the list and the audit log; a shop whose
products were deleted gets them back (with photos) from the morning's
backup, its orders untouched, and the seller is told on Telegram.

### A14. Waitlist — Built · Website
Built 2026-10-07 with the live website (no separate mockup: a read-only
list in the A5 audit log's style). Admin → **Waitlist**: the people who
asked on a coming-soon product page (P3) to hear when it opens.
- Filter chips: All products, then one per coming-soon product with its
  count ("Khmio Class · 12"). The counts are the evidence for choosing the
  second product (docs/platform-launch-plan.md Stage 5).
- Each row: when, name, phone (tap to call), business type, product.
  Newest first, 100 at a time, "Show older".
- Read-only. Owner and support only (`merchants_manage`): it holds phone
  numbers; finance sees "only an owner or support can see the waitlist".
- Signing up again with the same phone for the same product updates the
  row; the visitor sees the same thank-you either way.

## Platform website (Khmio)

The public site on `khmio.com` that presents every product, from
docs/platform-launch-plan.md Stage 3. Mockups live under `/mockup/site`;
the live pages (`/`, `/pricing`, `/products/<id>`) are built (2026-10-07)
from the same content in `apps/web/site/content.ts`, until the admin can
edit it. The live site hides links to pages not built yet (Help, Terms,
Privacy) and seller stories marked as samples. Brand rules:
design/brand-guide.md. Visitors arrive from social media on a phone, often
inside the TikTok or Facebook browser: phone first, fast, one clear action.

**Edited from the admin, not in code.** Every page is a list of sections
from one fixed set (the site kit below). Text, pictures, promotions and
product cards are content: the admin edits it (A10–A12), previews it and
publishes it, and the site shows it within seconds — no code, no deploy.
The admin never moves boxes freely: the code always decides the layout,
fonts, colours and spacing, so whatever is typed looks right on a phone.
The mockups read sample content shaped exactly like the future database,
so switching to real content changes only where it comes from.

**Site kit — the only section types** (one component and one Zod schema
each, in shared packages; the schema also builds the admin form, so a new
field never needs a new admin screen). Every product's website — Shop now,
Class and Rent later — uses the same kit, tokens, font and Mio.

| Section | Editable content |
| --- | --- |
| Announcement bar | One short line, a link, on/off |
| Hero | Headline, sentence, picture or Mio pose, two buttons (text + link) |
| Steps | 3–4 steps: title, line, icon |
| Product cards | Taken from the product list (name, subtitle, picture, live / coming soon) |
| Features | Title, two lines and a picture per feature |
| Promotion banner | Title, line, picture, button, start and end date and time |
| Plans | No editable prices: always read from `plans.ts`; only the heading and the highlighted plan |
| Questions | Question and answer pairs |
| Seller story | Name, shop, photo, quote, and a required "seller gave permission" tick |
| Closing band | Headline, line, button |
| Waitlist form | Heading and thank-you text; the fields are fixed |

Rules for all content: Khmer and English both required before publishing;
every picture has a short description in both languages (screen readers,
search); links only to `khmio.com` pages or https sites; a section can be
switched off and the sections reordered; each page has its link-preview
title, description and picture for Facebook and Telegram.

Every page shares:
- **Header:** khmio wordmark (links home) · Products · Pricing · ខ្មែរ/EN ·
  "Log in" (text link) · "Start free" (the one main button). On a phone the
  links fold into a menu; "Start free" stays visible. The announcement bar,
  when on, sits above it.
- **Footer:** the products, Pricing, Help, Contact (Telegram support),
  Terms and Privacy (edited in A10; placeholders until the legal text
  exists), language, "© Khmio".
- Prices only from `packages/shared/plans.ts` — never typed in the admin;
  products only from one list of platform products. A product not built
  yet is always "Coming soon", never a date.
- A promotion shows only between its start and end time, by itself.

Pages P1–P4 below list their starting sections, in order; the admin can
change their content, switch them off, reorder them or add a promotion
banner anywhere.

### P1. Home — Mockup · Website
- Hero: Mio (coin pose), the tagline លក់ងាយ ទទួលលុយរហ័ស with its English
  line, one sentence on what Khmio does, "Start free" and "See pricing".
- How it works in 3 steps: open your shop → share the link → get paid by
  KHQR and alerted on Telegram.
- Products: one card each. Khmio Shop ("Start free", "Learn more"); Khmio
  Class and Khmio Rent marked "Coming soon" with "Join the waitlist".
- Why sellers switch: no more payment screenshots, orders in one list,
  Khmer first, works in the Telegram/Facebook browser.
- Seller story: a placeholder card, clearly marked as sample until a real
  seller agrees.
- Closing band: "Start free — 14 days, no card" and the button.

### P2. Product page: Khmio Shop — Mockup · Website
- Title, Khmer subtitle (ហាងអនឡាញ), one-line promise, "Start free".
- Features, each with a phone picture (a real screenshot later, a framed
  placeholder now) and two lines: shop link; KHQR checked by itself;
  Telegram alerts with a Confirm button; delivery and pickup; stock (Pro);
  branches and warehouses (Advance).
- "Which plan?" — a short row of the four plans linking to P4.
- Questions: three or four answers (Do I need a website? Which banks? Is
  my money safe? Can I cancel?).

### P3. Product page: coming soon (Class, Rent) — Mockup · Website
- One page for every product not built yet (`/products/class`,
  `/products/rent`), filled from the product list.
- Title, Khmer subtitle, "Coming soon", what it will do in three points.
- **Waitlist form:** name, phone (the usual phone rules, +855 prefix),
  business type (teacher / school, landlord, other), the product preset.
  Checked by a Zod schema from `packages/shared`; problems shown under the
  field. After sending: a thank-you state with Mio and "We'll message you
  on Telegram or by phone when it opens" — no date.
- The mockup keeps sign-ups on the device only; the real form saves them
  (one platform table, bot check and rate limit) when the site is built.

### P4. Pricing — Mockup · Website
- Khmio Shop plans (the Plans section — not editable prices): Free, Basic, Pro, Advance, from `plans.ts`: monthly
  price, in USD or riel by a toggle (never both added), product limit,
  the trial for Free, and the plan's features.
- Basic marked "Most shops start here"; each card's button: "Start free".
- A comparison table under the cards (cards on a phone, table from tablet).
- How paying works: one KHQR bill a month, no card, no automatic charge,
  cancel any time; data is locked, never deleted (blueprint "Subscription
  tiers").
- Class and Rent: "Coming soon — join the waitlist" with links to P3.

## Account hub (My Khmio)

After login, the one place a customer sees and controls every product they
use, from docs/platform-roadmap.md Phase 1. Mockups under
`/mockup/account`: a header with the logo, language, theme and the app
switcher, and three tabs (My apps · Subscriptions · Account).

### H1. My apps — Mockup · Hub
- A card per product: Khmio Shop (shop name, plan, status, "Open
  dashboard"); Class and Rent ("Join the waitlist", or "On the waitlist ✓").

### H2. My subscriptions — Mockup · Hub
- Per product: plan, status (trial / active / payment due / paused), next
  bill date and amount, "Pay by KHQR", "Change plan"; payment history.
  The rules are the Shop's S12 and blueprint "Subscription life cycle", so
  "Pay by KHQR" and "Change plan" open the Shop's billing page (S12): the
  money logic lives in one place. Products not built yet say "coming soon".

### H3. Account — Mockup · Hub
- Name, login methods (Telegram, phone), language.

### H4. App switcher — Mockup · Hub
- In the seller dashboard (sidebar and phone header) and in My Khmio: Shop ·
  Class · Rent · My Khmio; the current one is ticked; products not open to
  this account show "Coming soon" and lead to their website page. On a phone
  the menu spans the screen.

## Build order

Buyer first, then the seller screens the buyer flow depends on.

1. ~~B4 Checkout + S8 Delivery settings~~ — done.
2. ~~B5 KHQR card~~ — done.
3. ~~B6 Order status + S4 Orders list + S5 Order detail~~ — done.
4. ~~B2 Product detail + S7 product form changes~~ — done.
5. ~~B1 Shop page changes; S2 / S3 checklist and dashboard changes~~ — done.
6. ~~Admin A7–A9~~ — done.
7. Platform website: the site kit sections, then P1–P4 from sample
   content; then the admin website screens A10–A12; then the account hub
   H1–H4. Mockups only — the content backend is its own roadmap step.
8. ~~Admin A13 Backups mockup, then the list, Backup now and the restore-test date~~ — done (`/admin/backups`, table `backup_runs`). Restoring one shop's catalog after go-live.
9. Phase 2 and 3 screens.
