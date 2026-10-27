# Go live — click by click

The order to follow on the day you buy hosting, from an empty account to the
first real seller. Everything in the code is ready (roadmap step 8, parts
B1–B4); this is only accounts, settings and checks. Plan an afternoon.
Names in `CAPITALS` are settings (environment variables): this page lists
**names only** — values go straight into Vercel and Railway, never into Git,
chat or this file.

Throughout, `<domain>` is the brand's domain, `khmio.com` (brand: docs/platform-launch-plan.md, Stage 1):

| Address | What | Where |
| --- | --- | --- |
| `https://<domain>` | Shop pages, seller and admin screens | Vercel |
| `https://api.<domain>` | API | Railway |
| `https://files.<domain>` | Product photos | Cloudflare R2 |

Keep this domain for this project only: never put another project on a
sub-domain of it (docs/blueprint.md "Growth path", running other projects).

---

## 0. Before you buy

- [ ] `pnpm rehearsal` passed the full flow on a phone (step 13 below lists it).
- [ ] CI is green on the branch you will deploy (lint, types, unit tests,
      `pnpm test:e2e`, Docker images).
- [x] Domain name chosen: `khmio.com`, bought together with `khmio.app` (a `.com.kh` would need Cambodian documents).
- [ ] An international Visa or Mastercard that pays online.
- [ ] Decided: start cash-on-delivery only, or wait for KHQR (blueprint: a cash-only beta is allowed).

## 1. Accounts

1. **Cloudflare** (free): sign up at dash.cloudflare.com.
2. **Vercel**: sign up with GitHub, create a team, choose **Pro** ($20 per person per month).
3. **Railway**: sign up with GitHub, choose **Pro** ($20 per month including $20 of usage).
4. Spending limits, so a mistake or an attack can't run up a bill:
   - Railway → Workspace settings → Usage → **Usage limit**: $40 to start (raise it as shops grow).
   - Vercel → Team settings → Billing → **Spend management**: a monthly limit with an alert.

## 2. Domain (Cloudflare)

1. Cloudflare → Domain registration → **Register domain** → buy `<domain>` (at cost, ~$10–15 a year).
2. Its DNS is then in Cloudflare already. The records are added in steps 6 and 7.
3. SSL/TLS → Overview → **Full (strict)**. SSL/TLS → Edge certificates → **Always use HTTPS**: on.

## 3. Photos and backups (Cloudflare R2)

1. R2 → **Create bucket** `khmio-photos` → Location: **Asia-Pacific** (location hint).
   Settings → Public access → **Connect domain** → `files.<domain>`.
2. R2 → **Create bucket** `khmio-backups` → Asia-Pacific. **No** public access, ever:
   it holds every buyer's phone and address.
3. R2 → Manage API tokens → **Create API token**: permission *Object Read & Write*,
   **only** the buckets `khmio-photos` and `khmio-backups`. Note the Access Key ID,
   Secret Access Key and the S3 endpoint (`https://<account id>.r2.cloudflarestorage.com`)
   for step 6 — paste them straight into Railway.
4. Rules → Transform rules → **Modify response header** for `files.<domain>`:
   set `X-Content-Type-Options` = `nosniff`.

## 4. Bot check (Cloudflare Turnstile)

Turnstile → **Add site** → `<domain>`, widget mode **Managed**. Keep the
site key (web, step 7) and the secret key (API, step 6).

## 5. The production Telegram bot

Keep the test bot for your PC; production gets its own.

1. Telegram → @BotFather → `/newbot` → name `Khmio` and username `khmio_bot` (free on 2026-10-06).
   The token goes straight into Railway (step 6).
2. `/setdomain` → the new bot → `<domain>` (the "Log in with Telegram" button only works there).
3. `/setdescription`, `/setabouttext`, `/setuserpic`: in Khmer and English.

## 6. API, worker and database (Railway)

1. **New project** → **Deploy PostgreSQL**, version **17 or older**. Service settings → Region: **Singapore**.
   The worker's backup tool is `pg_dump` 17 (`infra/docker/worker.Dockerfile`), and it can't
   back up a newer database. If Railway only offers 18: change `postgresql-client-17` to `-18`
   in that Dockerfile and the `pg_dump … 17` check in `.github/workflows/`, before deploying.
