# Khmio Brand Guide

As of 2026-10-06 · how Khmio looks and sounds everywhere: the app, the website, Telegram, social media, print and ads. For a designer, a video maker or anyone posting for Khmio

The decisions behind this guide are in `docs/platform-launch-plan.md` Stage 1. Inside the app, `design/design-standard.md` decides; this guide covers everything else and must agree with it.

## 1. Khmio in one minute

| | |
| --- | --- |
| Name | **Khmio** — "Khm" for Khmer + "io" for the app |
| Say it | "Kh-mee-oh" · ខ្មីអូ |
| Promise | Sell online in minutes; get paid by KHQR without checking screenshots |
| Tagline | លក់ងាយ ទទួលលុយរហ័ស — "Sell easily, get paid fast" (a native speaker checks the Khmer before it is printed) |
| Mascot | Mio, a clever teal rabbit |
| Personality | Friendly, quick, honest, Khmer first |
| Who it's for | Small sellers who sell on Facebook, TikTok and Telegram |

## 2. Writing the name

| Write | Where |
| --- | --- |
| **Khmio** | In every sentence, in Khmer and English text alike (Latin letters, capital K) |
| **khmio** | Only inside the logo (the wordmark) |
| **Khmio Shop**, **Khmio Class**, **Khmio Rent** | Product names; a Khmer subtitle may sit underneath (Khmio Shop · ហាងអនឡាញ) |
| **KHMIO** | Only where a system needs capitals (the name on KHQR bills) |

