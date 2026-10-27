# Platform Launch Plan — website, social media and new products

As of 2026-10-06 · the order of work from today until the platform has several paying products: brand, go-live, the platform website, paid subscriptions, choosing and building the second product

`docs/blueprint.md` stays the main plan; this document only orders the work that goes beyond the store. The technical design for more products (one login, entitlements, separate data) is in `docs/platform-roadmap.md`.

## The idea

One main website presents the platform, explains each product (the online store now, others later), and lets a customer pick a product, sign up and subscribe. Social media brings people to the website.

The brand is **Khmio** (Stage 1). All products live under **paths on one domain**, never on subdomains (blueprint "Running other projects"):

```
khmio.com/          platform website (home, products, pricing)
khmio.com/m         Khmio Shop dashboard (exists today)
khmio.com/class     Khmio Class (later)
khmio.com/rent      Khmio Rent (later)
```

One domain, one host-only login cookie, safe.

## The stages

```
NOW ─────────────────────────────────────────────────────────────────► LATER
Stage 1       Stage 2          Stage 3          Stage 4          Stage 5         Stage 6
Brand +       Go live + beta   Platform         Paid             Choose 2nd      Build 2nd
domain        + social media   website          subscriptions    product         product
                               (design → build) (Release 2)      (waitlist +     (platform
                                                                 interviews)     roadmap Phase 1)
```

Do not start a stage until the one before it is "Done when" true — except social media, which starts in Stage 2 and never stops.

## Stage 1 — Brand and domain (now)

**Decided (2026-10-06): the brand is Khmio, the domain `khmio.com`.** Since 2026-10-06 the code says Khmio too (`@khmio/*` packages, `khmio-photos` and `khmio-backups` buckets); only the database names and users keep the old name `khmer_micro_store`, because old migrations are never edited.

### The brand

| Item | Value | Status |
| --- | --- | --- |
| Name | **Khmio** — a made-up word: "Khm" for Khmer + "io" for the app | Decided |
| Domain | `khmio.com`; every product under a path on it | Decided — buy at go-live (`docs/go-live.md` section 2) |
| Say it | "Kh-mee-oh" · ខ្មីអូ — the same way in every video | Proposed |
| Tagline | លក់ងាយ ទទួលលុយរហ័ស — "Sell easily, get paid fast" | Proposed; a native speaker checks the Khmer before it is published |
| Wordmark | lowercase `khmio` | Proposed |
| Colour | Teal, the app's existing `brand` token in `packages/ui/src/globals.css` — no code change | Proposed |
| Font | Kantumruy Pro, as in the app | Decided |
| Mascot | **Mio**, a rabbit (ទន្សាយ) — quick and clever like the rabbit of Khmer folk tales; the name comes from Khm**io** | Decided 2026-10-06 |
| App icon | Option C: the letter "k" on teal with Mio's ears (`apps/web/app/icon.svg`) | Decided 2026-10-06 |

How the brand is used everywhere — logo rules, colours with hex values, fonts, Mio's poses, social media sizes and a designer brief — is in `design/brand-guide.md`.

### Mio, the mascot

- One component draws Mio everywhere: `Mio` in `packages/ui` (poses `face` and `coin`). Never redraw Mio inside a screen.
- The current drawing is a placeholder. A designer draws the final Mio — plus the Telegram bot photo, stickers and video art — before the public launch, and it replaces the component's artwork.
- Mio's look is our own: teal body that follows the brand colour, a riel coin for paid moments. Never copy a cartoon or film rabbit.
- Where Mio appears is listed in `design/screens.md` "Mascot". On a buyer's shop pages the seller's brand comes first, so Mio stays small there.
- Moves (the "Paid!" hop) stop when the phone is set to reduce motion.

### Product names

English product word, Khmer subtitle underneath. Addresses follow `docs/platform-roadmap.md` (paths, never subdomains).

| Product | Khmer subtitle | Address | When |
| --- | --- | --- | --- |
| Khmio Shop | ហាងអនឡាញ | `khmio.com/m` (seller), `khmio.com/s/<shop>` (buyer) | Now — this repo |
| Khmio Class | គ្រប់គ្រងថ្លៃសិក្សា | `khmio.com/class` | Candidate for second product |
| Khmio Rent | គ្រប់គ្រងបន្ទប់ជួល | `khmio.com/rent` | Candidate for second product |
| Khmio Book | ណាត់ជួប | `khmio.com/book` | Later |
| Debt book | សៀវភៅបំណុល | Inside Khmio Shop | Add-on |

### Names to reserve (checked free on 2026-10-06)

Availability changes; reserve them all on the same day.

