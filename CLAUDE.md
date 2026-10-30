# Khmio

Micro-merchant e-commerce PWA for Cambodia: Bakong KHQR + ABA PayWay,
Telegram alerts, Khmer/English. Full plan: docs/blueprint.md

**Khmio is the main brand (2026-10-28):** every part of a small business in
one simple app, for Cambodia (Khmer, KHQR, riel, Telegram, phone first).
Sign-up is open to every business type (OFFERED_BUSINESS_TYPES in
packages/shared/business.ts); the garage is the most tested — every change is
tried first on the Demo Garage (`pnpm demo:garage`) — and the other
industries are in beta. `pnpm data:garage-only` clears a development
database back to the garage. Full purpose: docs/blueprint.md "Garage first";
which business comes next, and what each needs: docs/blueprint.md "Business
roadmap".

## How I work (follow this order)
1. Live pages only, no mockups: build each screen as a real page on the kit,
   from its spec in design/screens.md, with the API behind it. I approve it on
   the live page with the Demo Garage's data (docs/engineering-standard.md
   "Live pages only"). Old mockups are in git history (tag v0.5.1), not in
   the code.
2. Build features one at a time, per docs/blueprint.md roadmap.
3. Always propose a plan and wait for my OK before writing code.
4. After coding: run lint, typecheck, tests; fix failures; summarize changes.
5. Never commit unless I ask.

## Stack
pnpm + Turborepo monorepo. apps/web Next.js App Router + Tailwind +
shadcn/ui + next-intl (km default, en). apps/api NestJS. apps/worker pg-boss
(jobs kept in PostgreSQL).
packages/shared Zod schemas. packages/db Prisma + PostgreSQL.
packages/payments provider adapters. Local database: PostgreSQL 16 installed on
Windows (one-time setup: infra/setup-local-db.cmd), or `pnpm db:up` with Docker.
NestJS injection uses explicit tokens (@Inject(TOKEN)), never constructor types.
Shop data goes through packages/db AppDb + withContext() (row-level security);
SystemDb only for login, sessions, creating a store, the worker and admin.
Admin routes: AdminGuard + @AdminPermissionNeeded(...) from packages/shared/admin-roles.ts on every route;
admin login is Telegram then a TOTP code (ADMIN_SECRETS_KEY encrypts the secrets); never log either.
Every new table with store_id must enable RLS in its migration.

## Commands
pnpm db:up (start Postgres) | pnpm dev | pnpm lint | pnpm typecheck | pnpm test |
pnpm db:migrate (new migration) | pnpm db:deploy (apply migrations)
pnpm admin:add-owner -- --telegram-id <id> --name "<name>" (make/reset a platform owner; resets their 2FA)
pnpm demo:garage [-- --reset | --stock] (the Demo Garage to test with; --stock adds its suppliers, bills and counts once) | pnpm data:garage-only [-- --yes]
(development: delete every shop but the garage(s), with their photos; lists first)

## Rules
- Prices are integers: price_usd_cents, price_khr (riel). A product may have
  one or both. Buyer picks ONE currency for the whole order at checkout, not
  per item. Missing-currency lines convert via the store's usd_to_khr_rate
  (clamped to a platform-allowed band) at checkout time; round each line
  first, then sum — never convert-then-round the total. Freeze
  exchange_rate_used onto the order. Payment verification never re-converts:
  accept only an exact integer match on currency + total_minor. Full
  rationale: docs/blueprint.md "Multi-currency pricing and totals".
- Phone: accept 012 345 678 and 097 123 4567, +855 or 855 prefix; strip spaces,
  prefix and leading 0; 8-9 digits remain; save as 855XXXXXXXX(X).
- Every merchant query filters by store_id. No `any`. Zod on every input.
- Plan features/limits only from packages/shared/plans.ts; enforce in the API,
  not just the UI. Downgrade/pause locks data, never deletes it. Full rules:
  docs/blueprint.md "Subscription tiers".
- No hard-coded text: use messages/km.json and messages/en.json.
- Payment providers only through packages/payments. Never trust a callback
  alone: always confirm with the provider's status API.
- Mobile-first 360px, tap targets 44px, Khmer font Kantumruy Pro, line-height 1.5+.
- Brand and project name: Khmio (formerly Khmer Micro-Store — database names
  and users still say khmer_micro_store, by design); mascot Mio, drawn only by the
  Mio component in packages/ui. Brand, colours, fonts, marketing:
  design/brand-guide.md. Doc map, prompts, error playbook: docs/handbook.md.
- Never print, log or commit secrets. Never edit an old migration.

## Engineering standard (full rules + examples: docs/engineering-standard.md)
- Search before writing; reuse or extend what exists. Second use = shared
  piece. A new look/behaviour is a variant or prop, never a near-copy.
- Data drives code: lists of rows/options/columns into one component or
  function, not repeated markup or if-chains.
- Nothing hard-coded: words in messages, colours as tokens, limits in
  plans.ts, rules as Zod in packages/shared, settings in config.ts, numbers
  as named constants.
- Frontend: kit (packages/ui) vs app block (apps/web/components) per
  design/design-standard.md; shown on /styleguide first; pages use the
  standard frames, form-ui, DataGrid and states; client calls via lib/api.ts.
- Backend: one folder per feature; thin controller (guard, Zod, call);
  logic in plain tested functions; select + mapper for output; one ErrorBody
  shape with codes; lists via ListSpec + readListPage; admin changes audited.
- Database: every change is a new migration via pnpm db:migrate, named for
  the feature, SQL read and commented, a line added to
  docs/database-changes.md, explained to me in plain words before it's
  applied. Add first, remove in a later release. Demo data via scripts.
- No `as` to force a type; parse or narrow. No dead code left behind.
