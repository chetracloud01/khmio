import type { Tx } from "@khmio/db";
import { addDays, NOT_SALE_STATUSES, phnomPenhDay, reportRange, salesReport, SALES_REPORT_ORDER_LIMIT, startOfPhnomPenhDay, type Currency, type OrderChannel, type OrderFulfilment, type OrderPaymentMethod, type OrderStatus, type ReportQuery } from "@khmio/shared";

// The sales report (design/screens.md S17 "Sales"), inside the seller's
// withContext: the period's orders grouped by Phnom Penh day and hour,
// channel, payment, fulfilment, status, currency and booking — added up by
// packages/shared sales-report.ts, so the sums read every order however many
// there are — the products sold, and the newest orders for the table.

/** The period's sums (the dashboard reads these alone, for this period and the one before). */
export async function readSalesSums(tx: Tx, storeId: string, query: ReportQuery, now = new Date()) {
  const today = phnomPenhDay(now);
  const from = reportRange(query, today)?.from ?? null;
  const since = from ? startOfPhnomPenhDay(from) : null;
  // One after another: queries inside a transaction share its one connection.
  const groups = await tx.$queryRaw<{ day: string; hour: number; channel: OrderChannel; paymentMethod: OrderPaymentMethod; fulfilment: OrderFulfilment; status: OrderStatus; currency: Currency; booking: boolean; orders: bigint; total: bigint }[]>`
    SELECT to_char((created_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day,
           extract(hour FROM created_at AT TIME ZONE 'Asia/Phnom_Penh')::int AS hour,
           channel, payment_method AS "paymentMethod", fulfilment, status, currency, preferred_at IS NOT NULL AS booking,
           count(*) AS orders, coalesce(sum(total_minor), 0) AS total
      FROM orders
     WHERE store_id = ${storeId}::uuid AND (${since}::timestamptz IS NULL OR created_at >= ${since}::timestamptz)
     GROUP BY 1, 2, 3, 4, 5, 6, 7, 8`;
  // Products sold: orders that count as sales (not cancelled, not still waiting for an online payment).
  const items = await tx.$queryRaw<{ day: string; productId: string; nameKm: string; nameEn: string; currency: Currency; quantity: bigint; total: bigint }[]>`
    SELECT to_char((o.created_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day, v.product_id::text AS "productId",
           max(i.title_km) AS "nameKm", max(i.title_en) AS "nameEn", o.currency, sum(i.quantity) AS quantity, coalesce(sum(i.line_total_minor), 0) AS total
      FROM order_items i
      JOIN orders o ON o.id = i.order_id AND o.store_id = ${storeId}::uuid
      JOIN product_variants v ON v.id = i.variant_id
     WHERE i.store_id = ${storeId}::uuid AND o.status::text NOT IN (${NOT_SALE_STATUSES[0]}, ${NOT_SALE_STATUSES[1]})
       AND (${since}::timestamptz IS NULL OR o.created_at >= ${since}::timestamptz)
     GROUP BY 1, 2, 5`;
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { defaultCurrency: true } });
  return salesReport(
    groups.map((row) => ({ ...row, orders: Number(row.orders), total: Number(row.total) })),
    items.map((row) => ({ ...row, quantity: Number(row.quantity), total: Number(row.total) })),
    query,
    today,
    store.defaultCurrency,
  );
}

/** The report: the sums, and the period's newest orders for the table. */
export async function readSalesReport(tx: Tx, storeId: string, query: ReportQuery, now = new Date()) {
  const report = await readSalesSums(tx, storeId, query, now);
  const days = reportRange(query, phnomPenhDay(now));
  const orders = await tx.order.findMany({
    where: { storeId, ...(days ? { createdAt: { gte: startOfPhnomPenhDay(days.from), lt: startOfPhnomPenhDay(addDays(days.to, 1)) } } : {}) },
    select: { id: true, orderNumber: true, createdAt: true, channel: true, fulfilment: true, paymentMethod: true, status: true, currency: true, totalMinor: true, buyerName: true, preferredAt: true },
    orderBy: { createdAt: "desc" },
    take: SALES_REPORT_ORDER_LIMIT,
  });
  return {
    ...report,
    orders: orders.map(({ createdAt, preferredAt, ...order }) => ({ ...order, createdAt: createdAt.toISOString(), booking: preferredAt !== null })),
    ordersLimited: orders.length === SALES_REPORT_ORDER_LIMIT,
  };
}