Never: "Khmer Micro-Store" (the project's old name), "KhMio", "Khmio's App", or a translated name.

## 3. Logo and app icon

- **App icon:** the letter "k" in white on a teal rounded square, with Mio's two ears on top (option C). Current file: `apps/web/app/icon.svg`; the designer's final version replaces it.
- **Wordmark:** `khmio` in lowercase, Kantumruy Pro Bold; "io" may be in teal when "khm" is in ink.
- **Clear space:** keep empty space around the logo at least as wide as one ear.
- **Smallest size:** 32 px on screen; 12 mm in print.
- **Backgrounds:** teal icon on white or light grey; on photos or dark backgrounds, use the icon as it is (it has its own teal square) — never a teal wordmark directly on a busy photo.

Don't: stretch or squash, rotate, change the colours, add shadows or outlines, put the letter "k" without its square, or redraw the ears.

## 4. Mio, the mascot

**Who Mio is:** a clever, quick, kind rabbit — inspired by the clever rabbit of Khmer folk tales, but our own drawing. Mio helps sellers; Mio never mocks anyone.

| Pose | Use | Status |
| --- | --- | --- |
| Face | App icon details, login, Telegram bot photo, avatars | In the app (placeholder drawing) |
| With a riel coin | "Paid!" moments, money tips | In the app (placeholder drawing) |
| Waving | Welcome, onboarding, "new here" posts | Designer to draw |
| Thinking | Empty pages, questions, tips | Designer to draw |
| Celebrating | First order, milestones, festivals | Designer to draw |
| Sorry | Errors and "something went wrong" | Designer to draw |

Rules:
- In the app, Mio is drawn only by the `Mio` component (`packages/ui`). In posts and print, use only the designer's files.
- Mio's body is Khmio teal; inner ears light teal; face white; pink cheeks and nose; riel coin gold.
- On a buyer's shop pages the seller's brand comes first: Mio appears small and only at the "Paid!" moment.
- Never copy a cartoon or film rabbit, never give Mio a weapon, alcohol, cigarettes or a political or religious symbol, and never use Mio to make fun of a person or a competitor.

## 5. Colours

### Brand colours (website, social media, print, ads)

| Name | Hex | Use |
| --- | --- | --- |
| **Khmio Teal** | `#0E7490` | The main colour: icon, buttons, headlines, Mio's body |
| Light Teal | `#99F6E4` | Small highlights, Mio's inner ears |
| Ink | `#0F172A` | Text |
| Slate | `#475569` | Secondary text |
| Canvas | `#F4F6FA` | Page and post backgrounds |
| White | `#FFFFFF` | Cards, text on teal |
| Coin Gold | `#FBBF24` | The riel coin and rare highlights — never as a background for white text |
| Success Green | `#157036` | "Paid", "Done" |

Readability (contrast) checked: white on Khmio Teal is about 5.4 : 1 and Ink on Canvas is far above, both pass for normal text. Light Teal and Coin Gold are too light for text on white: use them only for shapes and highlights.

**KHQR red** belongs to the national KHQR payment card only. Never use it as a Khmio colour.

### Colours inside the app

The app uses named colour tokens (`brand`, `success`, `warning`, `danger`, `info` …), light and dark mode, and five accent choices for each viewer. The rules are in `design/design-standard.md` §3; the values are in `packages/ui/src/globals.css`.

The app's default (teal) `brand` token in light mode is Khmio Teal `#0E7490`, so the app, the icon and the marketing use one teal. It replaced the lighter `#0891B2` on 2026-10-06, on which white button text reached only about 3.7 : 1. The same day, the `success` green became `#157036` (was `#16A34A`, about 3 : 1 on its light badges, now above 5 : 1).

Also on 2026-10-06, `danger` became `#C81E1E` (was `#DC2626`), `warning` `#A34B08` (was `#B45309`) and `info` `#1D5AE0` (was `#2563EB`): on their light-tinted badges they had been just under the 4.5 : 1 small text needs, and now reach about 5 : 1. Every light-mode status colour now passes on white, on the page background and on its own badge. When a colour token changes, check those three backgrounds the same way.

On 2026-10-07 the admin sidebar became **Deep Khmio Teal** `#0A2A33` (was the plain navy `#0F172A`), with a bright teal `#2DD4BF` bar on the current page and gold `#FBBF24` count badges; with another accent chosen it takes a dark shade of that accent. The same day three colours moved a shade to pass 4.5 : 1: grey text `#627288` (was `#64748B`), the rose accent `#D11B43` (was `#E11D48`) and dark-mode `danger` `#F15A5A` (was `#EF4444`). These checks now run automatically: `apps/web/components/theme-contrast.test.ts`.

## 6. Fonts

**One family everywhere: Kantumruy Pro** (free from Google Fonts, under the SIL Open Font License). It has Khmer and Latin letters, so a mixed sentence looks like one voice. The app already uses it; use the same in Canva, CapCut, Figma and print.

| Use | Weight | In the app | On a 1080 px social post |
| --- | --- | --- | --- |
| Headline | Bold (700) | 20 px | 64–96 px |
| Subheading | SemiBold (600) | 16–18 px | 44–56 px |
| Body | Regular (400) | 16 px | 36–40 px, never smaller than 32 px |
| Small print | Regular (400) | 14 px | 28 px, and only for legal lines |

Rules:
- Line height 1.5 or more for any Khmer text, or the vowels above and below get cut off.
- Khmer runs about a third longer than English: leave room, and check the Khmer version first.
- If Kantumruy Pro is missing on a device, the fallback is Noto Sans Khmer.
- No decorative Khmer fonts for body text. A traditional display font may be used for one festival headline at most.

## 7. Voice and writing

- **Khmer first.** Write the Khmer text first, then the English. Both say the same thing.
- **Simple words.** Write like you talk to a seller at the market. One idea per sentence.
- **Say what to do.** "Scan the QR with any bank app", not "Payment processing initiated".
- **Honest.** No invented numbers, no fake reviews, no dates for products that aren't built ("coming soon" is fine).
- **Money:** `$5.50` and `22,000៛`; never mix both in one total.
- **Phone numbers:** `012 345 678`.

| Instead of | Write |
| --- | --- |
| "Revolutionary e-commerce solution" | "Your online shop in 10 minutes" |
| "Transaction failed" | "The payment didn't go through. Try again or pay cash on delivery." |
| "Leverage our platform" | "Sell on Telegram and Facebook — get paid by KHQR" |

## 8. Social media and marketing

### Channels

| Channel | Name | What to post | How often |
| --- | --- | --- | --- |
| TikTok | @khmio | Short Khmer videos: how-to, seller stories, tips | 3–5 a week |
| Facebook Page | Khmio | The same videos as Reels, posters, announcements, seller stories | 3–5 a week |
| Telegram channel | @khmio | Updates, tips, new features; the support link | 1–3 a week |
| YouTube | @khmio | Longer Khmer tutorials (the Help page links here) | When a tutorial is ready |
| Instagram | @khmio | Optional: the same Reels and posters | When there is time |

Reserve every name on the same day (`docs/platform-launch-plan.md` Stage 1 lists which are free).

### Sizes

Common sizes in 2026; check each platform's current help page before paying for ads.

| Format | Size (px) | Notes |
| --- | --- | --- |
| TikTok, Reels, Stories | 1080 × 1920 | Keep text out of the bottom fifth and the right edge (buttons sit there) |
| Facebook / Instagram post | 1080 × 1080 or 1080 × 1350 | 1350 tall shows bigger in the feed |
| YouTube thumbnail | 1280 × 720 | Big Khmer headline, Mio, one face or product |
| Profile picture (all) | 1080 × 1080 | The app icon; it is shown in a circle |
| Facebook cover | 1640 × 624 | Keep text in the centre; phones crop the sides |

### How a post is laid out

1. **One message** per post — a headline of at most 7 Khmer words.
2. **Mio** or a real seller's phone screen showing the app.
3. **One benefit** in one line ("No more fake payment screenshots").
4. **One action:** "Start free at khmio.com" or "Link in bio".
5. **Logo** small in a corner; colours from section 5; Kantumruy Pro only.

### What to post (content pillars)

| Pillar | Example |
| --- | --- |
| How-to | "Add your first product in 1 minute" (screen recording with Khmer voice) |
| Seller stories | A beta seller and their shop — only with their written permission |
| Problems we solve | "Tired of checking payment screenshots? KHQR checks itself." |
| Selling tips | Good product photos with a phone; writing a good product title |
| What's new | A new feature, in one short video |
| Festivals | Khmer New Year (April), Pchum Ben and the Water Festival (dates follow the lunar calendar — check each year) |

A simple week: Monday a how-to, Wednesday a tip, Friday a seller story or a problem post, weekend a short Telegram update.

### Links that tell you what works

Add a source tag to every link so the website shows which channel brought each sign-up:

```
https://khmio.com/?utm_source=tiktok&utm_campaign=beta
https://khmio.com/?utm_source=facebook&utm_campaign=beta
https://khmio.com/?utm_source=telegram&utm_campaign=beta
```

Watch sign-ups and paying shops per channel, not only likes and followers.

### Rules for marketing

- A seller's shop, name or face appears only with their written permission.
- Never show a buyer's name, phone number or address — blur them in every screenshot.
- No invented numbers ("10,000 sellers") and no fake reviews.
- Don't name or attack competitors.
- Don't promise dates for products that aren't built; collect waitlist sign-ups instead.
- Never show passwords, tokens or the admin panel on screen.

### Free tools

- **Canva:** make a Brand Kit with the colours from section 5, Kantumruy Pro and the logo; build templates for each size once.
- **CapCut:** videos with Khmer captions; save a template with the logo and colours.
- Keep every final file in `design/brand/` (logo, Mio poses, templates) so anyone can find it.

## 9. Files

| What | Where |
| --- | --- |
| App icon (current) | `apps/web/app/icon.svg` |
| Mio in the app | `packages/ui/src/Mio.tsx` |
| Final designer files (logo SVG and PNG, Mio poses, social templates) | `design/brand/` — created when the designer delivers |
| Brand board (all options compared, for review) | The private "Khmio brand board" artifact on claude.ai — share it from its Share menu if a designer needs it |

## 10. Brief for a designer

Give a designer this list, this guide and the brand board:

1. **Logo:** the app icon (option C, "k" with Mio's ears) and the wordmark `khmio`, as SVG and PNG (1024, 512, 192, 180, 32 px), light and dark versions.
2. **Mio:** six poses from section 4 as SVG and PNG with a transparent background; a one-page character sheet (front, side, colours).
3. **Telegram:** bot photo and channel photo (Mio's face, 1080 × 1080), and a small sticker set (Paid!, Thank you, New order, Sorry).
4. **Templates:** one TikTok/Reels cover, one square post, one 4:5 post, one YouTube thumbnail, in Canva or Figma, using only the colours and font in this guide.
5. **Rights:** all files and the full copyright transfer to the owner; no stock art inside Mio or the logo.

## 11. Before you publish anything

- [ ] Khmer text written first and checked by a native reader.
- [ ] Only Khmio colours and Kantumruy Pro.
- [ ] Logo not stretched, recoloured or crowded.
- [ ] Mio from the designer's files (or the app), not redrawn.
- [ ] No buyer data, passwords or admin screens visible.
- [ ] Permission from any seller shown.
- [ ] The link has a `utm_source` tag.
- [ ] No promised dates for unbuilt products; no invented numbers.
