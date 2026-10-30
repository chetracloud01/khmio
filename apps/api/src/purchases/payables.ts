import type { Tx } from "@khmio/db";
import { payablesReport, phnomPenhDay, type ReportQuery, type PayablesReport } from "@khmio/shared";
import { readBillBalances } from "./bill-balances";
import { dayOf } from "./purchase-days";

// The payables report (design/screens.md S17 "Bills & payables"), inside the
// seller's withContext: every bill's balance, with its supplier's name and
// its payments (voided ones left out), added up by packages/shared
// payables.ts.

export async function readPayablesReport(tx: Tx, storeId: string, query: ReportQuery, now = new Date()): Promise<PayablesReport> {
  const today = phnomPenhDay(now);
  // One after another: queries inside a transaction share its one connection.
  const balances = await readBillBalances(tx, storeId, today);
  const suppliers = await tx.supplier.findMany({ where: { storeId }, select: { id: true, name: true } });
  const payments = await tx.purchasePayment.findMany({ where: { storeId, voidedAt: null }, select: { purchaseId: true, paidOn: true, amountMinor: true } });
  const nameOf = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const paymentsOf = new Map<string, { paidOn: string; amount: number }[]>();
  for (const payment of payments) paymentsOf.set(payment.purchaseId, [...(paymentsOf.get(payment.purchaseId) ?? []), { paidOn: dayOf(payment.paidOn), amount: payment.amountMinor }]);
  const bills = balances.map((balance) => ({ ...balance, supplierName: balance.supplierId ? (nameOf.get(balance.supplierId) ?? "") : "", payments: paymentsOf.get(balance.id) ?? [] }));
  return payablesReport(bills, query, today);
}
