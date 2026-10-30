import type { Tx } from "@khmio/db";
import { billPaymentState, type Currency, type PurchasePaymentState } from "@khmio/shared";

// What each supplier bill still owes (docs/blueprint.md "Cost price",
// suppliers and bills): its total less its returns less its payments (voided
// ones don't count), and where it stands — one query for the shop, used by
// the list's payment filter, the bill, the suppliers, "Owed to suppliers"
// and the payables report.

export interface BillBalance {
  id: string;
  supplierId: string | null;
  currency: Currency;
  /** YYYY-MM-DD, as on the bill. */
  purchasedOn: string;
  /** The goods arrived (stock went up). */
  received: boolean;
  total: number;
  returned: number;
  paid: number;
  dueOn: string | null;
  owed: number;
  state: PurchasePaymentState;
}

/** Every bill of the shop (or one, with `billId`) with what it owes, worked out by the database from its returns and payments. */
export async function readBillBalances(tx: Tx, storeId: string, today: string, billId?: string): Promise<BillBalance[]> {
  const rows = await tx.$queryRaw<Omit<BillBalance, "owed" | "state">[]>`
    SELECT bill.id, bill.supplier_id AS "supplierId", bill.currency::text AS currency,
           to_char(bill.purchased_on, 'YYYY-MM-DD') AS "purchasedOn", bill.received_at IS NOT NULL AS received, bill.total_minor AS total,
           COALESCE(sent.total, 0)::int AS returned, COALESCE(paid.total, 0)::int AS paid, to_char(bill.due_on, 'YYYY-MM-DD') AS "dueOn"
      FROM purchases bill
      LEFT JOIN (SELECT returns_id, SUM(total_minor) AS total FROM purchases WHERE store_id = ${storeId}::uuid AND kind = 'return' GROUP BY returns_id) sent ON sent.returns_id = bill.id
      LEFT JOIN (SELECT purchase_id, SUM(amount_minor) AS total FROM purchase_payments WHERE store_id = ${storeId}::uuid AND voided_at IS NULL GROUP BY purchase_id) paid ON paid.purchase_id = bill.id
     WHERE bill.store_id = ${storeId}::uuid AND bill.kind = 'purchase' AND (${billId ?? null}::uuid IS NULL OR bill.id = ${billId ?? null}::uuid)`;
  return rows.map((row) => ({ ...row, ...billPaymentState(row, today) }));
}

/** What the shop owes, dollars and riel apart: bills with something still to pay (a supplier owing the shop isn't netted off). */
export function owedTotals(balances: readonly BillBalance[]): Record<Currency, number> {
  const owed: Record<Currency, number> = { USD: 0, KHR: 0 };
  for (const balance of balances) if (balance.owed > 0) owed[balance.currency] += balance.owed;
  return owed;
}
