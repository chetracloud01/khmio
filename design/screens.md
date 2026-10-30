# Screens

What each screen contains. How it must look and behave is in
`design/design-standard.md`. Phone first (360 px), then tablet and desktop.

Status: **Built** = a live page in the app that matches the docs · **Spec** = written here, not built yet
(an old mockup of it may be in git tag v0.5.1) · **Change** = exists, needs the changes listed · **New** =
not designed in detail yet. Screens are built as live pages only, and tested with the Demo Garage first
(docs/blueprint.md "Garage first").
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
| B5 KHQR payment, paid | Mio with a riel coin, a small hop, "Paid!", then B6 | Spec |
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
  component.

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
- **Live** (2026-10-27): `/o/<token>/pay`, from checkout and the order page's
  "Pay now"; one KhqrPayPanel (also shown on /styleguide). Paid only by
  the worker's bank check (the page asks every 3 s). Expired = the order was
  cancelled, so "Order again" instead of "Try again". "Open bank app" waits
  for Bakong's link. With `KHQR_PROVIDER=fake`, "Pay with the test bank".

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
- Numbers from the real orders. Dollars and riel are shown side by side,
  never added together.
- **Business dashboard (2026-10-29, replaces the first redesign):** a short
  summary of the business, each block opening the report behind it.
  - **Needs you now** (only what has something to do; else "All caught up"):
    orders to handle → Orders; cash to collect → Sales report, Cash to
    collect; items to reorder → Stock, Reorder (plans with stock); bills
    overdue → Purchases, overdue (plans with stock).
  - **Sell in shop**, then the setup checklist.
  - **Business overview**, one filter **Today · 7 days · 30 days**, each
    figure ▲/▼ against the period before (yesterday, the 7 or 30 days
    before): six headline figures — Sales, Orders, Average order, then Gross
    profit and Margin (in points) on Pro (else In the shop and Online), then
    Stock worth with items to reorder (plans with stock; else Cash to
    collect) — with a small trend line where there's one.
  - **Sales trend:** in the shop and online stacked, today by hour (from
    6:00, or the first sale, to now), else by day, the period before dashed.
    **Where sales came from:** in shop vs online ring, top 3 ways buyers
    paid.
  - **Profit snapshot** (Pro): net sales, cost of goods, sales without a
    cost price (left out), gross profit and its margin, stock lost (net of
    found), profit — the P&L statement cut short. **Best sellers:** top 5,
    each opening the product.
  - **Bills to pay** (plans with stock, as of today): the payables ring, due
    in 7 days, goods not received. **Latest orders:** the 5 newest, each
    opening the order.
  - **Reports:** every report one tap away, with the plan it comes with.
  - Below a plan: the profit or stock block is an upgrade card, not a gap.
  Money: the shop's currency leads, the other under it; charts and changes
  turn the other currency at the shop's rate (said under the chart). Built
  from `apps/web/components/dashboard` (NeedsYouStrip, KpiLink,
  SalesTrendCard, SalesMixCard, ProfitSnapshotCard, BestSellersCard,
  LatestOrdersCard), `components/home` (ChartCard, ChangeText, Sparkline,
  PayablesCard) and `components/reports/report-links.tsx`, all on
  /styleguide. API: `GET /dashboard?period=` (packages/shared dashboard.ts,
  from the sales report and P&L sums for both periods, so the dashboard and
  the reports agree); `/orders/summary` is now only orders waiting and cash
  to collect. `/orders/profit` is gone (the P&L replaces it).

### S4. Orders list — Built · L
- **Status tiles (2026-10-29)**, over every order: To confirm · Packing ·
  Sending · Cash to collect (cash on delivery not completed or cancelled) —
  each its count and amount — · Problems (a count, with how many weren't
  delivered) · Sales today (opens the Sales report). Tapped, the list
  follows; "Report" opens the Sales report. From `GET /orders/status`
  (packages/shared order-status.ts).
