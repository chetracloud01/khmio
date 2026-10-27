"use client";

import { TONE_STYLES } from "@khmio/ui";
import {
  formatKhr,
  formatUsd,
  type AdminRole,
  type Currency,
  type InvoiceView,
  type PaymentAttemptStatus,
} from "@khmio/shared";
import type { MockFailedCheck } from "@/mock/mock-admin-billing";

// Shared by the admin's money screens (subscriptions, invoices, buyer
// payments, failed checks) so amounts, references and status colours read
// the same on all of them.

export function money(amountMinor: number, currency: Currency): string {
  return currency === "USD" ? formatUsd(amountMinor) : formatKhr(amountMinor);
}

/**
 * Totals across stores are kept per currency — dollars and riel are never
 * added into one number at some rate (docs/blueprint.md "Multi-currency
 * pricing and totals").
 */
export function sumByCurrency(rows: { currency: Currency; amountMinor: number }[]): Record<Currency, number> {
  const sums: Record<Currency, number> = { USD: 0, KHR: 0 };
  for (const row of rows) sums[row.currency] += row.amountMinor;
  return sums;
}

/** "$17.00 + 20,000៛" — only the currencies with money in them; "$0.00" when neither has. */
export function formatSums(sums: Record<Currency, number>): string {
  const parts = (["USD", "KHR"] as const).filter((currency) => sums[currency] > 0).map((currency) => money(sums[currency], currency));
  return parts.length > 0 ? parts.join(" + ") : money(0, "USD");
}

/** A 32-character KHQR MD5 shortened for a table cell; the full one shows in the details. */
export function shortRef(ref: string): string {
  return ref.length > 18 ? `${ref.slice(0, 8)}…${ref.slice(-4)}` : ref;
}

export const INVOICE_VIEW_STYLES: Record<InvoiceView, string> = {
  due: TONE_STYLES.info,
  overdue: TONE_STYLES.danger,
  paid: TONE_STYLES.success,
  void: TONE_STYLES.muted,
};

export const ATTEMPT_STATUS_STYLES: Record<PaymentAttemptStatus, string> = {
  pending: TONE_STYLES.warning,
  paid: TONE_STYLES.success,
  expired: TONE_STYLES.muted,
  failed: TONE_STYLES.danger,
};

export const CHECK_STATUS_STYLES: Record<MockFailedCheck["status"], string> = {
  open: TONE_STYLES.danger,
  confirmed: TONE_STYLES.success,
  closed: TONE_STYLES.muted,
};

export const ROLE_STYLES: Record<AdminRole, string> = {
  owner: TONE_STYLES.brand,
  support: TONE_STYLES.info,
  finance: TONE_STYLES.success,
};

// Label–value pairs in a details panel: the shared kit's, re-exported for the mockup pages.
export { DetailList } from "@khmio/ui";
