"use client";

import { phnomPenhDay, phnomPenhTime } from "@khmio/shared";
import { useTranslations } from "next-intl";

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

/**
 * Every date and time on screen: Phnom Penh time with our own month names
 * (messages "Dates"), never the browser's date data — some phones have no
 * Khmer dates, and the server's page and the phone's must agree
 * (packages/shared time.ts).
 */
export function useDateText() {
  const t = useTranslations("Dates");
  const month = (number: number) => t(`month_${number}`);

  /** "Just now", "4 min ago", "3 hr ago", "2 days ago", from a number of minutes. */
  function ago(minutes: number): string {
    if (minutes < 1) return t("justNow");
    if (minutes < MINUTES_PER_HOUR) return t("minutesAgo", { count: minutes });
    if (minutes < MINUTES_PER_DAY) return t("hoursAgo", { count: Math.round(minutes / MINUTES_PER_HOUR) });
    return t("daysAgo", { count: Math.round(minutes / MINUTES_PER_DAY) });
  }

  return {
    ago,
    /** How long ago a moment was: "Just now", "4 min ago"… */
    timeAgo: (iso: string) => ago(Math.max(0, Math.round((Date.now() - Date.parse(iso)) / MINUTE_MS))),
    /** "2 Oct 2026"; "—" when there's no date. */
    date: (iso: string | null) => {
      if (!iso) return "—";
      const at = phnomPenhTime(iso);
      return t("date", { day: at.day, month: month(at.month), year: at.year });
    },
    /** "2 Oct 2026, 14:05". */
    dateTime: (iso: string) => {
      const at = phnomPenhTime(iso);
      return t("dateTime", { day: at.day, month: month(at.month), year: at.year, time: at.clock });
    },
    /** "14:05" today, "29 Sep, 14:05" otherwise (a status history). */
    clockTime: (iso: string) => {
      const at = phnomPenhTime(iso);
      return at.dayKey === phnomPenhDay(new Date()) ? at.clock : t("dayTime", { day: at.day, month: month(at.month), time: at.clock });
    },
    /** "22 Oct", for a Phnom Penh day written "2026-10-22" (chart days, list groups). */
    day: (dayKey: string) => t("dayMonth", { day: Number(dayKey.slice(8, 10)), month: month(Number(dayKey.slice(5, 7))) }),
    /** "Oct 2026", for a month written "2026-10" (chart months). */
    monthYear: (monthKey: string) => t("monthYear", { month: month(Number(monthKey.slice(5, 7))), year: monthKey.slice(0, 4) }),
  };
}