- Tabs with counts: To confirm · Packing · Sending · Delivered · Problems
  (cancelled, failed delivery) · Cash to collect · All.
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
- **Status tiles (2026-10-29):** Products (how many the shop shows) ·
  Hidden · On discount · No cost price (their profit can't be known) · No
  photo — tapped, the list follows (same-named chips) — and, with stock, Low
  or out of stock (opens Stock › Reorder). "Report" opens Profit & loss.
  Rules in `components/products/product-tiles.ts`.
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

### S11. Verification (KYC) — Spec · L
### S12. Plan and billing — Spec · L
### S13. Stock — Built · L (Pro, Advance)
- **Live, part 1 (Pro, main branch):** `/m/stock` from the Products page:
  each product option with its count, "Not tracked" until the seller starts
  it from a count, Low / Out marks, stock in and corrections (reason; "Other"
  needs a note), stop tracking, and the latest changes (sales and returns
  name their order). Online cash orders and counter sales take stock in the
  same transaction and are refused when too little is left; cancel and void
  put it back. Buyers see "Sold out" and "Only N left", and the cart and the
  counter stop at what's left. Lower plans see their counts, locked.
- **Live, the Stock list (2026-10-28):** the shared data grid — product, status,
  on hand, cost and value; filter chips Out · Low · In stock · Not tracked;
  search by name or SKU; sort by any column; export. Each row has its quick
  change (Stock in, Correct, or Start tracking); selecting rows starts
  tracking many at once, each from its own count (all or nothing). Services
  aren't listed: they have nothing on a shelf.
- **Live, purchases with cost (Pro, 2026-10-28):** stock in asks for the cost
  of one (in the product's cost currency; a product without one picks $ or ៛
  there) and a supplier (optional); the product's cost becomes the moving
  average. Each row shows its cost; a **Stock value** card shows on hand ×
  cost (dollars and riel apart, and how many items have no cost yet); the
  history shows each purchase's cost and supplier.
- **Live, suppliers and bills (Pro, 2026-10-28):** Stock in is now a one-line
  supplier bill, and its cost is required (stock found without a bill is a
  correction). **Purchases** (`/m/purchases`, from the Stock page): every
  bill and return in the data grid — bill, date, supplier, kind, total; chips
  Bills · Returns; search by supplier, their bill number or ours. **New bill**
  (`/m/purchases/new`): supplier (or none; add one there), the day on the
  bill, their bill number, one currency for the whole bill (an item whose
  cost is kept in the other currency is turned at the bill's rate — a Rate
  box shows, starting at the shop's rate; the line shows "= $24.39 each" and
  the bill keeps "Rate used"), then the items — search
  and tap to add, how many and the cost of one, the line and bill totals.
  Saved all at once: stock goes up, each cost moves to the average, an item
  not tracked yet starts from the bill. **Bill** (`/m/purchases/:id`): its
  details, lines and returns; never edited — **Send back to supplier** takes
  up to what the bill brought in (less earlier returns) and what's on the
  shelf; stock goes down, the average stays. **Suppliers** (`/m/suppliers`):
  name (one per shop, any case), phone, note, how many bills; archive or use
  again, never deleted. The history names each bill and return.
- **Live, stock count (Pro, 2026-10-28):** **Count stock** (`/m/stock/count`,
  from the Stock page): every item with its count on record and a "Counted"
  box; search; show all or differences only; each typed box shows its +/−.
  Only typed boxes are saved, all at once: each difference is a count
  correction, an item not tracked yet starts from its count, a count below
  what's held for unpaid KHQR orders is refused. On the product form, a
  tracked option's cost is shown, not typed (it's its bills' average), and
  the product's cost currency is fixed once a tracked option has a cost; the
  API keeps both whatever the form sends.
- **Live, count documents (2026-10-29; the ERP physical inventory):** a
  count is **CNT-…**, a draft until applied. With no draft, the Count tab
  asks **What are you counting?** — All items or Chosen categories — and
  **Start count**, over **Past counts** (number, started, what was counted,
  items, net value, status; each opens read-only at
  `/m/stock/count/:id`). With a draft, the count sheet: CNT-… and its
  status, what it covers, **Counted n of N** (a bar), Fill with counts on
  record, Cancel count; the items in its range with On record, the Counted
  box and the difference in units and money; chips **Not counted yet**,
  Differences only, and the levels. Each box saves a moment after typing
  stops ("All saved — you can stop and carry on later"), so it continues on
  any device; each item keeps what the app had when it was typed. The bar
  at the bottom: **Lost −$… · Found +$… · Net** (items without a cost
  counted apart) and **Apply count**, which asks first ("n items change ·
  Net …") and puts counted − expected onto today's stock — a sale made while
  counting is never a loss. Cancelled: nothing moves. One draft per shop.
- **Redesign (2026-10-28): Stock is its own area,** in the side menu under
  Orders (every plan; lower plans see the upgrade); on a phone, a Stock
  button at the top of Products and Orders. Every Stock page has the same
  header (title, **Count stock** and **New bill** top-right) and one tab row:
  **Stock · Purchases · Suppliers · Count** (`components/stock/stock-area.tsx`).
  Each list is the shared data grid like Products and Orders: search, chips,
  the filter panel, sort, pages of 20, row numbers, the address keeps the
  view, export, cards on a phone. Stock: summary cards (value, out, low, not
  tracked), a Category column, filters category · brand · cost currency ·
  cost or not. Purchases: filters supplier · currency · date (this month,
  last month, this year) and a **Bought** card (bills less returns for what
  the list shows). Suppliers: total bought and last bill; a row opens their
  bills; Edit and Archive on the row. New bill: a search box at the top
  (Enter adds the top match; a scanned barcode finds its SKU), the lines as
  a table on a laptop and cards on a phone, quantities with − + (kit
  `QuantityInput`), Enter moves from box to box and back to the search.
  Count: the same grid with a Counted box (− +) and the difference per row,
  a "Differences" chip, "Fill with counts on record", Enter moves down.
- **Live, numbers, reorder and payments (Pro, 2026-10-28):** documents are
  numbered per kind — **BILL-0001**, **RET-0001**, **PAY-0001** — and found by
  them in the search (BILL-12, RET 3, #12). **Reorder:** each tracked item may
  have a minimum and a maximum (the stock sheet's "Reorder levels", or many at
  once from the selection); at or below its minimum (5 without one) it's **To
  reorder** — a chip, a summary card, a Reorder column, and an Order column
  with the suggested quantity (up to the maximum, or twice the minimum), with
  its last supplier and cost. Select items → **Create bill** opens New bill
  already filled (quantities, last costs, their shared currency and
  supplier); nothing is saved until Save. **Payments:** New bill has **Paid
  now** (on; cash, bank, KHQR or other) or, off, a due date; quick Stock in is
  paid in cash. The bill's **Payments** section shows total, sent back, paid,
  still owed (or what the supplier owes back) and Unpaid · Part paid · Paid ·
  **Overdue**; **Record payment** pays all or part (never more than owed, in
  the bill's currency); a payment made by mistake is **voided** (kept,
  crossed out). Purchases: Payment and Owed columns, a payment filter and an
  **Owed to suppliers** card; Suppliers: an Owed column.
- **Live, brief and detail (2026-10-28):** the Stock list fits a laptop
  (Item with SKU and category · Status · On hand · Value · Order · one
  **Stock in** button; Category, Cost, Reorder at and Last supplier under
  View) and shows the latest 10 changes; a row opens the **item's page**
  (`/m/stock/:id`: on hand, free to sell, average cost, value; reorder
  levels with **Create bill**; the bills that bought it; its history; Stock
  in, Correct, Reorder levels). A Suppliers row opens the **supplier's page**
  (`/m/suppliers/:id`: call, edit, archive, New bill; bought, owed, bills,
  last bill; their bills in the Purchases list). The bill page starts with
  the same number cards (date, total, paid, owed). Phone: names on two lines,
  search on its own line with labelled Filters and View under it, four
  compact tabs, and on Count the box under each name with a one-line save bar.
- **Live, change stock and opening stock (2026-10-29):** (the **How stock
  works** card that stood here was removed on 2026-10-29: the tiles come
  first, and Change stock names each reason.) A tracked row's button is
  **Change stock**: pick **Bought from a supplier** (a one-line bill, paid in
  cash), **Went up (not bought)** — Found / count was higher · Customer
  returned it · Free goods from supplier · Other — or **Went down (not sold)**
  — Damaged · Expired · Lost or stolen · Used in the shop · Given away ·
  Count was lower · Other ("Other" needs a note); each reason with one line
  saying when to use it, and going up or down never changes the cost. An
  untracked row's button is **Set opening stock**: what's on the shelf and
  what one cost (optional, recommended — it starts the average); many at once
  from the selection. The history reads as sentences ("Went down · Expired",
  "Opening stock · $4.50 each") and **See all** filters by kind and reason.
- **Live, received or not yet (2026-10-29):** **Save bill** (one large button;
  Save & new is gone) asks **Have the goods arrived?** — **Yes, add to stock
  now** (as before) or **Not yet**: the bill is saved, owed and payable, but
  nothing goes into stock. Such a bill shows **Not received** (a notice on the
  bill, a pill and a chip on the list) and a **Received** button: stock goes
  up then and each average is worked out at that moment; it can't be undone,
  and goods go back only once received. Change stock's quick bill is always
  received.
- **Live, bill page redesign (2026-10-29):** the bill's two answers on top —
  **Goods received** (when) or **Waiting for goods**, and its payment pill
  with the due day — then a bar: "Paid $200.00 of $707.00", "$507.00 left"
  (red when overdue). Details beside it on a laptop (supplier, their bill
  number, total, rate, note). Buttons in the header: **Received** (while
  waiting), **Record payment** (while owed), **Send back to supplier**.
  Tabs with counts: **Items** · **Payments** (a timeline, oldest first, each
  payment with what was left after it; voided ones crossed out; Record
  payment) · **Receiving** (when and by whom, and units added; or Received) ·
  **Returns** (the returns, Send back). A return's own page has no tabs. The
  Purchases list gains a **Goods** filter (received · not received) and a
  **Report** button to Bills & payables (S17).
- **Redesign, Count tiles (2026-10-29):** with a count open, a slim header
  (CNT-…, status, what it covers, "All saved", Cancel count apart) and a
  progress bar, then tiles like Purchases — **Not counted yet** ("Counted n
  of N", "Count now →"), **Lost** (items, −$…), **Found** (+$…),
  **Matches** — each also a chip; tapped, the list follows. A tracked item
  not counted yet has **✓ Matches** beside its box (the count on record in
  one tap). The Apply bar adds "n items not counted yet — they won't
  change". With no count open, above Past counts: **Last count** (its net;
  opens it), **Lost in 30 days**, **Applied**, **Cancelled** — the last
  three also chips.
- **Redesign, Suppliers tiles (2026-10-29):** the top of Suppliers is a
  row of tiles, like Purchases — **Overdue** (red, "Pay now →"), **You owe**
  ("Pay now →"), **Waiting for goods** (bills not received, "Mark received
  →"), **Settled** (in use, nothing owed; what was bought), **Archived** —
  each joined from the payables report. The same groups are the list's
  chips (a supplier can be in several: overdue is also owed); tapping a
  tile rings it and the list follows, changing the chips rings the tile.
  New columns **Overdue** and **Not received**; Status and Last bill are
  under View. A row asks for what it needs: **Pay** (their page, at their
  bills) and **New bill** (with them chosen). On a supplier's page each of
  their bills has **Pay** and **Receive** (shared with Purchases:
  `useBillRowActions`), and their figures read again after either.
- **Redesign, Stock tiles (2026-10-29):** the top of Stock is a row of
  tiles over every item, like Purchases — **Out** (red, "Order now →"),
  **Low** ("Order now →"), **In stock** (what it's worth, the other currency
  under it), **Not tracked** ("Start tracking →"). Tapped, the list follows
  its chip and the tile is ringed; changing the chips rings the matching
  tile (the grid's `onViewChange`). Under them, when items are at or below
  their reorder point: "**N items to reorder** · ≈ $X to order at the last
  cost · **Create bill**" — a New bill filled with them at their suggested
  quantities. Rows ask for what they need: **Order** (a new bill for that
  item) beside Change stock when it's low or out; Start tracking or Change
  stock otherwise.
- **Redesign, status tiles (2026-10-29):** the top of Purchases is a row of
  tiles over every bill, as of today — **Overdue** (red, "Pay now →"),
  **Due in 7 days** ("Pay now →"), **Unpaid** (unpaid or part paid, not
  late; "Pay now →"), **Not received** ("Mark received →"), **Paid** — each
  with how many bills and how much in the shop's currency (the other under
  it). Tapped, the list follows (payment overdue / open / paid, the new
  **Due** filter, the Not received chip) and the tile is ringed; tapped
  again, every bill. Bought and owed are one slim line above the list. A
  row asks for what it needs: **Receive** (goods not here; asks first) and
  **Pay** (still owes); else View. Tiles: `ActionStatTile` (on /styleguide).
- **Live, pay from the list and printing (2026-10-29):** on Purchases each
  bill that still owes has **Pay** on its row (a laptop's last column; under
  the card on a phone), opening Record payment for that bill — the list
  reads again after; other rows have **View** (laptop only: a card opens with
  a tap). **Printing** — on the invoice's document page (A4 or 80 mm; Print,
  Image, PDF, Share): the **purchase bill** (Print on the bill;
  `/m/purchases/:id/print`) — shop header, PURCHASE BILL with its stamps
  (payment standing; Not received), number, date, supplier's bill number,
  due, received, rate; the supplier and phone; items with SKU, quantity,
  cost, total; total, less returns, paid, **balance due**; every payment
  (voided struck through); note; Prepared by · Goods received by · Approved
  by. The **supplier return** prints the same way (SUPPLIER RETURN; the
  printer icon in the Returns tab, or Print on the return). The **payment
  voucher** (the printer icon on each payment;
  `/m/purchases/:id/payments/:paymentId/print`): PAYMENT VOUCHER (VOID when
  voided), number, date, paid by, for bill; paid to; the amount large; bill
  total after returns, paid before, this payment, **balance after**; note;
  Paid by · Received by (supplier). All documents share the paper parts in
  `apps/web/components/paper` with the invoice.
- Part 2 (Advance): several warehouses and branches, transfers, which
  location the shop and each counter sell from, KHQR reservations.

### S14. Customers — Built · 2 (every plan)
- **Live (2026-10-28):** `/m/customers`: every buyer the shop keeps (online
  checkout, and counter sales with a phone), with orders, spent (dollars and
  riel apart) and last order; search by name or a phone typed any way; sort
  by any column. One customer: call or copy their number, their numbers
  (cancelled and unpaid orders aren't counted), last delivery area, and every
  order. Laptop: in the side menu; phone: the Customers button on Orders. An
  order's buyer name opens their page. Drawn from `components/customers`. No
  database change.
- **Status tiles (2026-10-29)**, over every customer: Customers (and what
  they've spent) · New (saved in the last 30 days) · Coming back (2+ orders)
  · Not back lately (no order in 60 days — call them). Tapped, the list
  follows (same-named chips, worked out by the server on each customer's
  numbers); "Report" opens the Sales report. From `GET /customers/status`;
  the day limits are NEW_CUSTOMER_DAYS, RETURNING_MIN_ORDERS and
  LAPSED_AFTER_DAYS in packages/shared customers.ts.

### S15. Discounts — New · 3
- Promo codes (percent or amount, dates, limit); today codes are sample data only.

### S16. Staff — New · 3
- Invite by phone; owner / staff roles.

### S17. Reports — New · 3 (profit report built)
- Daily sales, best sellers, delivery success rate.
- **Live, Profit & loss (`/m/reports/profit`, Pro; rebuilt 2026-10-29 from
  the v0.5.1 profit report):** for the period — a notice when sales have no
  cost price (with Add cost prices); tiles Net sales · Cost of goods · Gross
  profit · Margin · Stock lost (and found) · Profit — the product table
  follows a tile; **the statement**, top to bottom: sales before discounts,
  discounts, delivery fees, net sales, cost of goods sold (frozen at sale),
  sales without a cost price (taken out, never guessed), gross profit and
  its margin (of the goods with a cost), stock lost (a count's at the cost
  it fixed, others at today's cost, marked ≈), found in counts, **profit**
  (before running costs — no expenses in the app yet), and VAT collected
  apart; **Profit over time** (cost and profit in each bar); **Margin over
  time** (low margin dashed, LOW_MARGIN_PERCENT); **Where the money went**
  (ring); **Stock lost and found** by reason; **Most profitable** and
  **Lowest margin**; **Profit by product**: sold, sales, cost, profit,
  margin — chips Losing money, Low margin, No cost price; a row opens the
  product. From `GET /orders/profit-loss` (packages/shared profit-loss.ts);
  the dashboard's profit snapshot reads the same sums.
- **Live, Reports page (`/m/reports`, 2026-10-29):** a card for each report
  (Sales, Profit & loss, Bills & payables, Stock, Suppliers, Stock counts) with what it shows, and the plan it
  comes with when the shop's doesn't have it. Every report shares one
  filter bar (`components/reports/report-filters.tsx`): Today · 7 days ·
  30 days · All · Custom (kept in the address) and Show all in one currency
  (kept in this browser); and Print.
- **Live, Sales report (`/m/reports/sales`, every plan; from Orders ›
  Report):** for the orders of the period — tiles Sales · In the shop
  (counter) · Online (orders and bookings from the shop page) · Average
  order (per currency) · Cash to collect · Cancelled — the order table
  follows a tile; **Sales over time** (in the shop and online stacked, day
  by day or month by month); **In the shop or online** (ring); **How buyers
  paid**; **Busiest hours**; **Online orders reaching the buyer** (delivered
  or picked up, on the way, not delivered; the success rate); **Best
  sellers** (a row opens the product); **Orders**: where, buyer, paid by,
  status, total — chips In the shop, Online, Cash to collect, Cancelled; a
  row opens the order; the newest 1,000 of the period, while the sums count
  every order. Sales follow the home page's rule (not cancelled, not still
  waiting for an online payment); each order keeps its currency and frozen
  total. From `GET /orders/report` (packages/shared sales-report.ts).
- **Live, Stock counts report (`/m/reports/counts`, with stock; the ERP
  shrinkage report; from Count › Report):** for the counts applied in the
  period — tiles Counts applied · Lost · Found (units, and their worth at
  the cost each count fixed) · Net · Accuracy (the share of items compared
  whose count matched; an item that started tracking from its count isn't
  compared) — the count table follows a tile; **Lost and found** (units,
  count by count); **Accuracy by count** (a line, from two counts on);
  **Loss by category**; **Most often short** (items short in the most
  counts, a row opens the item); **Counts**: applied, counted, items, lost,
  found, net, accuracy — chips Had losses, Had extra, All matched; a row
  opens the count. Drafts and cancelled counts are left out. From
  `GET /stock/counts/report` (packages/shared count-report.ts).
- **Live, Suppliers report (`/m/reports/suppliers`, with stock; from
  Suppliers › Report):** for the bills of the period — tiles Bought · Sent
  back (and its share of what came) · Paid · You owe · Overdue (the table
  follows a tile); **Top suppliers** (bought beside paid, horizontal bars);
  **Share of buying** (ring: the top 5 in one hue, darker for more, the rest
  in grey); **Goods sent back** (each supplier's return rate — what went
  back of what came); **Each supplier**: bills, bought, sent back, return
  rate, paid, owed, overdue (last bill under View) — chips You owe, Overdue,
  With returns; money columns sort by their worth in the shop's currency; a
  row opens the supplier. Charts are in the shop's currency unless all is
  shown in one. From `GET /purchases/report` (bills gain `returned`) and
  `GET /suppliers`.
- **Live, Stock report (`/m/reports/stock`, with stock; the ERP stock
  movement summary; from Stock › Report):** tiles — Shelf worth now · Went
  in · Went out (units, and their worth at today's cost) · Out or low · Not
  selling — the item table follows a tile; **In and out** (units, day by day
  or month by month); **Why it went out** and **How it came in** (each
  reason's units and worth); **Worth by category**; **Stock levels** (ring);
  **Not selling** (on the shelf, no sale in the period; last sold); **Each
  item**: opening, in, out, closing, worth — chips Came in, Went out, Out or
  low, Not selling; a row opens the item. Money is at today's cost (a unit's
  own cost isn't kept), dollars and riel apart. `GET /stock/report`;
  `packages/shared/stock-report.ts`.
- **Live, Bills & payables (with stock; `/m/reports/payables`, 2026-10-29):**
  the usual accounts-payable report, from Purchases › Report and Home. Bills
  of a period (All · This month · Last month · This year, by the day on the
  bill). For each currency (never added together): **You owe**, **Overdue**,
  **Due in the next 7 days**, **Goods not received** (bills and amount); a
  bar of paid of bought; the **Paid and received** table (payment standing ×
  goods received or not; each number opens Purchases filtered to those
  bills); **How late** (not due, 1–30, 31–60, 61–90, over 90 days past the
  due day; a bill with no due day is never late). **By supplier**: bills,
  bought, paid, owed, overdue, not received, one row per supplier and
  currency — search, sort, export; a row opens the supplier. **Print** lays
  it out on paper (the period and the day printed, the full supplier table).
  Returns lower bought and owed; voided payments don't count; a supplier
  owing the shop back isn't taken off what the shop owes.
- **Redesign (2026-10-29):** filters in one card — **Today · 7 days · 30
  days · All · Custom** (From → To, in order, not ahead; kept in the address)
  — and **Show all in one currency** (a switch, then $ USD / ៛ KHR; kept in
  this browser): every figure, chart and supplier row converted at the
  shop's rate, marked "≈", for reading only. In the home's chart look: the
  four figures; paid of bought; **Bought and paid** — bars per day (per
  month past 62 days, and for All), bills by their day, payments by theirs;
  the **Paid and owed** ring (shared with the home); **How late** bars; the
  **Paid and received** cards (each number opens Purchases filtered; with a
  custom range, or in one currency, the list isn't narrowed to the dates or
  the currency, and the card says so). By supplier: an owed bar on each row.
  The Purchases list's date filter gains Today, Last 7 days, Last 30 days.

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
### A3. KYC review — Spec
### A4. Plans — Built (read-only)
### A5. Audit log — Built
### A6. Settings — Built
### A7. Subscriptions, Invoices — Spec · L
- Subscriptions: every store's plan, status and what happens next; tabs for
  renewing this week, overdue, paused, trial ending; extend a period.
- Invoices: list with KHQR reference; statuses Due, Overdue, Paid, Void.
  "Mark as paid" by hand needs a bank reference and reopens the shop;
  "Void" needs a reason. Both go to the audit log.
### A8. Buyer payments, Failed checks — Spec · L
- Buyer payments: today's attempts across all stores, read-only; totals per
  currency, never added together.
- Failed checks: attempts a person must look at (no answer, wrong amount,
  wrong currency, paid after expiry). "Check again" or "Close with a note" —
  never "mark as paid".
### A9. Admin users — Spec · L
- Roles Owner, Support, Finance from packages/shared admin-roles.ts, with a
  table of what each can do. Invite by Telegram, change role, disable (never
  delete). There is always one active Owner.
- Later (needs the backend): enforcing roles per admin, and 2FA login.
- New role **Website editor** (with A10–A12): may edit, preview and publish
  website content, nothing else — no shops, money or settings.

### A10. Website pages — Spec · Website
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

### A11. Promotions — Spec · Website
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

### A12. Pictures — Spec · Website
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

### A13. Backups — Built (list, Backup now, restore test) · Go-live; restore one shop's catalog: Spec, after go-live
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
asked on a coming-soon solution page (P3) to hear when it opens.
- Filter chips: All, then one per coming-soon solution with its count
  ("Café & restaurant · 12"). The counts are the evidence for which business
  to switch on next (docs/blueprint.md "Business roadmap"). Sign-ups made for
  Khmio Class and Rent before they left the website stay listed.
- Each row: when, name, phone (tap to call), the business, the product.
  Newest first, 100 at a time, "Show older".
- Read-only. Owner and support only (`merchants_manage`): it holds phone
  numbers; finance sees "only an owner or support can see the waitlist".
- Signing up again with the same phone for the same product updates the
  row; the visitor sees the same thank-you either way.

## Platform website (Khmio)

The public site on `khmio.com` that presents every product, from
docs/platform-launch-plan.md Stage 3. The live pages (`/`, `/pricing`,
`/products/<id>`) are built (2026-10-07) from the content in
`apps/web/site/content.ts`, until the admin can edit it (A10–A12). The live site hides links to pages not built yet (Help, Terms,
Privacy) and seller stories marked as samples. Brand rules:
design/brand-guide.md. Visitors arrive from social media on a phone, often
inside the TikTok or Facebook browser: phone first, fast, one clear action.

**Edited from the admin, not in code.** Every page is a list of sections
from one fixed set (the site kit below). Text, pictures, promotions and
product cards are content: the admin edits it (A10–A12), previews it and
publishes it, and the site shows it within seconds — no code, no deploy.
The admin never moves boxes freely: the code always decides the layout,
fonts, colours and spacing, so whatever is typed looks right on a phone.
The pages read content shaped exactly like the future database, so
switching to admin-edited content changes only where it comes from.

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

### Website redesign (2026-10-28)

Khmio as the main brand — **every part of your business, in one simple app**
— for a niche big business software doesn't serve: Cambodia's small shops,
phone first, Khmer first, with KHQR, riel and dollars, and Telegram. The
idea of an app suite comes from all-in-one business software; the design,
words and pieces are Khmio's own. The old design, the Khmio Class and Rent
pages, the announcement bar and the beta promotion were removed; old
`/products/…` links redirect (Shop → the garage page, Class and Rent → home).

- **Look:** a soft brand-colour glow behind the hero, large headlines,
  pill buttons, cards with 24 px corners, colourful app tiles (theme tones
  only), a centred heading on every section, a sticky see-through header.
  Light and dark both work; phone first; Kantumruy Pro.
- **Header:** logo, **Apps** (the home page's app grid), an **Industries**
  menu (each business with its status badge), Pricing, language, Log in,
  "Start free". On a phone: one menu sheet.
- **Footer:** the industries, Khmio (pricing, contact) and legal links.
- **Apps** come from one list (`SITE_APPS`, `apps/web/site/content-apps.ts`):
  name, one line, icon and tone, a plan mark (Basic, Pro, Advance), and
  **Available** or **Coming soon**. No pages of their own.
- **Industries** come from one list (`SITE_SOLUTIONS`, `apps/web/site/content.ts`):
  name, one line, what it covers, icon, and **Available** (green, the
  garage), **Beta** (blue: open at sign-up, still being tested) or **Coming
  soon** (with a waitlist). A badge is one word in that list.

### P1. Home — Built · Website
- Hero: "Every part of your business, in one simple app", for Cambodia's
  small businesses; Mio ringed by app tiles; "Start free" and "See all apps";
  trust points (Khmer & English, riel/dollars & KHQR, Telegram, free in the beta).
- **App grid:** 16 apps — Online shop, Counter sales (Basic), Orders &
  delivery, Customers, Stock (Pro), Job cards, Tables & kitchen, Services &
  bookings, Invoices & receipts, Profit report (Pro), Telegram alerts
  (Available); KHQR payments, Purchases & suppliers, Discounts, Staff,
  Branches & warehouses (Advance) (Coming soon).
- **"Big business software, made small and simple":** a side-by-side table
  (cards on a phone) — set-up, works on, language, payments, alerts, price.
  Never names a company.
- **Industries:** Garage & auto repair (Available; covers car and motorbike
  repair, car wash, tyres & oil), Auto parts, Phone shop, Café & restaurant,
  Salon & services, Retail & online sellers (Beta) — each "Start free" and
  "Learn more".
- 3 steps to start (pick your business at sign-up), the plans, questions, closing.

### P2. Industry page: Garage & auto repair — Built · Website
- `/solutions/garage`: hero ("Your whole garage, in your pocket"), the
  garage's features as a bento grid, "A day at the garage" in 3 steps, the
  plans, questions, closing.

### P3. Industry page: beta — Built · Website
- One page per industry in beta (`/solutions/auto-parts`, `phone`, `cafe`,
  `salon`, `retail`), all from the same sections: "Beta · Free to try",
  what works today and (last) what's still coming, "Start free".
- A **coming-soon** industry would instead show its waitlist (name and
  phone; saved as Khmio Shop for that business, migration
  `waitlist_solutions`); none is coming soon today. The waitlist section is
  shown on /styleguide.

### P4. Pricing — Built · Website
- Khmio plans (the Plans section — not editable prices): Free, Basic, Pro, Advance, from `plans.ts`: monthly
  price, in USD or riel by a toggle (never both added), product limit,
  the trial for Free, and the plan's features.
- Basic marked "Most shops start here"; each card's button: "Start free".
- A comparison table under the cards (cards on a phone, table from tablet).
- How paying works: one KHQR bill a month, no card, no automatic charge,
  cancel any time; data is locked, never deleted (blueprint "Subscription
  tiers").

### P5. Help, Terms, Privacy — Built · Website (Terms and Privacy: draft)
- `/help`: the questions sellers ask (start, add products, how customers
  order and pay, Telegram alerts, receipts, price) and "Write to us on
  Telegram".
- `/terms` and `/privacy`: long text under headings (the site kit's
  **document** section), with the date last changed and a **Draft** notice
  until an advisor in Cambodia has checked them. Privacy says exactly what
  the system keeps (seller sign-in and shop details; a customer's name,
  phone, area and orders; Telegram only if they opt in), why, where
  (Singapore, Cloudflare R2, Vercel), how long (backups 14 days), that
  Khmio never holds the money, and how to ask for data to be deleted. The
  operator is a placeholder until the company is registered.
  (`apps/web/site/content-legal.ts`; when the system changes what it
  stores, this text changes too.)
- One route serves every top-level website page (`(site)/[page]`: pricing,
  help, terms, privacy); the header and footer show their links by themselves.

## Account hub (My Khmio)

After login, the one place a customer sees and controls every product they
use, from docs/platform-roadmap.md Phase 1. Spec only: a header with the
logo, language, theme and the app switcher, and three tabs (My apps ·
Subscriptions · Account).

### H1. My apps — Spec · Hub
- A card per product: Khmio Shop (shop name, plan, status, "Open
  dashboard"); Class and Rent ("Join the waitlist", or "On the waitlist ✓").

### H2. My subscriptions — Spec · Hub
- Per product: plan, status (trial / active / payment due / paused), next
  bill date and amount, "Pay by KHQR", "Change plan"; payment history.
  The rules are the Shop's S12 and blueprint "Subscription life cycle", so
  "Pay by KHQR" and "Change plan" open the Shop's billing page (S12): the
  money logic lives in one place. Products not built yet say "coming soon".

### H3. Account — Spec · Hub
- Name, login methods (Telegram, phone), language.

### H4. App switcher — Spec · Hub
- In the seller dashboard (sidebar and phone header) and in My Khmio: Shop ·
  Class · Rent · My Khmio; the current one is ticked; products not open to
  this account show "Coming soon" and lead to their website page. On a phone
  the menu spans the screen.

## Build order

Every screen marked **Spec** is built as a live page, with its API, when
its roadmap step comes (docs/blueprint.md "Roadmap: zero to live"), and
tested with the Demo Garage first ("Garage first"). Already built: the
buyer flow (B1–B8), the seller app (S1–S10, S13, S14, P), the admin's
working pages (A1, A2, A4–A6, A13, A14) and the website (P1–P4). Still
spec: S11, S12, A3, A7–A12, H1–H4, and the detailed design of S15–S17.
