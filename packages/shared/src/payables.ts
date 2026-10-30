import { convertKhrToUsdCents, convertUsdCentsToKhr, type Currency } from "./money";
import { type GoodsState, type PurchasePaymentState } from "./purchases";
import { reportRange, reportSeries, seriesKeyOf, type ReportPeriod, type ReportQuery, type SeriesUnit } from "./report-period";
import { addDays, daysBetween } from "./time";

// The payables report (design/screens.md S17 "Bills & payables"; the usual
// accounts-payable report): for the bills of a period — what was bought,
// paid and is still owed, each bill's payment standing against whether its
// goods arrived, how late what's owed is (ageing by due day), and the same by
// supplier, and what was bought and paid day by day (or month by month).
// Dollars and riel are kept apart; payablesInOne shows them in one currency,
// converted at the shop's rate, for reading only. Returns lower what a bill
// bought and owes; voided payments don't count (bill-balances.ts).

/** How late what's owed is, in the usual buckets: not due yet, then days past the due day. */
export const AGE_BUCKETS = ["not_due", "late_1_30", "late_31_60", "late_61_90", "late_over_90"] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];
/** The last day late of each bucket after "not due" (the final one has no end). */
const AGE_BUCKET_LAST_DAYS = [30, 60, 90] as const;

/** "Due soon": owed and due within this many days from today. */
export const DUE_SOON_DAYS = 7;

/**
 * A bill's ageing bucket by its due day. A bill with no due day is never
 * late — the same rule as its payment standing (billPaymentState).
 */
export function ageBucketOf(dueOn: string | null, today: string): AgeBucket {
  const late = dueOn ? daysBetween(dueOn, today) : 0;
  if (late <= 0) return "not_due";
  const index = AGE_BUCKET_LAST_DAYS.findIndex((last) => late <= last);
  return AGE_BUCKETS[index === -1 ? AGE_BUCKETS.length - 1 : index + 1] ?? "late_over_90";
}

/** Owed, not late, and due within DUE_SOON_DAYS of today: the "due soon" figure and the list's due filter. */
export function isDueSoon(bill: { owed: number; state: PurchasePaymentState; dueOn: string | null }, today: string): boolean {
  return bill.owed > 0 && bill.state !== "overdue" && bill.dueOn !== null && bill.dueOn <= addDays(today, DUE_SOON_DAYS);
}

/** One bill as the report reads it (from bill-balances.ts and the bill). */
export interface PayablesBill {
  supplierId: string | null;
  supplierName: string;
  currency: Currency;
  /** YYYY-MM-DD, as on the bill. */
  purchasedOn: string;
  dueOn: string | null;
  received: boolean;
  total: number;
  returned: number;
  paid: number;
  owed: number;
  state: PurchasePaymentState;
  /** Its payments (voided ones left out): when, and how much. */
  payments: { paidOn: string; amount: number }[];
}

/** A status table cell: how many bills, what they bought (less returns) and what they still owe. */
export interface PayablesCell {
  count: number;
  bought: number;
  owed: number;
}

export interface PayablesFigures {
  billCount: number;
  /** Bills less their returns. */
  bought: number;
  /** What went back to the supplier (the bills' returns). */
  returned: number;
  paid: number;
  /** Still to pay (a supplier owing the shop isn't netted off). */
  owed: number;
  overdue: number;
  /** Owed, not late, due within DUE_SOON_DAYS, and on how many bills. */
  dueSoon: number;
  dueSoonCount: number;
  notReceived: PayablesCell;
}

export interface PayablesSupplierRow extends PayablesFigures {
  /** One row per supplier and currency: "<supplier id or none>:<currency>". */
  key: string;
  supplierId: string | null;
  supplierName: string;
  currency: Currency;
}

export interface PayablesCurrencyReport {
  figures: PayablesFigures;
  /** Each payment standing against whether the goods arrived. */
  status: Record<PurchasePaymentState, Record<GoodsState, PayablesCell>>;
  /** What's owed, by how late. */
  ageing: Record<AgeBucket, number>;
}

/** One bar of "bought and paid": bills by their day, payments by theirs. */
export interface PayablesPoint {
  /** "2026-10-08", or the month "2026-10". */
  key: string;
  bought: Record<Currency, number>;
  paid: Record<Currency, number>;
}

