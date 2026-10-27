import type { Tx } from "@khmio/db";
import { DAY_MS, isCashOrder, needsSellerAction, phnomPenhDay, type Currency, type OrderStatus, type PaymentMethod } from "@khmio/shared";

// The seller's home page numbers (design/screens.md S3), worked out by the
// database so they stay right however many orders a shop has. Days are
// Phnom Penh days (UTC+7, no daylight saving). Dollars and riel are always
// kept apart — a riel order is never converted (docs/blueprint.md
// "Multi-currency pricing and totals").

/** 60 days: the longest period on the sales card (30 days) and the 30 before it, to compare. */
export const SUMMARY_DAYS = 60;
export const TOP_PRODUCTS = 5;
/** The sales card's periods, in days back from today (Phnom Penh). */
export const SALES_PERIODS = { today: 1, week: 7, month: 30 } as const;
export type SalesPeriod = keyof typeof SALES_PERIODS;
/** Orders that count as sales: not cancelled, and not still waiting for an online payment. */
const NOT_SALES = ["cancelled", "awaiting_payment"];

export type Money = Record<Currency, number>;

export interface SellerSummary {
  /** Orders the seller still has a step to do on (needsSellerAction). */
  waiting: number;
  salesToday: Money;
  /** Cash orders not yet completed: money with the buyer or a driver. */
  cashToCollect: Money;
  ordersLast7Days: number;
  ordersPrevious7Days: number;
  /** Oldest first, SUMMARY_DAYS days ending today, days without sales included; orders also counted per currency (an order has one). */
  days: { date: string; orders: number; ordersUSD: number; ordersKHR: number; USD: number; KHR: number }[];
  /** Per period, the products that earned the most in the shop's main currency (then the other): line totals, both currencies kept apart. */
  topProducts: Record<SalesPeriod, TopProduct[]>;
}

export interface TopProduct {
  nameKm: string;
  nameEn: string;
  quantity: number;
  USD: number;
  KHR: number;
}

export interface OpenRow {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  currency: Currency;
  orders: number;
  total: number;
}
export interface DayRow {
  day: string;
  currency: Currency;
  orders: number;
  total: number;
}
/** One product's sales on one day in one currency. */
export interface ItemRow {
  day: string;
  nameKm: string;
  nameEn: string;
  currency: Currency;
  quantity: number;
  total: number;
}

/** "2026-10-08": the Phnom Penh date `daysAgo` days before `now`. */
export function phnomPenhDate(now: Date, daysAgo = 0): string {
  return phnomPenhDay(new Date(now.getTime() - daysAgo * DAY_MS));
}

const emptyMoney = (): Money => ({ USD: 0, KHR: 0 });

/** The answer from the three grouped queries; pure, so it's tested without a database. */
export function buildSummary(open: OpenRow[], daily: DayRow[], items: ItemRow[], now: Date, mainCurrency: Currency = "USD"): SellerSummary {
  const waiting = open.filter((row) => needsSellerAction(row.status)).reduce((sum, row) => sum + row.orders, 0);
  const cashToCollect = emptyMoney();
  for (const row of open) if (isCashOrder(row)) cashToCollect[row.currency] += row.total;

  const days = Array.from({ length: SUMMARY_DAYS }, (_, index) => ({ date: phnomPenhDate(now, SUMMARY_DAYS - 1 - index), orders: 0, ordersUSD: 0, ordersKHR: 0, USD: 0, KHR: 0 }));
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const row of daily) {
    const day = byDate.get(row.day);
    if (!day) continue;
    day.orders += row.orders;
    day[row.currency === "USD" ? "ordersUSD" : "ordersKHR"] += row.orders;
    day[row.currency] += row.total;
  }
  const today = days[days.length - 1]!;
  const countDays = (from: number, to: number) => days.slice(days.length - to, days.length - from).reduce((sum, day) => sum + day.orders, 0);

  return {
    waiting,
    salesToday: { USD: today.USD, KHR: today.KHR },
    cashToCollect,
    ordersLast7Days: countDays(0, 7),
    ordersPrevious7Days: countDays(7, 14),
    days,
    topProducts: {
      today: topProductsSince(items, phnomPenhDate(now, SALES_PERIODS.today - 1), mainCurrency),
      week: topProductsSince(items, phnomPenhDate(now, SALES_PERIODS.week - 1), mainCurrency),
      month: topProductsSince(items, phnomPenhDate(now, SALES_PERIODS.month - 1), mainCurrency),
    },
  };
}

