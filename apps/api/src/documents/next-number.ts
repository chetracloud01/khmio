import type { Tx } from "@khmio/db";
import type { DocumentSeries } from "@khmio/shared";

/**
 * The shop's next number in one series (BILL, RET, PAY): the counter row is
 * created or moved on in one statement, which holds the row until the
 * transaction ends — two documents saved at once never share a number, and a
 * transaction that rolls back gives its number back.
 */
export async function nextDocumentNumber(tx: Tx, storeId: string, series: DocumentSeries): Promise<number> {
  const [row] = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO document_counters (store_id, series, last_number) VALUES (${storeId}::uuid, ${series}::"DocumentSeries", 1)
    ON CONFLICT (store_id, series) DO UPDATE SET last_number = document_counters.last_number + 1
    RETURNING last_number AS "lastNumber"`;
  if (!row) throw new Error("document counter not moved on");
  return row.lastNumber;
}
