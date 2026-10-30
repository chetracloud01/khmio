import type { Tx } from "@khmio/db";
import { orderStatusFigures, phnomPenhDay, startOfPhnomPenhDay, type Currency, type OrderPaymentMethod, type OrderStatus } from "@khmio/shared";

// The Orders page's status tiles (design/screens.md S4), inside the seller's
// withContext: every order of the shop grouped by status, payment, currency
// and whether it was placed today — added up by packages/shared
// order-status.ts.

export async function readOrderStatus(tx: Tx, storeId: string, now = new Date()) {
  const todayStart = startOfPhnomPenhDay(phnomPenhDay(now));
  const groups = await tx.$queryRaw<{ status: OrderStatus; paymentMethod: OrderPaymentMethod; currency: Currency; today: boolean; orders: bigint; total: bigint }[]>`
    SELECT status, payment_method AS "paymentMethod", currency, created_at >= ${todayStart}::timestamptz AS today,
           count(*) AS orders, coalesce(sum(total_minor), 0) AS total
      FROM orders
     WHERE store_id = ${storeId}::uuid
     GROUP BY 1, 2, 3, 4`;
  return orderStatusFigures(groups.map((row) => ({ ...row, orders: Number(row.orders), total: Number(row.total) })));
}