export interface PayablesReport {
  period: ReportPeriod;
  /** The first and last bill day read; null with "all". */
  days: { from: string; to: string } | null;
  /** How the series is cut. */
  unit: SeriesUnit;
  series: PayablesPoint[];
  currencies: Record<Currency, PayablesCurrencyReport>;
  /** Most owed first, then by name. */
  suppliers: PayablesSupplierRow[];
}

const emptyCell = (): PayablesCell => ({ count: 0, bought: 0, owed: 0 });
const emptyFigures = (): PayablesFigures => ({ billCount: 0, bought: 0, returned: 0, paid: 0, owed: 0, overdue: 0, dueSoon: 0, dueSoonCount: 0, notReceived: emptyCell() });
const goodsCells = (): Record<GoodsState, PayablesCell> => ({ received: emptyCell(), not_received: emptyCell() });
const emptyCurrencyReport = (): PayablesCurrencyReport => ({
  figures: emptyFigures(),
  status: { unpaid: goodsCells(), part: goodsCells(), paid: goodsCells(), overdue: goodsCells() },
  ageing: { not_due: 0, late_1_30: 0, late_31_60: 0, late_61_90: 0, late_over_90: 0 },
});
const addToCell = (cell: PayablesCell, bought: number, owed: number) => {
  cell.count += 1;
  cell.bought += bought;
  cell.owed += owed;
};

/** Adds one bill to a set of figures. */
function addBill(figures: PayablesFigures, bill: PayablesBill, today: string): void {
  const bought = bill.total - bill.returned;
  const owed = Math.max(0, bill.owed);
  figures.billCount += 1;
  figures.bought += bought;
  figures.returned += bill.returned;
  figures.paid += bill.paid;
  figures.owed += owed;
  if (bill.state === "overdue") figures.overdue += owed;
  if (isDueSoon(bill, today)) {
    figures.dueSoon += owed;
    figures.dueSoonCount += 1;
  }
  if (!bill.received) addToCell(figures.notReceived, bought, owed);
}

/** What was bought (by the bill's day) and paid (by the payment's day) in each day or month of the range. */
function payablesSeries(bills: readonly PayablesBill[], from: string, to: string): { unit: SeriesUnit; series: PayablesPoint[] } {
  const { unit, keys } = reportSeries(from, to);
  const series = keys.map((key) => ({ key, bought: { USD: 0, KHR: 0 }, paid: { USD: 0, KHR: 0 } }));
  const byKey = new Map(series.map((point) => [point.key, point]));
  const keyOf = (day: string) => seriesKeyOf(day, unit);
  for (const bill of bills) {
    const point = byKey.get(keyOf(bill.purchasedOn));
    if (point) point.bought[bill.currency] += bill.total - bill.returned;
    for (const payment of bill.payments) {
      const paidIn = payment.paidOn >= from && payment.paidOn <= to ? byKey.get(keyOf(payment.paidOn)) : undefined;
      if (paidIn) paidIn.paid[bill.currency] += payment.amount;
    }
  }
  return { unit, series };
}

const sortSuppliers = (rows: PayablesSupplierRow[]) => rows.sort((a, b) => b.owed - a.owed || a.supplierName.localeCompare(b.supplierName));

/** The report for the bills a query reads (days are Phnom Penh "YYYY-MM-DD"). */
export function payablesReport(bills: readonly PayablesBill[], query: ReportQuery, today: string): PayablesReport {
  const days = reportRange(query, today);
  const read = days ? bills.filter((bill) => bill.purchasedOn >= days.from && bill.purchasedOn <= days.to) : bills;
  // Every bill: drawn from the oldest to today.
  const first = read.reduce((oldest, bill) => (bill.purchasedOn < oldest ? bill.purchasedOn : oldest), today);
  const { unit, series } = payablesSeries(read, days?.from ?? first, days?.to ?? today);
  const currencies: Record<Currency, PayablesCurrencyReport> = { USD: emptyCurrencyReport(), KHR: emptyCurrencyReport() };
  const suppliers = new Map<string, PayablesSupplierRow>();
  for (const bill of read) {
    const report = currencies[bill.currency];
    const owed = Math.max(0, bill.owed);
    addBill(report.figures, bill, today);
    addToCell(report.status[bill.state][bill.received ? "received" : "not_received"], bill.total - bill.returned, owed);
    if (owed > 0) report.ageing[ageBucketOf(bill.dueOn, today)] += owed;
    const key = `${bill.supplierId ?? "none"}:${bill.currency}`;
    const row = suppliers.get(key) ?? { key, supplierId: bill.supplierId, supplierName: bill.supplierName, currency: bill.currency, ...emptyFigures() };
    addBill(row, bill, today);
    suppliers.set(key, row);
  }
  return { period: query.period, days, unit, series, currencies, suppliers: sortSuppliers([...suppliers.values()]) };
}

