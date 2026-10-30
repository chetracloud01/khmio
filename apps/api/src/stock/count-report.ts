import type { Tx } from "@khmio/db";
import { countReport, phnomPenhDay, reportRange, startOfPhnomPenhDay, type CountReportCount, type PlanId, type ReportQuery } from "@khmio/shared";
import { readStockPage } from "./stock";

// The stock counts report (design/screens.md S17 "Stock counts"), inside the
// seller's withContext: the counts applied from the period's first day on,
// with their lines at the costs fixed when applied, and the Stock list's items
// for each one's category and names — added up by packages/shared
// count-report.ts. Drafts and cancelled counts moved nothing, so they're left out.

export async function readCountReport(tx: Tx, storeId: string, plan: PlanId, query: ReportQuery, now = new Date()) {
  const today = phnomPenhDay(now);
  const from = reportRange(query, today)?.from ?? null;
  // One after another: queries inside a transaction share its one connection.
  const page = await readStockPage(tx, storeId, plan);
  const applied = await tx.stockCount.findMany({
    where: { storeId, status: "applied", ...(from ? { appliedAt: { gte: startOfPhnomPenhDay(from) } } : {}) },
    select: { id: true, number: true, appliedAt: true, categoryIds: true, lines: { select: { variantId: true, counted: true, expectedOnHand: true, costMinor: true, costCurrency: true } } },
  });
  const counts: CountReportCount[] = applied.flatMap(({ appliedAt, ...count }) => (appliedAt ? [{ ...count, appliedAt: appliedAt.toISOString(), appliedOn: phnomPenhDay(appliedAt) }] : []));
  const named = new Map(page.items.map((item) => [item.variantId, item]));
  const report = countReport(counts, new Map(page.items.map((item) => [item.variantId, item.categoryId ?? ""])), query, today);
  return {
    ...report,
    items: report.items.map((entry) => {
      const item = named.get(entry.variantId);
      return { ...entry, titleKm: item?.titleKm ?? "", titleEn: item?.titleEn ?? "", optionKm: item?.optionKm ?? "", optionEn: item?.optionEn ?? "", sku: item?.sku ?? "", categoryId: item?.categoryId ?? "", onHand: item?.onHand ?? null, low: item?.low ?? false };
    }),
  };
}
