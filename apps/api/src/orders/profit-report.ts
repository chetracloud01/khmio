import type { Tx } from "@khmio/db";
import { SALES_PERIODS, profitSince, type Currency, type ProfitPeriod, type ProfitRow, type SalesPeriod } from "@khmio/shared";
import { NOT_SALES, phnomPenhDate } from "./summary";

// The profit report (Reports, design/screens.md S17; Pro plan): the database
// adds up each product's sales and frozen costs per Phnom Penh day and
// currency over the longest period; profitSince (packages/shared profit.ts)
// works out each period from those rows.

export type ProfitReport = Record<SalesPeriod, ProfitPeriod> & { mainCurrency: Currency };

/** The rows for the last 30 days; pure periods from them, so the sums are tested without a database. */
export function buildProfitReport(rows: readonly ProfitRow[], now: Date, mainCurrency: Currency): ProfitReport {
  const since = (period: SalesPeriod) => phnomPenhDate(now, SALES_PERIODS[period] - 1);
  return {
    mainCurrency,
    today: profitSince(rows, since("today"), mainCurrency),
    week: profitSince(rows, since("week"), mainCurrency),
    month: profitSince(rows, since("month"), mainCurrency),
  };
}

/** Runs the query for this shop (inside withContext: row-level security applies, and the query also filters by store). */
export async function readProfitReport(tx: Tx, storeId: string, now = new Date()): Promise<ProfitReport> {
  const monthStart = phnomPenhDate(now, SALES_PERIODS.month - 1);
  // A line's cost is unit_cost_minor × quantity, in the order's currency (frozen at sale); no cost = not in costedSales.
  const rows = await tx.$queryRaw<{ day: string; nameKm: string; nameEn: string; currency: Currency; quantity: bigint; sales: bigint; costedSales: bigint; cost: bigint }[]>`
      SELECT to_char((orders.created_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day,
             item.title_km AS "nameKm", item.title_en AS "nameEn", orders.currency,
             sum(item.quantity) AS quantity,
             coalesce(sum(item.line_total_minor), 0) AS sales,
             coalesce(sum(item.line_total_minor) FILTER (WHERE item.unit_cost_minor IS NOT NULL), 0) AS "costedSales",
             coalesce(sum(item.unit_cost_minor * item.quantity), 0) AS cost
      FROM order_items item
      JOIN orders ON orders.id = item.order_id AND orders.store_id = ${storeId}::uuid
      WHERE item.store_id = ${storeId}::uuid
        AND orders.status::text NOT IN (${NOT_SALES[0]}, ${NOT_SALES[1]})
        AND orders.created_at >= (${monthStart}::date::timestamp AT TIME ZONE 'Asia/Phnom_Penh')
      GROUP BY 1, 2, 3, 4`;
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { defaultCurrency: true } });
  return buildProfitReport(
    rows.map((row) => ({ ...row, quantity: Number(row.quantity), sales: Number(row.sales), costedSales: Number(row.costedSales), cost: Number(row.cost) })),
    now,
    store.defaultCurrency,
  );
}
