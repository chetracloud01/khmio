import type {
  AdminRole,
  Currency,
  InvoiceManualPayment,
  InvoiceReason,
  InvoiceStatus,
  PaymentAmount,
  PaymentAttemptStatus,
  PaymentCheckIssue,
  PaymentProvider,
  PlanId,
} from "@khmio/shared";

// Sample data for the admin's money and access screens. Stands in for the
// subscription_invoices, payment_attempts and admin_users tables in
// docs/blueprint.md. Times are "ago" so the screens read right on any day.

export interface MockAdminInvoice {
  id: string;
  /** What the merchant and the admin both quote, e.g. INV-1058. */
  number: string;
  storeId: string;
  plan: PlanId;
  reason: InvoiceReason;
  currency: Currency;
  amountMinor: number;
  status: InvoiceStatus;
  /** Days until the due date; negative = that many days late. */
  dueInDays: number;
  createdDaysAgo: number;
  paidDaysAgo?: number;
  /** The KHQR payment's MD5, once the worker confirmed it with Bakong. */
  paymentRef?: string;
  /** Set when an admin marked it paid by hand instead. */
  manualPayment?: InvoiceManualPayment;
  voidReason?: string;
}

export const mockAdminInvoices: MockAdminInvoice[] = [
  { id: "inv-1061", number: "INV-1061", storeId: "s-bright-smile", plan: "basic", reason: "renewal", currency: "KHR", amountMinor: 20000, status: "open", dueInDays: 5, createdDaysAgo: 2 },
  { id: "inv-1058", number: "INV-1058", storeId: "s-lucky-noodle", plan: "basic", reason: "renewal", currency: "USD", amountMinor: 500, status: "open", dueInDays: -4, createdDaysAgo: 11 },
  { id: "inv-1055", number: "INV-1055", storeId: "s-bright-smile", plan: "basic", reason: "renewal", currency: "USD", amountMinor: 500, status: "void", dueInDays: 4, createdDaysAgo: 3, voidReason: "Raised in USD by mistake — this store pays in riel." },
  { id: "inv-1051", number: "INV-1051", storeId: "s-pp-mart", plan: "advance", reason: "renewal", currency: "KHR", amountMinor: 116000, status: "paid", dueInDays: 0, createdDaysAgo: 16, paidDaysAgo: 9, paymentRef: "3c59dc048e8850243be8079a5c74d079" },
  { id: "inv-1049", number: "INV-1049", storeId: "s-kampot-pepper", plan: "pro", reason: "renewal", currency: "USD", amountMinor: 1200, status: "open", dueInDays: -12, createdDaysAgo: 19 },
  { id: "inv-1042", number: "INV-1042", storeId: "s-queen-bee", plan: "pro", reason: "renewal", currency: "USD", amountMinor: 1200, status: "paid", dueInDays: 0, createdDaysAgo: 25, paidDaysAgo: 18, paymentRef: "9f3a61c8b0d24e7fa5e2d41b7c90c21e" },
  { id: "inv-1033", number: "INV-1033", storeId: "s-pp-mart", plan: "advance", reason: "upgrade", currency: "USD", amountMinor: 850, status: "paid", dueInDays: 0, createdDaysAgo: 40, paidDaysAgo: 40, paymentRef: "b6d81b360a5672d80c27430f39153e2c" },
  { id: "inv-1012", number: "INV-1012", storeId: "s-lucky-noodle", plan: "basic", reason: "renewal", currency: "USD", amountMinor: 500, status: "paid", dueInDays: 0, createdDaysAgo: 48, paidDaysAgo: 41, manualPayment: { bankReference: "FT24087-66120", note: "Paid by ABA transfer; owner sent the slip on Telegram." } },
  { id: "inv-0968", number: "INV-0968", storeId: "s-queen-bee", plan: "pro", reason: "new", currency: "USD", amountMinor: 1200, status: "paid", dueInDays: 0, createdDaysAgo: 106, paidDaysAgo: 106, paymentRef: "e4da3b7fbbce2345d7772b0674a318d5" },
];

