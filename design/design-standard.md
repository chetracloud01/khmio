# Design standard

The rules every screen follows. Read this before building or changing a
screen; `design/screens.md` says *what* each screen contains, this file says
*how* it must look and behave. Source document: `docs/blueprint.md` (the
one plan for the whole project). The brand outside the app — logo, Mio,
marketing colours and fonts, social media — is in `design/brand-guide.md`.

## 1. What the app is for

A seller who takes orders in Facebook or Telegram chat opens a shop link in
minutes. A buyer orders and pays on that link without messaging anyone. The
system confirms the KHQR payment itself (no screenshots), tells both sides
what happens next on Telegram, and helps the seller send a driver.

Three people use it, on three kinds of screen:

| Who | Main device | Must feel like |
| --- | --- | --- |
| Buyer | Cheap Android phone, inside the Facebook / Telegram / TikTok in-app browser, weak 4G | A food-delivery app: browse, tap, pay, done in under a minute |
| Seller | Phone first; tablet or laptop at the shop | A simple work tool: see new orders, pack, send a driver |
| Super admin | Laptop | A back-office console: lists, filters, decisions |

Design order for every screen: **phone (360 px) → tablet → desktop**. A
screen isn't done until all three are checked.

## 2. Responsive layout

Three sizes, using Tailwind's breakpoints. Never design for a device name;
design for the width.

| Size | Width | Tailwind | Input |
| --- | --- | --- | --- |
| Phone | under 640 px (test at 320, 360, 414) | default classes | One thumb |
| Tablet | 640–1023 px (test at 768) | `sm:` `md:` | Touch, two hands |
| Desktop | 1024 px and up (test at 1280, 1440) | `lg:` `xl:` | Mouse and keyboard |

What changes at each size:

| Area | Phone | Tablet | Desktop |
| --- | --- | --- | --- |
| Buyer shop page | Full width, 2 product columns | Centred column, 3 columns | Centred column (max 1100 px) on the page background, 4 columns |
| Buyer cart → checkout → pay → order | Full width, one column | Centred column, max 560 px | Same centred column; never stretch a form across a wide screen |
| Seller dashboard | Bottom tab bar (5 tabs), one column | Sidebar appears at 768 px; forms max 720 px; lists as cards | Sidebar + content; lists as tables from 1024 px; two-column order detail |
| Admin | Menu in a drawer; lists as cards | Drawer; lists as cards | Dark sidebar that collapses to icons; tables; content max 1200 px |
| Pop-ups | Bottom sheet | Centred window | Centred window, or a right-side panel for "manage this row" |

Rules that never change:

- No sideways scrolling at any width. Long rows (categories, offers) swipe
  inside their own strip and snap.
- The page background is `canvas`; content sits on `bg` cards or a `bg` column.
- Fixed bottom bars use `.pb-safe` so they clear the iPhone home bar; a bar
  above the seller's bottom tabs uses `.bottom-above-nav`.
- Use `min-h-dvh`, not `min-h-screen` (in-app browsers change height as
  their toolbars hide).
- Only one thing may stay pinned at the top, and it must be short (about
  110 px at most on a phone). Banners and headings scroll away.

## 3. Look

**Colour — tokens only** (`packages/ui/src/globals.css`). No raw Tailwind
colours (`amber-500`, `text-white`, hex codes) in screens.

| Token | Use |
| --- | --- |
| `brand` / `on-brand` | The one main action per screen, links, selected state |
| `success` | Paid, delivered, verified, available |
| `warning` | Needs attention soon: low stock, payment due, setup missing |
| `danger` | Destructive actions, errors, sold out, failed |
| `info` | Neutral in-progress states: packing, out for delivery |
| `bg`, `canvas`, `border` | Surfaces, page background, lines |
| `fg`, `muted` | Text, secondary text |
| `nav-*` | The admin's dark sidebar (Deep Khmio Teal `#0A2A33`, a dark shade of the viewer's accent) and dark overlays on images; `nav-accent` is the current-page bar and logo square, `nav-badge` the menu's count badges |

Every screen must read correctly in light and dark mode and with all five
accent colours. Meaning is never carried by colour alone: pair it with an
icon or a word ("Sold out", not just grey). Readability is tested, not
eyeballed: `apps/web/components/theme-contrast.test.ts` reads `globals.css`
and checks every text pair (4.5 : 1) and shape (3 : 1) in light, dark and
"follow the device", for every accent. A colour change that fails it doesn't
ship.

