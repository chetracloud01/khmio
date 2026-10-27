import { describe, expect, it } from "vitest";
import { adminCan, adminInviteSchema, canChangeAdmin, type AdminAccount, type AdminRole } from "./admin-roles";
import { backupIsStale } from "./backups";
import { workerState } from "./health";
import { applyInvoicePaid, getInvoiceView, invoiceManualPaymentSchema, invoiceVoidSchema } from "./billing";
import { toFieldErrors } from "./form-errors";
import { evaluatePaymentCheck, failedCheckCloseSchema, isExactPaymentMatch } from "./payment-attempts";
import { BILLING_PERIOD_DAYS } from "./plans";

describe("invoices", () => {
  it("is overdue only while open and past its due date", () => {
    expect(getInvoiceView({ status: "open", dueInDays: 3 })).toBe("due");
    expect(getInvoiceView({ status: "open", dueInDays: 0 })).toBe("due");
    expect(getInvoiceView({ status: "open", dueInDays: -1 })).toBe("overdue");
    expect(getInvoiceView({ status: "paid", dueInDays: -9 })).toBe("paid");
    expect(getInvoiceView({ status: "void", dueInDays: -9 })).toBe("void");
  });

  it("reopens a paused or overdue store the moment its renewal is paid", () => {
    const paid = { plan: "pro", reason: "renewal" } as const;
    expect(applyInvoicePaid({ plan: "pro", status: "paused", daysLeft: 0 }, paid)).toEqual({
      plan: "pro",
      status: "active",
      daysLeft: BILLING_PERIOD_DAYS,
    });
    expect(applyInvoicePaid({ plan: "pro", status: "grace", daysLeft: 3 }, paid).status).toBe("active");
  });

  it("adds the next period when a renewal is paid early", () => {
    expect(applyInvoicePaid({ plan: "basic", status: "active", daysLeft: 5 }, { plan: "basic", reason: "renewal" })).toEqual({
      plan: "basic",
      status: "active",
      daysLeft: 5 + BILLING_PERIOD_DAYS,
    });
  });

  it("starts the chosen plan when a store leaves the trial, and leaves an upgrade's period alone", () => {
    expect(applyInvoicePaid({ plan: "free", status: "trialing", daysLeft: 4 }, { plan: "basic", reason: "new" })).toEqual({
      plan: "basic",
      status: "active",
      daysLeft: BILLING_PERIOD_DAYS,
    });
    const upgraded = { plan: "advance", status: "active", daysLeft: 12 } as const;
    expect(applyInvoicePaid(upgraded, { plan: "advance", reason: "upgrade" })).toEqual(upgraded);
  });

  it("needs a bank reference to mark an invoice paid by hand, and a reason to void one", () => {
    const noRef = invoiceManualPaymentSchema.safeParse({ bankReference: " ", note: "" });
    expect(noRef.success ? {} : toFieldErrors(noRef.error)).toEqual({ bankReference: "too_short" });
    expect(invoiceManualPaymentSchema.safeParse({ bankReference: "FT2409-88213", note: "" }).success).toBe(true);
    expect(invoiceVoidSchema.safeParse({ reason: "no" }).success).toBe(false);
  });
});

