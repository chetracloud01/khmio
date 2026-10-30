import type { Tx } from "@khmio/db";
import { isCashOrder, needsSellerAction, type Currency, type OrderStatus, type PaymentMethod } from "@khmio/shared";

// What the seller has to do now (design/screens.md S3, the dashboard's
// "Needs you now" and the Orders badge): orders waiting for a step, and cash
// still with buyers or drivers. Refreshed every minute by the dashboard
// layout, so it stays two numbers the database adds up. The period's sales
// and profit are the dashboard's (GET /dashboard). Dollars and riel are kept
// apart (docs/blueprint.md "Multi-currency pricing and totals").

export type Money = Record<Currency, number>;

export interface SellerSummary {
  /** Orders the seller still has a step to do on (needsSellerAction). */
  waiting: number;
  /** Cash orders not yet completed: money with the buyer or a driver. */
  cashToCollect: Money;
}

export interface OpenRow {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  currency: Currency;
  orders: number;
  total: number;
}

/** The answer from the grouped query; pure, so it's tested without a database. */
export function buildSummary(open: readonly OpenRow[]): SellerSummary {
  const waiting = open.filter((row) => needsSellerAction(row.status)).reduce((sum, row) => sum + row.orders, 0);
  const cashToCollect: Money = { USD: 0, KHR: 0 };
  for (const row of open) if (isCashOrder(row)) cashToCollect[row.currency] += row.total;
  return { waiting, cashToCollect };
}

/** Runs the query for this shop (inside withContext: row-level security applies, and the query also filters by store). */
export async function sellerSummary(tx: Tx, storeId: string): Promise<SellerSummary> {
  const open = await tx.$queryRaw<{ status: OrderStatus; paymentMethod: PaymentMethod; currency: Currency; orders: bigint; total: bigint }[]>`
      SELECT status, payment_method AS "paymentMethod", currency, count(*) AS orders, coalesce(sum(total_minor), 0) AS total
      FROM orders
      WHERE store_id = ${storeId}::uuid AND status::text NOT IN ('completed', 'cancelled')
      GROUP BY 1, 2, 3`;
  return buildSummary(open.map((row) => ({ ...row, orders: Number(row.orders), total: Number(row.total) })));
}