// ── In one currency (for reading only) ──────────────────────────────────────

/** The report in one currency: the other's amounts converted at the shop's rate (riel per $1), each rounded like a price. */
export interface PayablesInOne {
  currency: Currency;
  rate: number;
  report: PayablesCurrencyReport;
  series: { key: string; bought: number; paid: number }[];
  /** One row per supplier, both currencies together. */
  suppliers: PayablesSupplierRow[];
}

/** An amount in `to` at the rate (riel per $1); already in `to`, as it is. */
export function amountIn(amount: number, from: Currency, to: Currency, rate: number): number {
  if (from === to) return amount;
  return to === "KHR" ? convertUsdCentsToKhr(amount, rate) : convertKhrToUsdCents(amount, rate);
}

function figuresIn(parts: readonly { figures: PayablesFigures; currency: Currency }[], to: Currency, rate: number): PayablesFigures {
  const total = emptyFigures();
  for (const { figures, currency } of parts) {
    const money = (amount: number) => amountIn(amount, currency, to, rate);
    total.billCount += figures.billCount;
    total.bought += money(figures.bought);
    total.returned += money(figures.returned);
    total.paid += money(figures.paid);
    total.owed += money(figures.owed);
    total.overdue += money(figures.overdue);
    total.dueSoon += money(figures.dueSoon);
    total.dueSoonCount += figures.dueSoonCount;
    total.notReceived.count += figures.notReceived.count;
    total.notReceived.bought += money(figures.notReceived.bought);
    total.notReceived.owed += money(figures.notReceived.owed);
  }
  return total;
}

export function payablesInOne(report: PayablesReport, to: Currency, rate: number): PayablesInOne {
  const both = ["USD", "KHR"] as const;
  const money = (amount: number, from: Currency) => amountIn(amount, from, to, rate);
  const cell = (state: PurchasePaymentState, goods: GoodsState): PayablesCell =>
    both.reduce((sum, currency) => {
      const part = report.currencies[currency].status[state][goods];
      return { count: sum.count + part.count, bought: sum.bought + money(part.bought, currency), owed: sum.owed + money(part.owed, currency) };
    }, emptyCell());
  const cells = (state: PurchasePaymentState) => ({ received: cell(state, "received"), not_received: cell(state, "not_received") });
  const ageing = (bucket: AgeBucket) => both.reduce((sum, currency) => sum + money(report.currencies[currency].ageing[bucket], currency), 0);
  const suppliers = new Map<string, PayablesSupplierRow>();
  for (const row of report.suppliers) {
    const key = row.supplierId ?? "none";
    const merged = suppliers.get(key);
    const figures = figuresIn([...(merged ? [{ figures: merged, currency: to }] : []), { figures: row, currency: row.currency }], to, rate);
    suppliers.set(key, { key, supplierId: row.supplierId, supplierName: row.supplierName, currency: to, ...figures });
  }
  return {
    currency: to,
    rate,
    report: {
      figures: figuresIn(
        both.map((currency) => ({ figures: report.currencies[currency].figures, currency })),
        to,
        rate,
      ),
      status: { unpaid: cells("unpaid"), part: cells("part"), paid: cells("paid"), overdue: cells("overdue") },
      ageing: { not_due: ageing("not_due"), late_1_30: ageing("late_1_30"), late_31_60: ageing("late_31_60"), late_61_90: ageing("late_61_90"), late_over_90: ageing("late_over_90") },
    },
    series: report.series.map((point) => ({ key: point.key, bought: money(point.bought.USD, "USD") + money(point.bought.KHR, "KHR"), paid: money(point.paid.USD, "USD") + money(point.paid.KHR, "KHR") })),
    suppliers: sortSuppliers([...suppliers.values()]),
  };
}