**One kit, no copies.** Every screen — admin, seller, buyer and their
mockups — is built from the shared building blocks in `packages/ui`
(`blocks.tsx`: `PageHeader`, `SectionTitle`, `StatCard`, `StatusPill` with
the tones `brand` `success` `warning` `danger` `info` `muted`, `EmptyState`,
`LoadingBlocks`, `ErrorState`, `DetailList`, `ConfirmDialog`; plus `Button`,
`Card`, `Input`, `BottomSheet` …), the admin frame in
`apps/web/components/admin-frame`, the seller frame in
`apps/web/components/seller-frame` (bottom tabs on a phone, a sidebar from
768 px; pages use its `SELLER_PAGE` / `SELLER_FORM` widths and
`SELLER_FORM_BAR`) and the data grid in
`apps/web/components/data-grid.tsx`. A page never re-creates one of these; a
block that's missing is added to the kit, shown on `/styleguide`, then used.
The kit holds no words — every label comes from `messages/*.json`.

**Type** — Kantumruy Pro for Khmer, system sans for Latin.

| Use | Size | Tailwind |
| --- | --- | --- |
| Page title | 20 px bold | `text-xl font-bold` |
| Section title | 16–18 px semibold | `text-base` / `text-lg font-semibold` |
| Body, inputs, buttons | 16 px | `text-base` (inputs below 16 px make iPhones zoom) |
| Secondary text, helper text | 14 px | `text-sm text-muted` |
| Badges, counters only | 12 px | `text-xs` — never for a sentence the user must read |

Line height 1.5 or more for any Khmer text (`leading-normal`; never
`leading-tight` or `leading-snug`) or the vowels above and below are cut
off. Every text size already carries at least 1.5 (`fontSize` in
`apps/web/tailwind.config.ts`), so `text-xs`/`text-sm` are safe as they are. Khmer labels run 30–40% longer than English: every button and tab
must be checked in Khmer at 360 px and stay on one line, or be reworded.
Numbers that change or line up (prices, quantities, countdowns) use
`tabular-nums`.

**Shape and space**

- Spacing on the 4 px grid; the usual steps are 8, 12, 16, 24 px. Page
  side padding is 16 px on phones, 24 px from tablet up.
- Corners: 12 px (`rounded-DEFAULT`) for inputs, buttons and small cards;
  16 px (`rounded-2xl`) for sheets, dialogs and large cards; full for pills.
- Shadows: `shadow-card` for cards, `shadow-raised` for things that float
  (cart bar, dialogs). Nothing else.
- Every tappable thing is at least 44 × 44 px (`min-h-touch`, `h-11 w-11`),
  with 8 px between neighbours.

**Icons** — lucide only, 16–20 px, always next to a word. An icon-only
button needs an `aria-label` and must be obvious (back arrow, close X, +, −).

**Pictures** — product photos are square, shown with `object-cover`;
shrunk in the browser before upload (`compress-image.ts`). A product with
no photo shows its colour block, never a broken image.

## 4. Behaviour

**Loading** — show the page frame with grey placeholder blocks
(`animate-pulse`) in the shape of the content, not a blank page or a
spinner. Buttons show their own loading state and can't be tapped twice.

**Empty** — an icon, one sentence saying what will appear here, and one
button for the next step ("Add your first product").

**Errors** — say what to do, in the user's language, next to the problem:
"Enter a Cambodian number, e.g. 012 345 678", never "Invalid input". A
failed action keeps what the user typed.

**Motion** — short and quiet: 150–300 ms, ease-out. Allowed: page fade-in,
sheet slide-up, the cart "bump", sliding highlight, press feedback
(`active:scale-95`). Every animation has `motion-reduce:` off.

**Feedback** — every tap changes something visible within 100 ms: a
pressed state, a count, a tick, a status message (`role="status"`).

**Language** — Khmer by default, EN toggle top-right, choice remembered. No
text in components: every word lives in `messages/km.json` and `en.json`,
with the same keys in both.

**Access** — every input has a visible label; dialogs trap focus and
close on Escape; status changes are announced; contrast at least 4.5:1
for text.

## 5. Forms (all roles)

One standard, implemented in `mockup/form-ui.tsx`:

1. **Sections** — fields grouped under a title and one line of help.
2. **Draft** — edits stay in a draft; nothing is saved until Save.
3. **Save bar** — sticky Save / Cancel at the bottom, active only after a
   change; shows "Unsaved changes" then "Saved".