| Where | Name | Checked |
| --- | --- | --- |
| Domains | `khmio.com` + `khmio.app` (others optional: `.net`, `.co`, `.io`, `.asia` were also free) | Free |
| Telegram | channel `@khmio`, bot `@khmio_bot`, support `@khmio_support` | Free |
| YouTube | `@khmio` | Free |
| GitHub | `khmio` | Free |
| Facebook Page, TikTok, Instagram | `khmio` | Check by hand — the sites block automatic checks |
| Pinterest | `khmio` is taken | Use `khmioapp` if ever needed |
| Email (after the domain) | `hello@khmio.com`, `support@khmio.com` | — |
| `khmio.com.kh` | — | Not checkable online; needs Cambodian documents |

No company, app or product named Khmio turned up on the web or in the App Store and Google Play. Similar names exist (Khimo, a Filipino singer; several unrelated "Kimo" brands), so always show the name written out in videos.

### Before paying for a logo

- Search the Cambodian Ministry of Commerce trademark register (or ask a local agent), and the WIPO Global Brand Database; if clear, register "Khmio".
- Ask a few Khmer, Chinese and Vietnamese speakers whether the name sounds wrong in their language.

**Done when:** domains bought, every name above reserved, trademark search clear, and the "Proposed" rows confirmed.

## Stage 2 — Go live and beta, social media starts (now)

The current work: blueprint roadmap steps 8–9 and `docs/go-live.md`. Do not pause it — everything else depends on a working store.

Start social media during the beta; it is free and builds an audience before the public launch.

| Post | Example |
| --- | --- |
| Short Khmer videos (TikTok, Facebook Reels) | "Open an online shop in 10 minutes", "Get paid by KHQR automatically" |
| Beta seller stories (with their permission) | "This clothing shop got 20 orders this week" |
| Problem posts | "Tired of fake payment screenshots?" |
| Telegram channel | Tips and updates for sellers |
| Beta recruiting | "Looking for 10 sellers to try it free" |

**Done when:** roadmap step 9 is done (two weeks of real orders, sellers say they would pay) and the first followers are in.

## Stage 3 — The platform website (design now, build before the public launch)

The home page today (`apps/web/app/[locale]/page.tsx`) is a placeholder. The website lives in the same web app: no new hosting, same translations, same font and components.

### Pages

| Page | Address | Shows |
| --- | --- | --- |
| Home | `/` | One-line promise, how it works in 3 steps, seller stories, a big "Start free" button, the list of products |
| Product: Shop | `/products/shop` | Each feature with phone screenshots: shop link, KHQR, Telegram alerts, delivery, stock (Pro), branches (Advance) |
| Product: coming soon | `/products/class`, `/products/rent` | What it will do, and a **"Tell me when it's ready" waitlist** (name, phone or Telegram, business type) |
| Pricing | `/pricing` | Plans read from `packages/shared/plans.ts`, in USD and riel, with a comparison table |
| Help | `/help` | Khmer video tutorials (roadmap step 13), common questions |
| Terms, Privacy | `/terms`, `/privacy` | Required before the public launch (step 13) |
| Contact | `/contact` | Telegram support link, phone |

### From a post to a subscription

```
Social media post → website (home or product page) → "Start free"
  → Telegram login (exists) → choose product → onboarding (exists for Shop)
  → 14-day free trial → choose a plan → pay by KHQR each month (Stage 4)
```

For a product not built yet, "Start free" becomes "Join the waitlist". Waitlist counts per product are the evidence for Stage 5.

### Edited from the admin, not in code (decided 2026-10-06)

The website's text, pictures, promotions and product cards are **content in the database**, edited in the admin panel (screens A10–A12 in `design/screens.md`) — no code and no deploy to change them.

- **Fill in the blanks, not a page builder:** each page is a list of sections from one fixed **site kit** (Hero, Steps, Product cards, Features, Promotion banner, Plans, Questions, Seller story, Closing band, Announcement bar, Waitlist form). The admin edits a section's content, switches it on or off and reorders sections; the code always decides the layout, so every page stays on the design standard on a phone.
- **One kit for every product:** each section is one component plus one Zod schema in the shared packages; the schema also builds its admin form. Khmio Class and Khmio Rent get their pages from the same kit, colours, font and Mio — new content, no new design.
- **Inside our own admin, not a separate CMS:** same login with 2FA, roles and audit log; pictures in the existing R2 storage; Khmer and English handled like the rest of the app; no extra service to pay for or secure.
- **Prices stay in code:** the Plans section always reads `packages/shared/plans.ts`, so the website can't show a price billing doesn't charge.
- **Safe publishing:** draft → preview → publish; every published version kept and restorable; promotions with start and end times; a new **Website editor** admin role that can touch content only; every change in the audit log.
- **Fast:** published content is cached and refreshed on publish.

