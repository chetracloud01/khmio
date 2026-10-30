// Time for the whole platform. Every date Khmio shows or groups by is Phnom
// Penh time: Cambodia keeps UTC+7 all year (no daylight saving), so a fixed
// offset is exact. Worked out here rather than with the browser's date data:
// some phones have no Khmer dates, and the server's page and the phone's must agree.

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Hours in a day: a day's sales are drawn hour by hour. */
export const HOURS_IN_DAY = 24;

export const PHNOM_PENH_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface PhnomPenhTime {
  year: number;
  /** 1–12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** "2026-10-22": the Phnom Penh day, for grouping and comparing. */
  dayKey: string;
  /** "14:05". */
  clock: string;
}

/** The wall clock in Phnom Penh at a moment (a Date or an ISO time). */
export function phnomPenhTime(at: Date | string): PhnomPenhTime {
  const local = new Date(new Date(at).getTime() + PHNOM_PENH_OFFSET_MS);
  const hour = local.getUTCHours();
  const minute = local.getUTCMinutes();
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour,
    minute,
    dayKey: local.toISOString().slice(0, 10),
    clock: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

/** "2026-10-22": the Phnom Penh day of a moment. */
export const phnomPenhDay = (at: Date | string): string => phnomPenhTime(at).dayKey;

/** Midnight in Phnom Penh on the day of `at`, as a moment ("orders today" counts from here, not from midnight UTC). */
export const startOfPhnomPenhDay = (at: Date | string): Date => new Date(new Date(`${phnomPenhDay(at)}T00:00:00Z`).getTime() - PHNOM_PENH_OFFSET_MS);

/** A day key ("2026-10-28") moved by whole days (negative goes back): calendar days, whatever the hour or zone. */
export function addDays(dayKey: string, days: number): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole calendar days from one day key to another (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}