export interface MockPaymentAttempt {
  id: string;
  storeId: string;
  orderNumber: string;
  provider: PaymentProvider;
  currency: Currency;
  amountMinor: number;
  status: PaymentAttemptStatus;
  minutesAgo: number;
  /** KHQR MD5 or PayWay tran_id. */
  providerRef: string;
  /** How many times the worker has asked the provider for this attempt's status. */
  checks: number;
}

export const mockPaymentAttempts: MockPaymentAttempt[] = [
  { id: "pa-01", storeId: "s-queen-bee", orderNumber: "SC-771233", provider: "bakong_khqr", currency: "USD", amountMinor: 2450, status: "pending", minutesAgo: 2, providerRef: "a87ff679a2f3e71d9181a67b7542122c", checks: 3 },
  { id: "pa-02", storeId: "s-pp-mart", orderNumber: "SC-771229", provider: "aba_payway", currency: "USD", amountMinor: 8900, status: "paid", minutesAgo: 6, providerRef: "PW-240930-118204", checks: 1 },
  { id: "pa-03", storeId: "s-bright-smile", orderNumber: "SC-771221", provider: "bakong_khqr", currency: "KHR", amountMinor: 40000, status: "paid", minutesAgo: 11, providerRef: "1679091c5a880faf6fb5e6087eb1b2dc", checks: 4 },
  { id: "pa-04", storeId: "s-queen-bee", orderNumber: "SC-771204", provider: "bakong_khqr", currency: "USD", amountMinor: 1850, status: "pending", minutesAgo: 14, providerRef: "8f14e45fceea167a5a36dedd4bea2543", checks: 6 },
  { id: "pa-05", storeId: "s-lucky-noodle", orderNumber: "SC-771198", provider: "bakong_khqr", currency: "KHR", amountMinor: 18000, status: "paid", minutesAgo: 23, providerRef: "c9f0f895fb98ab9159f51fd0297e236d", checks: 2 },
  { id: "pa-06", storeId: "s-pp-mart", orderNumber: "SC-771180", provider: "bakong_khqr", currency: "USD", amountMinor: 3120, status: "expired", minutesAgo: 38, providerRef: "45c48cce2e2d7fbdea1afc51c7c6ad26", checks: 40 },
  { id: "pa-07", storeId: "s-pp-mart", orderNumber: "SC-771166", provider: "aba_payway", currency: "USD", amountMinor: 4200, status: "failed", minutesAgo: 52, providerRef: "PW-240930-117962", checks: 2 },
  { id: "pa-08", storeId: "s-queen-bee", orderNumber: "SC-771140", provider: "bakong_khqr", currency: "USD", amountMinor: 1575, status: "paid", minutesAgo: 71, providerRef: "d3d9446802a44259755d38e6d163e820", checks: 3 },
  { id: "pa-09", storeId: "s-bright-smile", orderNumber: "SC-771102", provider: "bakong_khqr", currency: "KHR", amountMinor: 60000, status: "paid", minutesAgo: 96, providerRef: "6512bd43d9caa6e02c990b0a82652dca", checks: 5 },
  { id: "pa-10", storeId: "s-lucky-noodle", orderNumber: "SC-771047", provider: "bakong_khqr", currency: "KHR", amountMinor: 24000, status: "expired", minutesAgo: 133, providerRef: "c20ad4d76fe97759aa27a0c99bff6710", checks: 40 },
  { id: "pa-11", storeId: "s-lucky-noodle", orderNumber: "SC-770981", provider: "bakong_khqr", currency: "KHR", amountMinor: 26000, status: "failed", minutesAgo: 185, providerRef: "c51ce410c124a10e0db5e4b97fc2af39", checks: 3 },
  { id: "pa-12", storeId: "s-pp-mart", orderNumber: "SC-770930", provider: "aba_payway", currency: "USD", amountMinor: 12640, status: "paid", minutesAgo: 240, providerRef: "PW-240930-117411", checks: 1 },
  { id: "pa-13", storeId: "s-queen-bee", orderNumber: "SC-770902", provider: "bakong_khqr", currency: "USD", amountMinor: 990, status: "paid", minutesAgo: 305, providerRef: "aab3238922bcc25a6f606eb525ffdc56", checks: 2 },
];

