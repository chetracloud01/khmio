import type { Tx } from "@khmio/db";
import { moveKindOf, phnomPenhDay, reportRange, stockReport, type PlanId, type ReportQuery, type StockReportMove } from "@khmio/shared";
import { readStockPage } from "./stock";

// The stock report (design/screens.md S17 "Stock"), inside the seller's
// withContext: the Stock list's items, every movement from the period's first
// day on (added up per item, Phnom Penh day, type and reason), and each item's
// last sale — added up by packages/shared stock-report.ts. Each row carries
// the item's names and level so the page shows it as the list does.

export async function readStockReport(tx: Tx, storeId: string, plan: PlanId, query: ReportQuery, now = new Date()) {
  const today = phnomPenhDay(now);
  const from = reportRange(query, today)?.from ?? null;
  // One after another: queries inside a transaction share its one connection.
  const page = await readStockPage(tx, storeId, plan);
  const grouped = await tx.$queryRaw<{ variantId: string; day: string; type: string; reason: string | null; quantity: bigint }[]>`
    SELECT variant_id AS "variantId", to_char((created_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day,
           type::text AS type, reason::text AS reason, sum(quantity) AS quantity
      FROM stock_movements
     WHERE store_id = ${storeId}::uuid
       AND (${from}::date IS NULL OR created_at >= (${from}::date::timestamp AT TIME ZONE 'Asia/Phnom_Penh'))
     GROUP BY 1, 2, 3, 4`;
  const sold = await tx.$queryRaw<{ variantId: string; day: string }[]>`
    SELECT variant_id AS "variantId", to_char(max(created_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day
      FROM stock_movements WHERE store_id = ${storeId}::uuid AND type = 'sale' GROUP BY 1`;
  const moves: StockReportMove[] = grouped.flatMap((row) => {
    const kind = moveKindOf(row.type, row.reason);
    return kind ? [{ variantId: row.variantId, day: row.day, ...kind, quantity: Number(row.quantity) }] : [];
  });
  const report = stockReport(page.items, moves, new Map(sold.map((row) => [row.variantId, row.day])), query, today);
  const named = new Map(page.items.map((item) => [item.variantId, item]));
  const nameOf = (variantId: string) => {
    const item = named.get(variantId);
    return { titleKm: item?.titleKm ?? "", titleEn: item?.titleEn ?? "", optionKm: item?.optionKm ?? "", optionEn: item?.optionEn ?? "", sku: item?.sku ?? "", categoryId: item?.categoryId ?? "", onHand: item?.onHand ?? null, low: item?.low ?? false };
  };
  return {
    ...report,
    rows: report.rows.map((row) => ({ ...row, ...nameOf(row.variantId) })),
    slowMovers: report.slowMovers.map((slow) => ({ ...slow, ...nameOf(slow.variantId) })),
  };
}
