# Khmio Engineering Standard

How every piece of Khmio is built: screens, the API, the worker and the
database. The aim is code that stays clean as the project grows. Nothing is
hard-coded, nothing is copied, and every change can be seen and undone.
Claude reads the short version in `CLAUDE.md` every session; this file has
the reasons and examples.

Related: `design/design-standard.md` (how screens look),
`docs/blueprint.md` (what the product does), `docs/database-changes.md` (what
each migration changed).

## 1. The four golden rules

1. **Search before you write.** Before building anything, look for the same
   thing in the code (Grep for the words, the pattern, the component). If it
   exists, use it. If it nearly exists, extend it.
2. **Second time = shared.** The first time something is needed, it can live
   in its screen or feature. The second time, it moves to a shared place and
   both users switch to it. Don't share something used once "just in case".
3. **Extend, don't copy.** A new look or behaviour of an existing part is a
   new `variant`, option or prop on that part, never a near-copy of it.
4. **Data drives the code.** Pass lists (rows, options, columns, steps) to one
   component or function instead of repeating markup or `if` chains. Adding a
   menu item, a filter or a status should be one new entry in a list.

## 2. Nothing hard-coded

| What | The one place | Never |
| --- | --- | --- |
| Words on screen | `apps/web/messages/km.json` and `en.json` (both, always) | English or Khmer text in a `.tsx` file |
| Colours | Tokens in `packages/ui/src/globals.css` (`bg-brand`, `text-muted`…) | `#229ED9`, `amber-500`, `text-white` on brand |
| Plan prices, limits, features | `packages/shared/src/plans.ts` | A number like `50` products in a screen or controller |
| Input rules | Zod schemas in `packages/shared` | A second copy of the rule in a screen or the API |
| Error messages | Codes in `packages/shared/src/form-errors.ts`, shown via `FormErrors` messages | English text sent by the API |
| Settings and secrets | `apps/api/src/config.ts` reading `.env` | A URL, key or token in code |
| Numbers that mean something | A named constant beside the code that uses it | A bare `5` or `200` |
| Dates and times | `packages/shared/src/time.ts` (`DAY_MS`, `phnomPenhTime`), `useDateText()` on screen | `7 * 60 * 60 * 1000`, `toLocaleDateString("km-KH")` |
| Audit actions | `AUDIT_ACTIONS` in `packages/shared/src/audit.ts`, written with `writeAudit` (`packages/db`) | `tx.auditLog.create(...)` with a name typed by hand |

A named constant says what the number is and why:

```ts
/** Most orders the list returns; older ones stay in the database. */
const ORDER_LIST_LIMIT = 200;
```

Brand names that are the same in every language (Telegram, KHQR, ABA
PayWay) may stay in code. Sample data lives in `apps/web/mock/`, never inside
a screen.

## 3. Frontend (`apps/web`, `packages/ui`)

