import { Prisma, type Tx } from "@khmio/db";
import {
  CUSTOMER_LIST_SPEC,
  CUSTOMER_ORDER_HISTORY,
  listQueryFromParams,
  listQuerySchemaFor,
  NOT_SALE_STATUSES,
  phoneSearchDigits,
  type Currency,
  type DeliveryArea,
  type ListPage,
  type ListQuery,
} from "@khmio/shared";
import { orderListSelect, readStoreSlug, toListedOrder } from "../orders/order-list";

// The shop's customers (design/screens.md S14; every plan): the buyers the
// shop already keeps, with their numbers worked out by the database from
// their orders. The numbers count only sales (packages/shared orders.ts
// NOT_SALE_STATUSES) and keep dollars and riel apart. Read inside withContext:
// row-level security applies, and every query also filters by the store.
// One SQL query lists them, because the list sorts by totals ("most spent"),
// which the shared readListPage (Prisma where/orderBy) can't express.

export const customerListQuerySchema = listQuerySchemaFor(CUSTOMER_LIST_SPEC);
export const parseCustomerListQuery = (params: unknown) =>
  customerListQuerySchema.parse(listQueryFromParams(params && typeof params === "object" ? Object.fromEntries(Object.entries(params)) : {}));

type CustomerSort = (typeof CUSTOMER_LIST_SPEC.sorts)[number];
const CUSTOMER_SORTS: readonly string[] = CUSTOMER_LIST_SPEC.sorts;
const isCustomerSort = (sort: string): sort is CustomerSort => CUSTOMER_SORTS.includes(sort);

/** One customer with their numbers, as the database adds them up. */
interface CustomerStatsRow {
  id: string;
  name: string;
  phone: string;
  createdAt: Date;
  orderCount: number;
  spentUsd: bigint;
  spentKhr: bigint;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  orderCount: number;
  spent: Record<Currency, number>;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  createdAt: string;
}

/** The answer's shape: money as plain numbers (cents, riel), dates as ISO text. */
export function toCustomerRow(row: CustomerStatsRow): CustomerRow {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    orderCount: row.orderCount,
    spent: { USD: Number(row.spentUsd), KHR: Number(row.spentKhr) },
    firstOrderAt: row.firstOrderAt?.toISOString() ?? null,
    lastOrderAt: row.lastOrderAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A search box's text as LIKE text: % and _ are matched as themselves. */
const likeText = (text: string) => `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;

/** The search box: a name (any case) or a phone, typed any way (packages/shared phoneSearchDigits). */
export function customerSearchSql(q: string): Prisma.Sql {
  const text = q.trim();
  if (!text) return Prisma.sql`TRUE`;
  const phone = phoneSearchDigits(text);
  const byName = Prisma.sql`customers.name ILIKE ${likeText(text)}`;
  return phone ? Prisma.sql`(${byName} OR customers.phone LIKE ${likeText(phone)})` : byName;
}

/**
 * Each sort as SQL; never built from the request's text. Ties (and customers
 * with no orders that count yet, NULLS LAST) fall back to the newest customer.
 */
export function customerOrderBySql(sort: string, dir: "asc" | "desc", mainCurrency: Currency): Prisma.Sql {
  const key = isCustomerSort(sort) ? sort : CUSTOMER_LIST_SPEC.defaultSort.key;
  const direction = dir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const column: Record<CustomerSort, Prisma.Sql> = {
    lastOrder: Prisma.sql`"lastOrderAt"`,
    orders: Prisma.sql`"orderCount"`,
    // Sorted in the shop's main currency: dollars and riel are never added together.
    spent: mainCurrency === "USD" ? Prisma.sql`"spentUsd"` : Prisma.sql`"spentKhr"`,
    name: Prisma.sql`lower(customers.name)`,
    since: Prisma.sql`customers.created_at`,
  };
  return Prisma.sql`ORDER BY ${column[key]} ${direction} NULLS LAST, customers.created_at DESC, customers.id`;
}

/** Customers matching `where`, each with their numbers from the orders that count as sales. */
async function selectCustomers(tx: Tx, storeId: string, where: Prisma.Sql, tail: Prisma.Sql): Promise<CustomerStatsRow[]> {
  return tx.$queryRaw<CustomerStatsRow[]>`
    SELECT customers.id, customers.name, customers.phone, customers.created_at AS "createdAt",
           count(orders.id)::int AS "orderCount",
           coalesce(sum(orders.total_minor) FILTER (WHERE orders.currency = 'USD'), 0)::bigint AS "spentUsd",
           coalesce(sum(orders.total_minor) FILTER (WHERE orders.currency = 'KHR'), 0)::bigint AS "spentKhr",
           min(orders.created_at) AS "firstOrderAt",
           max(orders.created_at) AS "lastOrderAt"
      FROM customers
      LEFT JOIN orders
        ON orders.customer_id = customers.id
       AND orders.store_id = customers.store_id
       AND orders.status::text NOT IN (${Prisma.join(NOT_SALE_STATUSES)})
     WHERE customers.store_id = ${storeId}::uuid AND ${where}
     GROUP BY customers.id
     ${tail}`;
}

async function readMainCurrency(tx: Tx, storeId: string): Promise<Currency> {
  return (await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { defaultCurrency: true } })).defaultCurrency;
}

/** One page of the customer list (the data grid's server mode). */
export async function readCustomerPage(tx: Tx, storeId: string, query: ListQuery): Promise<ListPage<CustomerRow>> {
  const search = customerSearchSql(query.q);
  const mainCurrency = await readMainCurrency(tx, storeId);
  const [counted, rows] = await Promise.all([
    tx.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM customers WHERE customers.store_id = ${storeId}::uuid AND ${search}`,
    selectCustomers(
      tx,
      storeId,
      search,
      Prisma.sql`${customerOrderBySql(query.sort, query.dir, mainCurrency)} LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    ),
  ]);
  const total = counted[0]?.total ?? 0;
  return { rows: rows.map(toCustomerRow), total, page: query.page, pageSize: query.pageSize, chipCounts: { all: total } };
}

export interface CustomerDetail extends CustomerRow {
  area: DeliveryArea | null;
  districtId: string | null;
  provinceId: string | null;
  landmark: string;
  orders: ReturnType<typeof toListedOrder>[];
}

/** One customer: their numbers, their last delivery choice, and their newest orders (all of them, cancelled too). null = not this shop's. */
export async function readCustomer(tx: Tx, storeId: string, id: string): Promise<CustomerDetail | null> {
  const [stats] = await selectCustomers(tx, storeId, Prisma.sql`customers.id = ${id}::uuid`, Prisma.empty);
  if (!stats) return null;
  const [place, slug, orders] = await Promise.all([
    tx.customer.findFirstOrThrow({ where: { id, storeId }, select: { area: true, districtId: true, provinceId: true, landmark: true } }),
    readStoreSlug(tx, storeId),
    tx.order.findMany({ where: { storeId, customerId: id }, orderBy: { createdAt: "desc" }, take: CUSTOMER_ORDER_HISTORY, select: orderListSelect }),
  ]);
  return { ...toCustomerRow(stats), ...place, orders: orders.map((order) => toListedOrder(order, slug)) };
}