/** The products sold from `since` (a Phnom Penh date) on, most earned first in the main currency, then the other. */
function topProductsSince(items: ItemRow[], since: string, mainCurrency: Currency): TopProduct[] {
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";
  const byName = new Map<string, TopProduct>();
  for (const row of items) {
    if (row.day < since) continue;
    const key = JSON.stringify([row.nameKm, row.nameEn]);
    const entry = byName.get(key) ?? { nameKm: row.nameKm, nameEn: row.nameEn, quantity: 0, USD: 0, KHR: 0 };
    entry.quantity += row.quantity;
    entry[row.currency] += row.total;
    byName.set(key, entry);
  }
  return [...byName.values()]
    .sort((a, b) => b[mainCurrency] - a[mainCurrency] || b[other] - a[other] || b.quantity - a.quantity)
    .slice(0, TOP_PRODUCTS);
}

/** Runs the three queries for this shop (inside withContext: row-level security applies, and every query also filters by store). */
export async function sellerSummary(tx: Tx, storeId: string, now = new Date()): Promise<SellerSummary> {
  const since = phnomPenhDate(now, SUMMARY_DAYS - 1);
  // One after another: queries inside a transaction share its one connection.
  const open = await tx.$queryRaw<{ status: OrderStatus; paymentMethod: PaymentMethod; currency: Currency; orders: bigint; total: bigint }[]>`
      SELECT status, payment_method AS "paymentMethod", currency, count(*) AS orders, coalesce(sum(total_minor), 0) AS total
      FROM orders
      WHERE store_id = ${storeId}::uuid AND status::text NOT IN ('completed', 'cancelled')
      GROUP BY 1, 2, 3`;
  const daily = await tx.$queryRaw<{ day: string; currency: Currency; orders: bigint; total: bigint }[]>`
      SELECT to_char((created_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day, currency, count(*) AS orders, coalesce(sum(total_minor), 0) AS total
      FROM orders
      WHERE store_id = ${storeId}::uuid
        AND status::text NOT IN (${NOT_SALES[0]}, ${NOT_SALES[1]})
        AND created_at >= (${since}::date::timestamp AT TIME ZONE 'Asia/Phnom_Penh')
      GROUP BY 1, 2`;
  const monthStart = phnomPenhDate(now, SALES_PERIODS.month - 1);
  const items = await tx.$queryRaw<{ day: string; nameKm: string; nameEn: string; currency: Currency; quantity: bigint; total: bigint }[]>`
      SELECT to_char((orders.created_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day,
             item.title_km AS "nameKm", item.title_en AS "nameEn", orders.currency,
             sum(item.quantity) AS quantity, coalesce(sum(item.line_total_minor), 0) AS total
      FROM order_items item
      JOIN orders ON orders.id = item.order_id AND orders.store_id = ${storeId}::uuid
      WHERE item.store_id = ${storeId}::uuid
        AND orders.status::text NOT IN (${NOT_SALES[0]}, ${NOT_SALES[1]})
        AND orders.created_at >= (${monthStart}::date::timestamp AT TIME ZONE 'Asia/Phnom_Penh')
      GROUP BY 1, 2, 3, 4`;
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { defaultCurrency: true } });
  return buildSummary(
    open.map((row) => ({ ...row, orders: Number(row.orders), total: Number(row.total) })),
    daily.map((row) => ({ ...row, orders: Number(row.orders), total: Number(row.total) })),
    items.map((row) => ({ ...row, quantity: Number(row.quantity), total: Number(row.total) })),
    now,
    store.defaultCurrency,
  );
}