4. **One schema** — a Zod schema from `packages/shared` checks the form in
   the browser and again in the API. Problems come back as error codes,
   shown from the `FormErrors` messages.
5. **When to check** — when the user leaves a field, and again on Save;
   Save scrolls to and focuses the first problem. The message clears as
   soon as the user starts fixing it.
6. **Right keyboard** — `inputMode="tel"` for phones, `"decimal"` for USD,
   `"numeric"` for riel, quantities and codes; `autoComplete` set
   (`name`, `tel-national`, `one-time-code`).
7. **Fewest fields** — ask only what's needed now; guess the rest
   (shop link from the name, KHR from USD); mark optional fields
   "(optional)" instead of starring required ones.
8. **Money** — typed as people write it (`1.50`, `6,000`), read with
   `parseUsdInput` / `parseKhrInput`; a typo is rejected, never rounded.
9. **Phone** — `+855` shown as a fixed prefix; any common way of typing
   the number is accepted; saved as `855XXXXXXXX`; shown as `012 345 678`.

## 6. The buyer flow (must be smooth)

Shop → (Product) → Cart → Checkout → Pay → Order status. The buyer never
has to message the seller.

- **One main button per screen**, full width, pinned to the bottom, always
  showing the amount when there is one ("Place order · $5.52").
- **Progress is visible**: Cart → Checkout → Pay steps at the top.
- **Checkout is one page**, not a wizard. Required: name, phone, how to get
  it (delivery or pickup), where. Everything else is optional or prefilled.
- **Remember the buyer**: name, phone and address are kept on the device
  for next time.
- **One currency per order**, chosen by the buyer; the other currency is
  shown small with "≈". Totals are identical on cart, checkout, payment
  and the order page (one shared calculation).
- **Only offer what works**: payment methods the shop has set up; items
  that are in stock (Pro/Advance); cash on delivery only where allowed.
- **Payment screen** looks like the official KHQR card: shop name, amount,
  currency, QR, countdown. It moves to the order page by itself when paid.
- **Never a dead end**: empty cart, sold out, expired QR, shop closed and
  "shop can't take orders yet" each say what happened and give one button.
- **Order status page** is a link the buyer can reopen any time (it's also
  sent on Telegram). It shows the status steps below, the delivery
  tracking link or bus ticket number, and the shop's phone.

## 7. Order statuses (one wording everywhere)

From `docs/blueprint.md` "Workflows from start to end". The same names, colours and order on the
buyer's order page, the seller's order list and Telegram messages.

| Status | Colour | Icon | Buyer sees | Seller's next button |
| --- | --- | --- | --- | --- |
| Awaiting payment | `warning` | Hourglass | QR and pay-by time | — |
| Paid | `success` | Bell ringing | Receipt | Confirm order |
| COD pending | `warning` | Bell ringing | Order summary, "pay on delivery" | Confirm order |
| Confirmed | `info` | Thumbs up | "The shop accepted your order" | Start packing |
| Packing | `info` | Open box | "Being packed" | Send (driver / pickup / bus) |
| Waiting for driver | `brand` | Person searching | "Being packed" (no change for the buyer) | — |
| Out for delivery | `brand` | Truck (pickup: shop) | Tracking link or bus ticket number | Mark delivered |
| Delivered | `success` | Hand with coins | Thank-you and reorder link | Cash settled (COD only) |
| Completed | `success` | Big check | — | — |
| Cancelled | `danger` | Circle with X | Reason | — |
| Failed delivery | `danger` | Box with X | Rebook option | Rebook delivery |

The seller's orders list groups by step in this order — To confirm (bell, `warning`), Packing (open box,
`info`), Sending (truck, `brand`), Delivered (big check, `success`), Problems (warning sign, `danger`) —
with the same icon on each tab. Icons and colours come from `apps/web/components/order-ui.tsx`.

## 8. Before a screen counts as done

- [ ] Checked at 320, 360, 768, 1024 and 1440 px: no sideways scroll, no
      cut-off text, no tap target under 44 px.
- [ ] Checked in Khmer and English; every button on one line in Khmer at 360 px.
- [ ] Checked in light and dark mode.
- [ ] Loading, empty and error states exist.
- [ ] Only tokens for colour; all text from the message files.
- [ ] Forms follow section 5; buyer screens follow section 6.
- [ ] Works in Chrome, Safari (WebKit) and Firefox.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass.
