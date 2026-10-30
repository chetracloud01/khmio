import type { Currency } from "./money";
import { reportRange, type ReportPeriod, type ReportQuery } from "./report-period";
import { countDifference } from "./stock-count";

// The stock counts report (design/screens.md S17 "Stock counts"; the ERP
// shrinkage report): for the counts applied in a period, what went missing
// and what turned up (units, and their worth at the cost each count fixed),
// how accurate the shelf was (the share of counted items that matched what
// the app had), each count in turn, the loss by category, and the items most
// often short. Dollars and riel apart. Pure, so the sums are tested without
// a database.

type Money = Record<Currency, number>;
const zero = (): Money => ({ USD: 0, KHR: 0 });

/** One applied count as the report reads it. */
export interface CountReportCount {
  id: string;
  number: number;
  /** When it was applied (an ISO time). */
  appliedAt: string;
  /** Its Phnom Penh day ("YYYY-MM-DD"). */
  appliedOn: string;
  categoryIds: string[];
  lines: { variantId: string; counted: number; expectedOnHand: number | null; costMinor: number | null; costCurrency: Currency | null }[];
}

interface Sums {
  lost: Money;
  found: Money;
  net: Money;
  lostUnits: number;
  foundUnits: number;
  /** Items that differed but have no cost price, so aren't valued. */
  withoutCost: number;
  /** Items compared with what the app had (an untracked item starting from its count isn't). */
  compared: number;
  matched: number;
}

export interface CountReportRow extends Omit<Sums, "compared" | "matched"> {
  id: string;
  number: number;
  appliedAt: string;
  appliedOn: string;
  categoryIds: string[];
  items: number;
  /** Whole percent of compared items that matched; null when none were compared. */
  accuracy: number | null;
}

export interface CountReport {
  period: ReportPeriod;
  days: { from: string; to: string } | null;
  figures: Omit<CountReportRow, "id" | "number" | "appliedAt" | "appliedOn" | "categoryIds"> & { counts: number };
  /** Each count, oldest first. */
  counts: CountReportRow[];
  /** What went missing by category, most units first. */
  byCategory: { categoryId: string; lostUnits: number; lost: Money }[];
  /** The items short in the counts, most often and most units first. */
  items: { variantId: string; timesShort: number; unitsLost: number; lost: Money; timesOver: number; unitsFound: number }[];
}

const emptySums = (): Sums => ({ lost: zero(), found: zero(), net: zero(), lostUnits: 0, foundUnits: 0, withoutCost: 0, compared: 0, matched: 0 });
const accuracyOf = (sums: Sums) => (sums.compared > 0 ? Math.round((sums.matched / sums.compared) * 100) : null);

/** Adds one line to a set of sums. */
function addLine(sums: Sums, line: CountReportCount["lines"][number]): void {
  const difference = countDifference(line);
  if (difference === null) return;
  sums.compared += 1;
  if (difference === 0) {
    sums.matched += 1;
    return;
  }
  const worth = line.costMinor !== null && line.costCurrency ? { amount: difference * line.costMinor, currency: line.costCurrency } : null;
  if (difference < 0) sums.lostUnits -= difference;
  else sums.foundUnits += difference;
  if (!worth) {
    sums.withoutCost += 1;
    return;
  }
  sums[difference < 0 ? "lost" : "found"][worth.currency] += worth.amount;
  sums.net[worth.currency] += worth.amount;
}

const withoutTallies = ({ compared: _compared, matched: _matched, ...sums }: Sums) => sums;

/** The report for the counts applied in a period (`categoryOf`: each item's category). */
export function countReport(counts: readonly CountReportCount[], categoryOf: ReadonlyMap<string, string>, query: ReportQuery, today: string): CountReport {
  const days = reportRange(query, today);
  const read = (days ? counts.filter((count) => count.appliedOn >= days.from && count.appliedOn <= days.to) : counts).slice().sort((a, b) => a.appliedAt.localeCompare(b.appliedAt));
  const total = emptySums();
  let itemsCounted = 0;
  const categories = new Map<string, { categoryId: string; lostUnits: number; lost: Money }>();
  const items = new Map<string, CountReport["items"][number]>();
  const rows = read.map((count) => {
    const sums = emptySums();
    for (const line of count.lines) {
      addLine(sums, line);
      addLine(total, line);
      const difference = countDifference(line);
      if (!difference) continue;
      const item = items.get(line.variantId) ?? { variantId: line.variantId, timesShort: 0, unitsLost: 0, lost: zero(), timesOver: 0, unitsFound: 0 };
      if (difference < 0) {
        item.timesShort += 1;
        item.unitsLost -= difference;
        const categoryId = categoryOf.get(line.variantId) ?? "";
        const category = categories.get(categoryId) ?? { categoryId, lostUnits: 0, lost: zero() };
        category.lostUnits -= difference;
        if (line.costMinor !== null && line.costCurrency) {
          item.lost[line.costCurrency] += difference * line.costMinor;
          category.lost[line.costCurrency] += difference * line.costMinor;
        }
        categories.set(categoryId, category);
      } else {
        item.timesOver += 1;
        item.unitsFound += difference;
      }
      items.set(line.variantId, item);
    }
    itemsCounted += count.lines.length;
    return { id: count.id, number: count.number, appliedAt: count.appliedAt, appliedOn: count.appliedOn, categoryIds: count.categoryIds, items: count.lines.length, ...withoutTallies(sums), accuracy: accuracyOf(sums) };
  });
  return {
    period: query.period,
    days,
    figures: { counts: rows.length, items: itemsCounted, ...withoutTallies(total), accuracy: accuracyOf(total) },
    counts: rows,
    byCategory: [...categories.values()].sort((a, b) => b.lostUnits - a.lostUnits),
    items: [...items.values()].filter((item) => item.timesShort > 0).sort((a, b) => b.timesShort - a.timesShort || b.unitsLost - a.unitsLost),
  };
}