**Where a part lives** (full rule: `design/design-standard.md` "Kit or app
block"):

- `packages/ui`, the kit: pure look and behaviour, no words, no Next.js, no
  business data. Example: Button, IconButton, ChoiceCards, MoneyInput.
- `apps/web/components`, app blocks: they need Next.js, translations or
  Khmio data. Example: DataGrid, MenuList, OrderStatusPill, CurrencyChoice.
- A screen folder holds only what that one screen uses.

**Every new or changed part:**

1. is shown on `/styleguide` first, inside a `Demo` with its name
   (`coverage.test.ts` fails otherwise);
2. takes its words as props, from the caller's `useTranslations`;
3. offers `variant`, `tone`, `size` and similar options instead of
   accepting long class lists from callers;
4. has a 44 px tap area, works with the keyboard, and has a label for
   screen readers when it's only an icon.

**Every page is assembled from the standard frames and blocks:**

| Need | Use |
| --- | --- |
| Seller page frame | `SubPage` / the seller frame |
| Admin page | `AdminFrame`, `PageHeader` |
| Buyer page | `BuyerShell`, `BuyerSection`, `BuyerBottomBar` |
| A form | `FormSection`, `FormActions`, the shared Zod schema, `focusFirstInvalidField` |
| A list or table | `DataGrid` (browser mode; server mode once a list keeps growing) |
| Empty, loading, error | `EmptyState`, `LoadingBlocks` / `Skeleton`, `ErrorState` |
| A risky action | `ConfirmDialog` |
| Pick one of a few | `ChoiceCards`, `SegmentedControl mode="choice"`, `Select` |
| Small text action, icon action | `Button variant="ghost"`, `IconButton` |
| Language switch | `LanguageSwitch` (`useLocaleSwitch` for a one-tap button) |
| A date or time | `useDateText()`: `timeAgo`, `clockTime`, `date`, `dateTime`, `day` |
| Photo or file | `FileButton` |

Lint stops a raw `<button>`, `<input>`, `<select>` or `<textarea>` in a live
screen. If one is truly needed, the line above it says why:

```tsx
// eslint-disable-next-line no-restricted-syntax -- the seller header's pill (HEADER_PILL), which shrinks to a round icon
```

**Talking to the server:** client screens call the API only through
`apps/web/lib/api.ts`, which handles the address, cookies and `ApiError`.
`api(path, schema, options)` reads the answer with its schema from
`lib/api-answers.ts` (admin: `lib/admin-api.ts`), so a screen never works on a
shape it only assumed; an answer of another shape becomes `ApiError`
"bad_answer" and the screen shows its error state. `apiSend(path, options)` is
for calls whose answer isn't used. Answer schemas check the shape, not the
input rules. Server pages that need data for the page title use
`apiBaseUrl()` with `fetch` and read the answer with the same schema. A screen
never builds its own `fetch` with headers.

**Kept on the device:** cart, drafts, list settings and recent searches go
through `apps/web/lib/device-storage.ts` (`readStored(key, schema)`,
`writeStored(key, value)`): what comes back is checked, and a blocked or full
storage never breaks the page.

**One screen, two data sources (decided 2026-10-28).** A screen is built
once, as one component in `apps/web/components/<feature>/` that takes its
data and actions as props. The mockup page renders it with sample data; the
live page renders it with data from `lib/api.ts`. The owner approves the
screen on the mockup, and going live only connects the data: there is never
a second copy to drift apart.

```
components/customers/customers-screen.tsx   ← the one screen, from the kit
mockup/dashboard/customers/page.tsx         ← sample data
m/(dash)/customers/page.tsx                 ← real data (lib/api.ts)
```

Sample data has the same type as the API's answer (the schema in
`lib/api-answers.ts`), so a mockup can't show something the API can't send.
Older screens built twice: when one is next worked on, its mockup page
renders the live screen's component with sample data, or is removed when
nothing but the live page needs it. Their lint warnings get fixed then too.

## 4. Backend (`apps/api`, `apps/worker`)

Every feature is one folder in `apps/api/src/<feature>/`, built like
`orders/`:

| File | Job |
| --- | --- |
| `<feature>.controller.ts` | Thin: route, guard, read input with the shared Zod schema, call a function, return its result |
| `<feature>.ts` or `<action>.ts` | The real work as plain functions taking `tx` and plain values, so tests can call them directly |
| `<feature>-list.ts` | `select` objects and mappers (`orderListSelect`, `toListedOrder`) that shape what leaves the API |
| `<name>.test.ts` | Tests beside the code, one for every rule and every fixed bug. Rules and mappers are pure functions tested without a database; rows for them come from `apps/api/src/testing/rows.ts`. Queries are checked end to end by `pnpm test:e2e` |

```ts
@Controller("orders")
@UseGuards(MerchantStoreGuard)
export class OrdersController {
  constructor(@Inject(APP_DB) private readonly app: AppDb) {}

  @Get("page")
  async page(@CurrentStore() context: MerchantStore, @Query() params: unknown) {
    const query = parseOrderListQuery(params);          // shared Zod, refuses anything else
    return withContext(this.app, context, (tx) =>       // row-level security for this shop
      readOrderListPage(tx, context.storeId, query));   // plain, tested function
  }
}
```

**Always the same way:**

- **Injection:** `@Inject(TOKEN)` with a token (`APP_DB`, `SYSTEM_DB`,
  `FILE_STORAGE`…), never by constructor type.
- **Shop data:** `AppDb` + `withContext()`, and every query filters by
  `store_id`. `SystemDb` only for login, sessions, creating a store, the
  worker and admin.
- **Input:** `@Body() body: unknown` / `@Query() params: unknown`, then a Zod
  schema from `packages/shared`. Never trust a type annotation on input.
- **Errors:** throw the Nest exception that matches; the global filter
  (`apps/api/src/errors.ts`) turns it into the one `ErrorBody` shape. A new
  kind of refusal adds a code to `ErrorBody`, not English text.
- **Lists:** a `ListSpec` in `packages/shared` + `readListPage`
  (`apps/api/src/list/list-page.ts`). Lists have a limit, always.