2. Create the two database users (once):
   - Postgres service → Settings → Networking → enable the **TCP proxy** for now.
   - On your PC: make two passwords
     (`node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`), then
     `"C:\Program Files\PostgreSQL\16\bin\psql.exe" "<the public postgres URL from Railway>" -v owner_password=… -v app_password=… -f infra/setup-production-db.sql`
     (the full path: the PostgreSQL installer doesn't add `psql` to the PATH)
   - **Disable the TCP proxy again.** From now on the database is reachable only inside Railway.
3. **New service → GitHub repo** (this repo) — this is the **API**:
   - Settings → Config-as-code path: `/apps/api/railway.json` (Dockerfile, migrations
     before each release, health check). Region: **Singapore**.
   - Variables:
     | Name | Value |
     | --- | --- |
     | `NODE_ENV` | `production` |
     | `DATABASE_OWNER_URL` | `postgresql://khmer_micro_store:<owner password>@postgres.railway.internal:5432/kms` |
     | `DATABASE_URL` | `postgresql://khmer_micro_store_app:<app password>@postgres.railway.internal:5432/kms` |
     | `WEB_ORIGIN` | `https://<domain>` |
     | `TELEGRAM_BOT_TOKEN` | the production bot's token |
     | `ADMIN_SECRETS_KEY` | a new one: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — never the local one |
     | `TURNSTILE_SECRET_KEY` | from step 4 |
     | `FILE_STORAGE` | `s3` |
     | `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | from step 3 |
     | `S3_REGION` | `auto` |
     | `S3_BUCKET` | `khmio-photos` |
     | `FILES_PUBLIC_URL` | `https://files.<domain>` |
     | `TRUST_PROXY_HOPS` | `2` with Cloudflare's proxy in front (orange cloud), `1` without — check it in step 12 |
     | `SENTRY_DSN` | from sentry.io (free), optional |
   - Settings → Networking → **Custom domain** `api.<domain>`; add the CNAME it shows in
     Cloudflare DNS, **proxied** (orange cloud): the API then gets Cloudflare's WAF.
4. **New service → the same repo** — this is the **worker**:
   - Config-as-code path: `/apps/worker/railway.json` (never two copies at once). Region: **Singapore**.
   - Variables: `NODE_ENV`, `DATABASE_OWNER_URL`, `WEB_ORIGIN`, `TELEGRAM_BOT_TOKEN`,
     `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` (same values as the API),
     `BACKUPS=on`, `S3_BACKUP_BUCKET=khmio-backups`, optional `SENTRY_DSN`. No domain.
5. Both services deploy. The API's log shows the migrations, then `API listening`; the
   worker's shows `worker started` with `telegram: on, backups: on`. A missing or wrong
   setting stops the start and names it (never its value).
6. Postgres service → Backups: turn on Railway's own daily backups too.

## 7. Web (Vercel)

1. **Add new project** → import this repo → Root directory: `apps/web` (`vercel.json`
   sets the build and the Singapore region).
2. Environment variables (Production):
   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://api.<domain>` |
   | `NEXT_PUBLIC_FILES_ORIGIN` | `https://files.<domain>` |
   | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | the production bot's username |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from step 4 |
   | `NEXT_PUBLIC_SITE_URL` | `https://<domain>` (link previews, sitemap, search) |
3. Deploy. Then Settings → Domains → add `<domain>` (and `www.<domain>` redirecting to it).
   In Cloudflare DNS add the records Vercel shows, **DNS only** (grey cloud) — Vercel
   serves its own certificates and edge.

## 8. The first platform owner

Railway → API service → the **⋯ → SSH** (or `railway ssh`), then:

```
pnpm admin:add-owner -- --telegram-id <your Telegram id> --name "<your name>"
```

Then open `https://<domain>/km/admin`, log in with Telegram and set up the
authenticator app on **your** phone. Keep the 8 backup codes on paper. In
admin Settings, set the alert chat.

## 9. Protect the admin and the repo

1. Cloudflare → Security → WAF → **Custom rule** on `api.<domain>`: if URI path starts with
   `/admin` and the country is not Cambodia (or the IP isn't yours) → **Block**.
2. GitHub → repo Settings → Rules → **New branch ruleset** for `main`: require a pull
   request and the CI checks to pass; block force pushes.

## 10. Watch it

1. A free uptime monitor (UptimeRobot or Better Stack) every 5 minutes on
   `https://api.<domain>/health` and `https://<domain>/km`, alerting your Telegram or email.
2. Sentry alerts (if `SENTRY_DSN` is set) to your email or Telegram.

## 11. Smoke test (about 30 minutes, on your phone, mobile data)

- [ ] `https://<domain>/km`: page loads in Kantumruy Pro, padlock shown.
- [ ] Seller: Log in with Telegram → 2 questions → shop open.
- [ ] Add a product with 2 photos → photos load from `files.<domain>`; the shop grid shows them.
- [ ] Shop details: phone, shop address, a Google Maps link (tap "Check your map link": the right pin opens), pickup on with hours, Telegram → Save.
- [ ] Delivery zones saved; its Pickup row shows "Pickup is on · address" → the checklist reaches "Share your shop" → Share works.
- [ ] Buyer (another phone): open the shop link → **Shop info & contact** → Call opens the dialler, Map opens the right pin, Telegram opens the app; the sheet lists the delivery fees.
- [ ] Buyer: cart → checkout (the bot check passes silently) → order page → **My orders** and **Track my order** → the back arrow returns to the shop.
- [ ] The seller's Telegram gets the alert with **Confirm** and **Open**; Confirm works.
- [ ] Buyer taps "Get updates on Telegram" → presses Start → gets the "confirmed" message.
- [ ] Seller moves the order to delivered and cash collected; the buyer's page follows.
- [ ] Add the bot to a staff group from My shop → the group gets the next alert.
- [ ] Shop details › Getting paid: upload the payment QR from your bank app (follow "How to get your payment QR").
- [ ] **Sell in shop** (Home's first tile): a cash sale → the change shown → Receipt at 80 mm → Print or Share works; a **Shop QR** sale (pay yourself a small amount, tick only after it shows in the bank app); no Telegram alert for either.
- [ ] Today's sales: cash and shop QR totals are right → Void one → it's crossed out and not counted; Orders → filter **In shop** shows both.
- [ ] **Stock** (a Pro shop: Products → Stock): start tracking one product at 2 → the buyer's shop shows "Only 2 left" → sell 2 in the shop → it shows **Sold out** and the cart can't add it → void that sale → the count is back to 2 and the history says "Back from #…". A correction with reason "Other" needs a note; Stop tracking asks first.
- [ ] Admin: login with the authenticator code → the shop is listed → extend its trial → it's in the audit log.
- [ ] Worker log: `database backup done` after 03:00 the next night, or run it now:
      Railway → worker → SSH → `pnpm db:backup`.

## 12. Check the rate limits see real addresses

From phone A on mobile data, fail the seller login 21 times in 10 minutes
(send a bad login to `https://api.<domain>/auth/telegram` — ask Claude Code
for the one-line command). Phone A then gets "too many tries"; phone B on Wi-Fi must still log in.
If phone B is blocked too, `TRUST_PROXY_HOPS` is too low; if A is never
blocked, too high. Fix the number, redeploy, try again.

## 13. Rehearse a release before each deploy (on your PC)

```
pnpm s3:up          (another window, keep it running)
pnpm rehearsal -- --fresh --owner <your Telegram id>
```

The whole system as production runs it, on a public `https://….trycloudflare.com`
address. Point the **test** bot at it (`/setdomain` in @BotFather — each new
tunnel needs it again), then run the smoke test of step 11 on your phone.

`--owner` makes you the owner again and **resets your authenticator (2FA)** in
the rehearsal database: the admin login asks you to scan a new QR code each
time. Delete the previous rehearsal entry from your authenticator app so you
never type an old code. Your real (production) authenticator isn't touched.

## When something goes wrong

| Problem | Do this |
| --- | --- |
| A release broke something | Vercel → Deployments → previous one → **Instant rollback**. Railway → service → Deployments → previous one → **Redeploy**. Migrations only ever add, so the older code still runs on the newer database |
| A service won't start | Its log names the setting that's missing or wrong. Fix it in Variables; Railway redeploys |
| The database is lost or corrupted | Make a new Postgres (Singapore), run `infra/setup-production-db.sql` on it, then from the worker's SSH: `RESTORE_DATABASE_URL=<new owner URL> pnpm db:restore -- --from latest`. Compare the counts it prints, then point both services' database variables at it |
| Telegram alerts stopped | Worker log; the admin chat gets "worker failing" alerts. Check the token wasn't revoked |
| A backup failed | The admin chat gets "backup failed" with the reason; the earlier backups are kept. Admin → **Backups** shows it in red; fix the cause, then press **Backup now** |
| Under attack | Cloudflare → Security → **Under Attack mode** for `api.<domain>`; rate limits and Turnstile already slow checkout abuse |

## Every month

- Restore last night's backup into a new database (the "database is lost" steps, without switching) and open a shop from it. Then, in Admin → **Backups**, press **I tested a full restore today** (the page turns it amber after 35 days).
- Railway → Usage: compare with docs/blueprint.md "How Railway usage adds up".
- Merge Dependabot's pull requests once CI is green.

## When KHQR arrives

Add `BAKONG_OPEN_API_TOKEN` to the worker and API (roadmap step 5), check Bakong
answers from Railway's Singapore servers (gate G3), then tick the KHQR items in
docs/blueprint.md "Launch checklist".
