import type { Prisma, Tx } from "@khmio/db";
import {
  listQueryFromParams,
  listQuerySchemaFor,
  parseDocumentNumber,
  phnomPenhDay,
  isDueSoon,
  PURCHASE_LIST_SPEC,
  PURCHASE_PAYMENT_STATES,
  PURCHASE_PERIODS,
  purchasePeriodDays,
  type GoodsState,
  type Currency,
  type ListPage,
  type ListQuery,
  type PurchasePeriod,
} from "@khmio/shared";
import { readListPage } from "../list/list-page";
import { owedTotals, readBillBalances, type BillBalance } from "./bill-balances";
import { dateOf, dayOf } from "./purchase-days";

// The purchase list (design/screens.md S13 "Purchases"): bills and returns
// page by page, with search, chips, filters (supplier, currency, period,
// payment, goods arrived or not, due soon), where each bill stands with its supplier,
// what the list shows was bought, and what the shop owes.

export const purchaseListQuerySchema = listQuerySchemaFor(PURCHASE_LIST_SPEC);
export const parsePurchaseListQuery = (params: unknown) =>
  purchaseListQuerySchema.parse(listQueryFromParams(params && typeof params === "object" ? Object.fromEntries(Object.entries(params)) : {}));

export const purchaseListSelect = {
  id: true,
  number: true,
  kind: true,
  billRef: true,
  purchasedOn: true,
  dueOn: true,
  receivedAt: true,
  currency: true,
  totalMinor: true,
  supplier: { select: { id: true, name: true } },
  returns: { select: { id: true, number: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.PurchaseSelect;
type ListedPurchaseRow = Prisma.PurchaseGetPayload<{ select: typeof purchaseListSelect }>;

/** A row of the list: a return has no payment of its own (null); a bill says what it still owes and where it stands. */
export function toListedPurchase({ purchasedOn, dueOn, receivedAt, supplier, returns, _count, ...purchase }: ListedPurchaseRow, balance: BillBalance | undefined) {
  return {
    ...purchase,
    /** The goods arrived and stock went up (a return always); null: not received yet. */
    receivedAt: receivedAt?.toISOString() ?? null,
    purchasedOn: dayOf(purchasedOn),
    dueOn: dueOn ? dayOf(dueOn) : null,
    supplierId: supplier?.id ?? null,
    supplierName: supplier?.name ?? "",
    returnsId: returns?.id ?? null,
    returnsNumber: returns?.number ?? null,
    lineCount: _count.lines,
    payment: purchase.kind === "purchase" && balance ? { paid: balance.paid, returned: balance.returned, owed: balance.owed, state: balance.state } : null,
  };
}

type PurchaseSort = (typeof PURCHASE_LIST_SPEC.sorts)[number];
const PURCHASE_BY: Record<PurchaseSort, (dir: Prisma.SortOrder) => Prisma.PurchaseOrderByWithRelationInput[]> = {
  date: (dir) => [{ purchasedOn: dir }, { number: dir }],
  number: (dir) => [{ number: dir }],
  supplier: (dir) => [{ supplier: { name: dir } }, { number: "desc" }],
  total: (dir) => [{ totalMinor: dir }, { number: "desc" }],
};
const PURCHASE_SORTS: readonly string[] = PURCHASE_LIST_SPEC.sorts;
const isPurchaseSort = (sort: string): sort is PurchaseSort => PURCHASE_SORTS.includes(sort);

/** The search box: the supplier's name, their bill number, or ours (BILL-0012, RET-3, #12 or 12). */
export function purchaseSearchWhere(q: string): Prisma.PurchaseWhereInput | null {
  const text = q.trim();
  if (!text) return null;
  const ours = parseDocumentNumber(text);
  const kind: Prisma.PurchaseWhereInput = ours?.series === "bill" ? { kind: "purchase" } : ours?.series === "return" ? { kind: "return" } : {};
  return {
    OR: [
      { supplier: { name: { contains: text, mode: "insensitive" } } },
      { billRef: { contains: text, mode: "insensitive" } },
      // Only BILL, RET or no prefix finds a bill or return (a payment's or a count's number isn't one).
      ...(ours && (ours.series === null || ours.series === "bill" || ours.series === "return") ? [{ number: ours.number, ...kind }] : []),
    ],
  };
}

/** Bills on a day within the period (Phnom Penh). */
export function purchasePeriodWhere(period: PurchasePeriod, now: Date): Prisma.PurchaseWhereInput {
  const { from, to } = purchasePeriodDays(period, phnomPenhDay(now));
  return { purchasedOn: { gte: dateOf(from), lte: dateOf(to) } };
}

const CURRENCIES: readonly Currency[] = ["USD", "KHR"];
/** The goods filter: arrived, or not yet (a return is never "not received"). */
const GOODS_WHERE: Record<GoodsState, Prisma.PurchaseWhereInput> = { received: { kind: "purchase", receivedAt: { not: null } }, not_received: { kind: "purchase", receivedAt: null } };
type PurchaseChip = (typeof PURCHASE_LIST_SPEC.chips)[number];
const PURCHASE_CHIPS: Record<PurchaseChip, Prisma.PurchaseWhereInput> = { purchase: { kind: "purchase" }, return: { kind: "return" }, not_received: { kind: "purchase", receivedAt: null } };
const CHIP_KEYS: readonly string[] = PURCHASE_LIST_SPEC.chips;
const isPurchaseChip = (chip: string): chip is PurchaseChip => CHIP_KEYS.includes(chip);

/**
 * One page of the purchase list, with what was bought in what the list shows
 * (search, chip and filters applied: bills less returns), and what the shop
 * owes its suppliers in all — dollars and riel apart.
 */
export async function readPurchaseListPage(
  tx: Tx,
  storeId: string,
  query: ListQuery,
  now = new Date(),
): Promise<ListPage<ReturnType<typeof toListedPurchase>> & { totals: Record<Currency, number>; owed: Record<Currency, number> }> {
  const sort = isPurchaseSort(query.sort) ? query.sort : PURCHASE_LIST_SPEC.defaultSort.key;
  const today = phnomPenhDay(now);
  const [suppliers, balances] = await Promise.all([tx.supplier.findMany({ where: { storeId }, select: { id: true } }), readBillBalances(tx, storeId, today)]);
  const balanceOf = new Map(balances.map((balance) => [balance.id, balance]));
  /** Bills whose balance passes a test (a standing is worked out from returns and payments, so it filters by the bills' ids). */
  const billsWhere = (passes: (balance: BillBalance) => boolean): Prisma.PurchaseWhereInput => ({ id: { in: balances.filter(passes).map((balance) => balance.id) } });
  const filterOptions: Record<string, Record<string, Prisma.PurchaseWhereInput>> = {
    supplier: Object.fromEntries(suppliers.map((supplier) => [supplier.id, { supplierId: supplier.id }])),
    currency: Object.fromEntries(CURRENCIES.map((currency) => [currency, { currency }])),
    period: Object.fromEntries(PURCHASE_PERIODS.map((period) => [period, purchasePeriodWhere(period, now)])),
    payment: {
      ...Object.fromEntries(PURCHASE_PAYMENT_STATES.map((state) => [state, billsWhere((balance) => balance.state === state)])),
      // "Unpaid" on the Purchases page: owing, not late yet.
      open: billsWhere((balance) => balance.state === "unpaid" || balance.state === "part"),
    },
    goods: GOODS_WHERE,
    due: { due_soon: billsWhere((balance) => isDueSoon(balance, today)) },
  };
  const chosen = Object.fromEntries(
    Object.entries(query.filters).flatMap(([key, value]) => {
      const where = filterOptions[key]?.[value];
      return where ? [[key, where]] : [];
    }),
  );
  const search = purchaseSearchWhere(query.q);
  const page = await readListPage({
    query,
    base: { storeId },
    search,
    chips: PURCHASE_CHIPS,
    filters: chosen,
    filterOptions,
    orderBy: PURCHASE_BY[sort](query.dir),
    count: (where: Prisma.PurchaseWhereInput) => tx.purchase.count({ where }),
    find: ({ where, orderBy, skip, take }) => tx.purchase.findMany({ where, orderBy, skip, take, select: purchaseListSelect }),
  });
  const chip = isPurchaseChip(query.chip) ? PURCHASE_CHIPS[query.chip] : null;
  const sums = await tx.purchase.groupBy({
    by: ["kind", "currency"],
    where: { AND: [{ storeId }, ...(search ? [search] : []), ...(chip ? [chip] : []), ...Object.values(chosen)] },
    _sum: { totalMinor: true },
  });
  const totals: Record<Currency, number> = { USD: 0, KHR: 0 };
  for (const sum of sums) totals[sum.currency] += (sum.kind === "return" ? -1 : 1) * (sum._sum.totalMinor ?? 0);
  return { ...page, rows: page.rows.map((row) => toListedPurchase(row, balanceOf.get(row.id))), totals, owed: owedTotals(balances) };
}
