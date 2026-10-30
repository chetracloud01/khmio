import type { Tx } from "@khmio/db";
import { NOT_SALE_STATUSES, phnomPenhDay, profitLossReport, reportRange, startOfPhnomPenhDay, type Currency, type ReportQuery } from "@khmio/shared";

// The profit and loss report (design/screens.md S17 "Profit & loss"; Pro),
// inside the seller's withContext: the period's sales per Phnom Penh day and
// currency (orders that count as sales), each product's lines with their
// frozen cost, and the stock taken off or found — worth the cost a count
// fixed, or else the item's cost today — added up by packages/shared
// profit-loss.ts.

export async function readProfitLoss(tx: Tx, storeId: string, query: ReportQuery, now = new Date()) {
  const today = phnomPenhDay(now);
  const from = reportRange(query, today)?.from ?? null;
  const since = from ? startOfPhnomPenhDay(from) : null;
  // One after another: queries inside a transaction share its one connection.
  const orderDays = await tx.$queryRaw<{ day: string; currency: Currency; orders: bigint; subtotal: bigint; discount: bigint; deliveryFee: bigint; vat: bigint }[]>`
    SELECT to_char((created_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day, currency, count(*) AS orders,
           coalesce(sum(subtotal_minor), 0) AS subtotal, coalesce(sum(discount_minor), 0) AS discount,
           coalesce(sum(delivery_fee_minor), 0) AS "deliveryFee", coalesce(sum(vat_minor), 0) AS vat
      FROM orders
     WHERE store_id = ${storeId}::uuid AND status::text NOT IN (${NOT_SALE_STATUSES[0]}, ${NOT_SALE_STATUSES[1]})
       AND (${since}::timestamptz IS NULL OR created_at >= ${since}::timestamptz)
     GROUP BY 1, 2`;
  // A line's cost is unit_cost_minor × quantity, in the order's currency (frozen at sale); no cost = not in costedSales.
  const items = await tx.$queryRaw<{ day: string; productId: string; nameKm: string; nameEn: string; currency: Currency; quantity: bigint; sales: bigint; costedSales: bigint; cost: bigint }[]>`
    SELECT to_char((o.created_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day, v.product_id::text AS "productId",
           max(i.title_km) AS "nameKm", max(i.title_en) AS "nameEn", o.currency, sum(i.quantity) AS quantity,
           coalesce(sum(i.line_total_minor), 0) AS sales,
           coalesce(sum(i.line_total_minor) FILTER (WHERE i.unit_cost_minor IS NOT NULL), 0) AS "costedSales",
           coalesce(sum(i.unit_cost_minor * i.quantity), 0) AS cost
      FROM order_items i
      JOIN orders o ON o.id = i.order_id AND o.store_id = ${storeId}::uuid
      JOIN product_variants v ON v.id = i.variant_id
     WHERE i.store_id = ${storeId}::uuid AND o.status::text NOT IN (${NOT_SALE_STATUSES[0]}, ${NOT_SALE_STATUSES[1]})
       AND (${since}::timestamptz IS NULL OR o.created_at >= ${since}::timestamptz)
     GROUP BY 1, 2, 5`;
  // Stock taken off or put back by hand or by a count; a count's lines carry the cost fixed when it was applied.
  const moves = await tx.$queryRaw<{ day: string; direction: "in" | "out"; reason: string; units: bigint; currency: Currency | null; value: bigint; unvalued: bigint; fixed: boolean }[]>`
    SELECT to_char((m.created_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day,
           CASE WHEN m.type = 'adjust_in' THEN 'in' ELSE 'out' END AS direction, m.reason::text AS reason,
           sum(m.quantity) AS units,
           CASE WHEN line.cost_minor IS NOT NULL THEN line.cost_currency ELSE v.cost_currency END AS currency,
           coalesce(sum(m.quantity * coalesce(line.cost_minor, v.cost_minor)), 0) AS value,
           coalesce(sum(m.quantity) FILTER (WHERE coalesce(line.cost_minor, v.cost_minor) IS NULL), 0) AS unvalued,
           line.cost_minor IS NOT NULL AS fixed
      FROM stock_movements m
      JOIN product_variants v ON v.id = m.variant_id
      LEFT JOIN stock_count_lines line ON line.count_id = m.stock_count_id AND line.variant_id = m.variant_id
     WHERE m.store_id = ${storeId}::uuid AND m.type IN ('adjust_in', 'adjust_out') AND m.reason IS NOT NULL
       AND (${since}::timestamptz IS NULL OR m.created_at >= ${since}::timestamptz)
     GROUP BY 1, 2, 3, 5, 8`;
  return profitLossReport(
    orderDays.map((row) => ({ ...row, orders: Number(row.orders), subtotal: Number(row.subtotal), discount: Number(row.discount), deliveryFee: Number(row.deliveryFee), vat: Number(row.vat) })),
    items.map((row) => ({ ...row, quantity: Number(row.quantity), sales: Number(row.sales), costedSales: Number(row.costedSales), cost: Number(row.cost) })),
    moves.map((row) => ({ ...row, units: Number(row.units), value: Number(row.value), unvalued: Number(row.unvalued) })),
    query,
    today,
  );
}
