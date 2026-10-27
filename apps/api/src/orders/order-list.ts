import type { Prisma } from "@khmio/db";
import { formatTrackingCode, listQueryFromParams, listQuerySchemaFor, ORDER_LIST_SPEC, ORDER_TABS, orderStatusesForTab, parseTrackingCode, type ListPage, type ListQuery, type OrderTab } from "@khmio/shared";
import { readListPage } from "../list/list-page";

export const orderListQuerySchema = listQuerySchemaFor(ORDER_LIST_SPEC);
export const parseOrderListQuery = (params: unknown) => orderListQuerySchema.parse(listQueryFromParams(params && typeof params === "object" ? Object.fromEntries(Object.entries(params)) : {}));

export const orderListSelect = {
  id: true,
  orderNumber: true,
  channel: true,
  trackingCode: true,
  status: true,
  paymentMethod: true,
  currency: true,
  totalMinor: true,
  buyerName: true,
  buyerPhone: true,
  fulfilment: true,
  area: true,
  districtId: true,
  provinceId: true,
  createdAt: true,
  items: { select: { quantity: true } },
} satisfies Prisma.OrderSelect;

type ListedOrder = Prisma.OrderGetPayload<{ select: typeof orderListSelect }>;

/** One order as the list shows it: the tracking code as printed, and how many items. */
export function toListedOrder({ items, trackingCode, ...order }: ListedOrder, storeSlug: string) {
  return { ...order, trackingCode: formatTrackingCode(storeSlug, trackingCode), itemCount: items.reduce((sum, item) => sum + item.quantity, 0) };
}

/**
 * The search box: a buyer's name (any case), their phone (as typed: 012 345
 * 678, 855…, or part of it), the order number, or the tracking code (with or
 * without the shop part and dashes).
 */
export function orderSearchWhere(q: string): Prisma.OrderWhereInput | null {
  const text = q.trim();
  if (!text) return null;
  const or: Prisma.OrderWhereInput[] = [{ buyerName: { contains: text, mode: "insensitive" } }];
  const digits = text.replace(/\D/g, "");
  if (digits && /^[\d\s+#-]+$/.test(text)) {
    const number = Number(digits.replace(/^#/, ""));
    if (Number.isSafeInteger(number) && number <= 2_147_483_647) or.push({ orderNumber: number });
    // Phones are saved as 855XXXXXXXX: drop what the buyer's way of writing adds.
    const phone = digits.replace(/^855/, "").replace(/^0/, "");
    if (phone.length >= 3) or.push({ buyerPhone: { contains: phone } });
  }
  const code = parseTrackingCode(text);
  if (code) or.push({ trackingCode: code });
  return { OR: or };
}

const tabWhere = (tab: OrderTab): Prisma.OrderWhereInput => ({ status: { in: orderStatusesForTab(tab) } });

/** Each filter value as a where (keys and values from ORDER_LIST_SPEC.filters). */
const ORDER_FILTER_WHERE: { [K in keyof typeof ORDER_LIST_SPEC.filters]: Record<(typeof ORDER_LIST_SPEC.filters)[K][number], Prisma.OrderWhereInput> } = {
  // "Online" = paid on the shop page (KHQR, PayWay) — not cash on delivery, and not a sale at the counter.
  payment: { online: { paymentMethod: { in: ["khqr", "aba_payway"] } }, cod: { paymentMethod: "cod" } },
  fulfilment: { delivery: { fulfilment: "delivery" }, pickup: { fulfilment: "pickup" }, in_store: { fulfilment: "in_store" } },
};

type OrderSort = (typeof ORDER_LIST_SPEC.sorts)[number];
const ORDER_BY: Record<OrderSort, (dir: Prisma.SortOrder) => Prisma.OrderOrderByWithRelationInput[]> = {
  order: (dir) => [{ createdAt: dir }],
  buyer: (dir) => [{ buyerName: dir }, { createdAt: "desc" }],
  total: (dir) => [{ totalMinor: dir }, { createdAt: "desc" }],
  status: (dir) => [{ status: dir }, { createdAt: "desc" }],
};
const ORDER_SORTS: readonly string[] = ORDER_LIST_SPEC.sorts;
const isOrderSort = (sort: string): sort is OrderSort => ORDER_SORTS.includes(sort);

/**
 * One page of the seller's orders (the data grid's server mode). Under "All"
 * sorted by date, pages walk the steps in the order work happens (to confirm,
 * packing, sending, delivered, problems, not paid yet), as the list groups them.
 */
export async function readOrderListPage(tx: Prisma.TransactionClient, storeId: string, storeSlug: string, query: ListQuery): Promise<ListPage<ReturnType<typeof toListedOrder>>> {
  const filterWhere: Record<string, Record<string, Prisma.OrderWhereInput>> = ORDER_FILTER_WHERE;
  const chosen = Object.entries(query.filters).flatMap(([key, value]) => {
    const where = filterWhere[key]?.[value];
    return where ? [[key, where] as const] : [];
  });
  const sort = isOrderSort(query.sort) ? query.sort : ORDER_LIST_SPEC.defaultSort.key;
  const grouped = query.chip === "all" && sort === "order";
  const page = await readListPage({
    query,
    base: { storeId },
    search: orderSearchWhere(query.q),
    chips: Object.fromEntries(ORDER_TABS.map((tab) => [tab, tabWhere(tab)])),
    filters: Object.fromEntries(chosen),
    filterOptions: ORDER_FILTER_WHERE,
    orderBy: ORDER_BY[sort](query.dir),
    sections: grouped ? [...ORDER_TABS, "awaiting" as const].map((tab) => ({ key: tab, where: tabWhere(tab) })) : undefined,
    count: (where: Prisma.OrderWhereInput) => tx.order.count({ where }),
    find: ({ where, orderBy, skip, take }) => tx.order.findMany({ where, orderBy, skip, take, select: orderListSelect }),
  });
  return { ...page, rows: page.rows.map((order) => toListedOrder(order, storeSlug)) };
}

/** Most orders the plain list returns; older ones stay in the database. */
const ORDER_LIST_LIMIT = 200;

/** The store's link, which prints every tracking code (MEK-7K4P-9QXR). */
export async function readStoreSlug(tx: Prisma.TransactionClient, storeId: string): Promise<string> {
  return (await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { slug: true } })).slug;
}

/** The newest orders, with the tracking code as printed so the list's search finds an order by it. */
export async function readOrderList(tx: Prisma.TransactionClient, storeId: string) {
  const [slug, orders] = await Promise.all([
    readStoreSlug(tx, storeId),
    tx.order.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: ORDER_LIST_LIMIT, select: orderListSelect }),
  ]);
  return orders.map((order) => toListedOrder(order, slug));
}