describe("payment checks", () => {
  const expected = { currency: "USD", amountMinor: 664 } as const;

  it("counts as paid only on an exact currency and amount", () => {
    expect(isExactPaymentMatch(expected, { currency: "USD", amountMinor: 664 })).toBe(true);
    expect(isExactPaymentMatch(expected, { currency: "USD", amountMinor: 663 })).toBe(false);
    expect(isExactPaymentMatch(expected, { currency: "KHR", amountMinor: 664 })).toBe(false);
    expect(evaluatePaymentCheck(expected, { currency: "USD", amountMinor: 664 }, false)).toEqual({ outcome: "paid" });
  });

  it("names the problem instead of guessing", () => {
    expect(evaluatePaymentCheck(expected, "unreachable", false)).toEqual({ outcome: "issue", issue: "provider_unreachable" });
    expect(evaluatePaymentCheck(expected, null, false)).toEqual({ outcome: "not_paid" });
    expect(evaluatePaymentCheck(expected, { currency: "USD", amountMinor: 600 }, false)).toEqual({ outcome: "issue", issue: "amount_mismatch" });
    // The same number of riel is not the same money.
    expect(evaluatePaymentCheck(expected, { currency: "KHR", amountMinor: 664 }, false)).toEqual({ outcome: "issue", issue: "currency_mismatch" });
    expect(evaluatePaymentCheck(expected, { currency: "USD", amountMinor: 664 }, true)).toEqual({ outcome: "issue", issue: "paid_after_expiry" });
  });

  it("needs a note to close a failed check", () => {
    expect(failedCheckCloseSchema.safeParse({ note: "ok" }).success).toBe(false);
    expect(failedCheckCloseSchema.safeParse({ note: "Seller refunded the buyer in cash." }).success).toBe(true);
  });
});

describe("admin roles", () => {
  it("lets each role do its own job only", () => {
    expect(adminCan("owner", "admins_manage")).toBe(true);
    expect(adminCan("support", "kyc_review")).toBe(true);
    expect(adminCan("support", "billing_manage")).toBe(false);
    expect(adminCan("finance", "billing_manage")).toBe(true);
    expect(adminCan("finance", "kyc_review")).toBe(false);
    expect(adminCan("finance", "admins_manage")).toBe(false);
  });

  it("lets everyone see backups, support and owners start one, and only owners restore a shop", () => {
    expect(["owner", "support", "finance"].every((role) => adminCan(role as AdminRole, "backups_view"))).toBe(true);
    expect(adminCan("support", "backups_run")).toBe(true);
    expect(adminCan("finance", "backups_run")).toBe(false);
    expect(adminCan("owner", "shop_restore")).toBe(true);
    expect(adminCan("support", "shop_restore")).toBe(false);
  });

  it("calls the worker down after 15 minutes without a heartbeat", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    expect(workerState(new Date("2026-10-07T11:50:00Z"), now)).toBe("ok");
    expect(workerState(new Date("2026-10-07T11:44:00Z"), now)).toBe("warning");
    expect(workerState(null, now)).toBe("warning");
  });

  it("calls the backups stale after 26 hours without a good one", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    expect(backupIsStale(new Date("2026-10-07T03:00:00Z"), now)).toBe(false);
    expect(backupIsStale(new Date("2026-10-06T09:59:00Z"), now)).toBe(true);
    expect(backupIsStale(null, now)).toBe(true);
  });

  it("never leaves the admin area without an active owner", () => {
    const admins: AdminAccount[] = [
      { id: "a", role: "owner", disabled: false },
      { id: "b", role: "support", disabled: false },
      { id: "c", role: "owner", disabled: true },
    ];
    expect(canChangeAdmin(admins, "a", { disabled: true })).toBe(false);
    expect(canChangeAdmin(admins, "a", { role: "finance" })).toBe(false);
    expect(canChangeAdmin(admins, "b", { disabled: true })).toBe(true);
    expect(canChangeAdmin(admins, "b", { role: "owner" })).toBe(true);
    // With a second active owner, the first may step down.
    const two = admins.map((admin) => (admin.id === "c" ? { ...admin, disabled: false } : admin));
    expect(canChangeAdmin(two, "a", { disabled: true })).toBe(true);
  });

  it("reads a Telegram username with or without the @", () => {
    expect(adminInviteSchema.parse({ name: "Dara", telegramUsername: "@dara_admin", role: "support" }).telegramUsername).toBe("dara_admin");
    const bad = adminInviteSchema.safeParse({ name: "D", telegramUsername: "ab", role: "support" });
    expect(bad.success ? {} : toFieldErrors(bad.error)).toEqual({ name: "too_short", telegramUsername: "telegram_invalid" });
  });
});