### Rules

- Prices come only from `packages/shared/plans.ts`; the pricing page reads it, so it never shows a wrong price.
- Each page has a link preview image and text for Facebook and Telegram.
- Links in social posts carry a source tag (`?utm_source=tiktok`) so sign-ups can be traced to a channel.
- Waitlist form: Turnstile and rate limits (built in step 8, part B1), Zod validation, phone rules from `CLAUDE.md`. The waitlist is a platform table with no `store_id`, written through SystemDb; never log phone numbers.
- Fast on a 360 px phone, Khmer first, rendered on the server so search engines can read it.
- No hard-coded text: the site's fixed words (menus, form labels, buttons the code owns) live in `messages/km.json` and `messages/en.json`; everything the admin edits is content, stored in both languages and refused at publish if either is missing.

### Build order (the `CLAUDE.md` method)

1. Write the page specs in `design/screens.md` — done 2026-10-06 (site kit, P1–P4, A10–A12, account hub H1–H4).
2. Mockups with sample data, each approved before the next: the site kit sections, then P1–P4 fed by sample content shaped like the future database, then the admin screens A10–A12.
3. **Before go-live (done 2026-10-07):** the live pages from content kept in code (`apps/web/site/content.ts`), with link previews, sitemap and robots; the waitlist (one table, one endpoint, bot check and rate limit) and its admin list (A14).
4. Build the rest as its own roadmap step, after go-live: platform content tables (pages, sections, versions, promotions, pictures — no `store_id`, admin routes only, with the Website editor permission), publishing with cache refresh; the live pages then read the database instead of the file.
5. Lint, typecheck, tests; check every page on a phone in Khmer and English.

**Done when:** you change the home page's promotion from the admin panel, without code, and it shows on your phone within a minute; someone finds the platform on TikTok, opens the website on their phone, understands the product and starts a free shop without help; the waitlist form works and the admin can see the list.

## Stage 4 — Paid subscriptions (blueprint Release 2, steps 10–13)

Already planned in the blueprint; the website plugs into it:

- Step 10, plans and billing: monthly invoice paid by KHQR, grace period, pause.
- Step 11, admin for money: see who paid.
- Step 12, trust: KYC and the Verified badge.
- Step 13, launch: terms, privacy, Khmer tutorials — linked from the website.

Add one page: **My account → My subscriptions** — current plan, next bill, upgrade button, payment history.

**Done when:** a stranger finds the platform on social media, signs up on the website and pays the first month by KHQR without talking to you.

## Stage 5 — Choose the second product (after the public launch)

The shortlist is in `docs/platform-roadmap.md` "Second product shortlist". Decide with evidence, not guesses:

| Evidence | From |
| --- | --- |
| Waitlist sign-ups per product | The website (Stage 3) |
| Interviews: 5 extra-class teachers, 5 landlords | In person |
| Reactions and messages | One social media video per idea, compared |

**Done when:** one product clearly wins — for example about three times the waitlist sign-ups, and interviews where people name a price they would pay.

## Stage 6 — Build the second product (platform roadmap Phase 1)

1. Platform pieces first: entitlements (which account has which product and plan), an app switcher in the menu, and "My subscriptions" listing every product.
2. The monthly billing engine: list of people → automatic monthly bill → KHQR link by Telegram → confirmed by the worker. Reuses `packages/payments` and the worker.
3. Product screens: mockups first, approval, then the backend step by step, like the store.
4. Beta with people from the waitlist; fix; launch with social media.
5. Turn the website's "coming soon" page into a real product page with "Start free".

**Done when:** one login opens both products, each product has its own plan and bill, and the store keeps working as before.

Then repeat Stages 5–6 for the next product; the rental room manager reuses the same billing engine.

## This week

| # | Task | Why now |
| --- | --- | --- |
| 1 | Brand chosen: Khmio. Run the trademark search and confirm the "Proposed" rows in Stage 1 | Hard to change after launch |
| 2 | Reserve `khmio.com`, `khmio.app` and every name in Stage 1's list on the same day | Free or cheap; names get taken |
| 3 | Continue go-live (`docs/go-live.md`) | Everything else depends on it |
| 4 | Start posting short Khmer videos and recruiting beta sellers | The audience grows while you build |
| 5 | Write the website page specs in `design/screens.md`, then mockups | Ready in time for the public launch |

## Keep in mind

- One thing at a time: the store earns money before the second product starts.
- The waitlist is the cheapest test. Do not build a product nobody joins the waitlist for.
- Do not promise dates on social media for products not built yet — say "coming soon" and grow the waitlist.
- A new product never touches store tables (`docs/platform-roadmap.md` rules).