export interface MockFailedCheck {
  id: string;
  storeId: string;
  orderNumber: string;
  provider: PaymentProvider;
  providerRef: string;
  expected: PaymentAmount;
  /** What the provider says was paid, when it said anything. */
  reported?: PaymentAmount;
  issue: PaymentCheckIssue;
  minutesAgo: number;
  /** Status checks tried before it was put in front of a person. */
  checks: number;
  /** open = needs a look; confirmed = a later check found the exact payment; closed = handled by hand, with a note. */
  status: "open" | "confirmed" | "closed";
  closeNote?: string;
  /** Mock only: what asking the provider again will find. */
  recheckFinds: "exact_payment" | "no_change";
}

export const mockFailedChecks: MockFailedCheck[] = [
  { id: "fc-4", storeId: "s-queen-bee", orderNumber: "SC-771204", provider: "bakong_khqr", providerRef: "8f14e45fceea167a5a36dedd4bea2543", expected: { currency: "USD", amountMinor: 1850 }, issue: "provider_unreachable", minutesAgo: 14, checks: 6, status: "open", recheckFinds: "exact_payment" },
  { id: "fc-3", storeId: "s-pp-mart", orderNumber: "SC-771166", provider: "aba_payway", providerRef: "PW-240930-117962", expected: { currency: "USD", amountMinor: 4200 }, reported: { currency: "USD", amountMinor: 4000 }, issue: "amount_mismatch", minutesAgo: 52, checks: 2, status: "open", recheckFinds: "no_change" },
  { id: "fc-2", storeId: "s-lucky-noodle", orderNumber: "SC-770981", provider: "bakong_khqr", providerRef: "c51ce410c124a10e0db5e4b97fc2af39", expected: { currency: "KHR", amountMinor: 26000 }, reported: { currency: "USD", amountMinor: 650 }, issue: "currency_mismatch", minutesAgo: 185, checks: 3, status: "open", recheckFinds: "no_change" },
  { id: "fc-1", storeId: "s-bright-smile", orderNumber: "SC-769412", provider: "bakong_khqr", providerRef: "70efdf2ec9b086079795c442636b55fb", expected: { currency: "KHR", amountMinor: 32000 }, reported: { currency: "KHR", amountMinor: 32000 }, issue: "paid_after_expiry", minutesAgo: 1560, checks: 41, status: "closed", closeNote: "Salon refunded the buyer in cash and sent a photo of the receipt.", recheckFinds: "no_change" },
];

export interface MockAdminUser {
  id: string;
  name: string;
  telegramUsername: string;
  role: AdminRole;
  disabled: boolean;
  /** null = invited, hasn't logged in yet. */
  lastActiveMinutesAgo: number | null;
}

/** The admin looking at the screen in this mockup. */
export const CURRENT_ADMIN_ID = "admin-owner";

export const mockAdminUsers: MockAdminUser[] = [
  { id: CURRENT_ADMIN_ID, name: "Platform owner", telegramUsername: "khmio_owner", role: "owner", disabled: false, lastActiveMinutesAgo: 0 },
  { id: "admin-sreymom", name: "Sreymom Tan", telegramUsername: "sreymom_support", role: "support", disabled: false, lastActiveMinutesAgo: 35 },
  { id: "admin-visal", name: "Visal Chhun", telegramUsername: "visal_finance", role: "finance", disabled: false, lastActiveMinutesAgo: 1500 },
  { id: "admin-ratanak", name: "Ratanak Meas", telegramUsername: "ratanak_m", role: "support", disabled: true, lastActiveMinutesAgo: 57600 },
];