- **Plans:** limits checked in the API from `plans.ts` (`assertStoreWritable`,
  plan limits), not only hidden in the screen. Downgrade or pause locks data,
  never deletes it.
- **Admin:** every route has `AdminGuard` + `@AdminPermissionNeeded(...)`,
  and every change writes an audit row with `before` and `after`. Every audit
  row (admin, merchant or system, API or worker) is written with `writeAudit`
  from `packages/db`, inside the change's own transaction; its action is one
  of `AUDIT_ACTIONS`, and `messages.test.ts` checks the admin screen has a
  sentence for each.
- **Payments:** only through `packages/payments`, and a callback is always
  confirmed with the provider's status API.
- **Slow or outside work** (Telegram, payment checks, backups) goes to the
  worker through an `outbox_events` row or a pg-boss job, not inside the
  request.
- **Logs:** the shared logger; never log secrets, tokens, codes or full phone
  numbers.

## 5. Database (`packages/db`)

**Every change is a migration file.** Nothing is changed by hand, and no
`prisma db push` against a database that holds real data.

1. Edit `packages/db/prisma/schema.prisma`.
2. `pnpm db:migrate`, named after the feature: `invoice_tracking`,
   `garage_business_type`.
3. Read the SQL it wrote, and add by hand what Prisma can't write: row-level
   security, policies, `CHECK` rules, data fill-ins. Comment each part.
4. Add one plain-language line to `docs/database-changes.md`.
5. Before applying it, Claude shows the owner what it changes, in plain
   words.
6. `pnpm db:deploy` applies it; tests run against the new shape.

**Rules for a safe migration:**

- **Never edit an old migration.** A mistake is fixed by a new one.
- **Add first, remove later.** A new column is added with a default (or
  nullable) and filled in; the code switches to it; the old column is removed
  only in a later release. Going back one version then never breaks.
- **Every new table with `store_id`** enables row-level security and its
  `store_isolation` policy in the same migration, with an index on
  `store_id` (and on what lists sort or search by).
- **Money is integers:** `*_usd_cents` and `*_khr`. Never a float column.
- **Rules the data must always follow** (prices not negative, a variant has a
  price) are `CHECK` constraints as well as Zod rules.
- **Enums** grow by `ALTER TYPE … ADD VALUE`; a value is never renamed or
  removed while rows may use it.
- **Demo and test data** come from scripts (`pnpm --filter @khmio/api
  demo:garage`), never from a migration. A migration may only fix or fill
  real data (like `brand_khmio`), and says so in a comment.

## 6. Naming and code shape

- **Names say what a thing is:** `readOrderListPage`, `toListedOrder`,
  `MAX_PRODUCT_PHOTOS`. Files are `kebab-case`; React components and kit files
  `PascalCase`.
- **Comments** explain why, or what isn't obvious, in plain English, and
  point to the document that holds the rule (`docs/blueprint.md
  "Multi-currency pricing"`).
- **TypeScript is strict:** no `any`, no `as` to force a type you haven't
  checked; parse with Zod or narrow instead.
- **Small pieces:** a function does one job; a file that passes ~400 lines
  is a sign to split out a part or a helper. Old big files are split when
  they're next changed, not in a separate rewrite.
- **No dead code:** remove unused imports, props and files in the same
  change.
- **Folders:** `packages/shared/src` is grouped into folders after go-live
  (not before), so imports don't churn during launch.

## 7. How every change is made

1. **Plan first.** Say what will change, where, and why; wait for the
   owner's OK.
2. **Kit and shared parts first**, shown on `/styleguide`; then screens; then
   the API; the migration before the code that needs it.
3. **Checks:** `pnpm lint`, `pnpm typecheck`, `pnpm test` all green. Screens
   are opened in a browser at 360 px and laptop width, in Khmer and English.
4. **Summary:** what changed, which files, any migration in plain words, and
   what could not be tested.
5. **Commit and tag only when the owner asks** ("save vX.Y.Z").

## 8. What enforces this

| Check | Catches |
| --- | --- |
| `pnpm typecheck` | Wrong types, missing props, `any` slipping in |
| `pnpm lint` | Raw controls in live screens (error), in mockups (warning) |
| `apps/web/app/[locale]/styleguide/coverage.test.ts` | A kit part not shown on `/styleguide` |
| `apps/web/components/theme-contrast.test.ts` | A colour change that makes text hard to read |
| Tests beside each rule | A rule broken by a later change |
| Row-level security in the database | One shop seeing another's data, even after a code mistake |
| This document + `CLAUDE.md` | Everything else: read before building |
