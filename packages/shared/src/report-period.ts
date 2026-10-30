import { z } from "zod";
import { pastDaySchema, purchasePeriodDays } from "./purchases";
import { addDays, daysBetween } from "./time";

// The reports' period (design/screens.md S17): today, the last 7 or 30 days
// (the lists' own periods, so a report's numbers link there), everything, or
// from one day to another — and how a report's chart is cut: day by day for a
// short range, month by month for a long one. Days are Phnom Penh
// "YYYY-MM-DD"; shared by every report (bills & payables, stock, …).

export const REPORT_PERIODS = ["today", "week", "month", "all", "custom"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/** A report's period from its address: a custom one needs both days, in order, neither ahead of today. */
export const reportQuerySchema = z
  .object({ period: z.enum(REPORT_PERIODS).default("all"), from: pastDaySchema.optional(), to: pastDaySchema.optional() })
  .superRefine((query, ctx) => {
    if (query.period !== "custom") return;
    if (!query.from) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["from"], message: "required" });
    if (!query.to) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "required" });
    if (query.from && query.to && query.from > query.to) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "ends_before_start" });
  });
export type ReportQuery = z.infer<typeof reportQuerySchema>;

/** The days a query reads; null: everything. */
export function reportRange(query: ReportQuery, today: string): { from: string; to: string } | null {
  if (query.period === "all") return null;
  if (query.period === "custom") return query.from && query.to ? { from: query.from, to: query.to } : null;
  return purchasePeriodDays(query.period, today);
}

/** Longest range drawn day by day; longer ones (and everything) are drawn month by month. */
export const REPORT_SERIES_MAX_DAYS = 62;

export type SeriesUnit = "day" | "month";

/** How a range is drawn, and its bars' keys: every day ("2026-10-08"), or every month ("2026-10"). */
export function reportSeries(from: string, to: string): { unit: SeriesUnit; keys: string[] } {
  const unit: SeriesUnit = daysBetween(from, to) < REPORT_SERIES_MAX_DAYS ? "day" : "month";
  const keys: string[] = [];
  if (unit === "day") {
    for (let day = from; day <= to; day = addDays(day, 1)) keys.push(day);
    return { unit, keys };
  }
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const last = to.slice(0, 7);
  for (let key = from.slice(0, 7); key <= last; key = `${year}-${String(month).padStart(2, "0")}`) {
    keys.push(key);
    month += 1;
    if (month > 12) [year, month] = [year + 1, 1];
  }
  return { unit, keys };
}

/** The bar a day falls in. */
export const seriesKeyOf = (day: string, unit: SeriesUnit): string => (unit === "day" ? day : day.slice(0, 7));
