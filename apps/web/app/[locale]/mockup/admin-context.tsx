"use client";

import {
  adminSettingsSchema,
  applyAdminOverride,
  applyInvoicePaid,
  canChangeAdmin,
  DEFAULT_ADMIN_SETTINGS,
  kycStatusSchema,
  type AdminInvite,
  type AdminOverride,
  type AdminRole,
  type AdminSettings,
  type FailedCheckClose,
  type InvoiceManualPayment,
  type InvoiceVoid,
  type KycRejection,
  type KycRejectReason,
  type KycSubmission,
  type PlanId,
} from "@khmio/shared";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  mockAdminInvoices,
  mockAdminUsers,
  mockFailedChecks,
  type MockAdminInvoice,
  type MockAdminUser,
  type MockFailedCheck,
} from "@/mock/mock-admin-billing";
import { mockAdminStores, type MockAdminStore, type MockKycRecord, type MockKycStatus } from "@/mock/mock-data";

export const DEMO_STORE_ID = "demo-store";

export interface AdminAuditEntry {
  id: string;
  storeNameKm: string;
  storeNameEn: string;
  /** For admin-user actions there's no store: the two name fields hold the admin's name; for website actions, the page's name. */
  action:
    | "kycApproved"
    | "kycRejected"
    | "planChanged"
    | "periodExtended"
    | "invoicePaid"
    | "invoiceVoided"
    | "checkClosed"
    | "adminInvited"
    | "adminRoleChanged"
    | "adminDisabled"
    | "adminEnabled"
    | "websitePublished"
    | "websiteRestored";
  plan?: PlanId;
  days?: number;
  reason?: KycRejectReason;
  /** The invoice or order number the entry is about. */
  detail?: string;
  role?: AdminRole;
  minutesAgo: number;
}

type StoreName = { km: string; en: string };

interface AdminContextValue {
  hydrated: boolean;
  stores: MockAdminStore[];
  /** Your own demo store's identity check — shared by the merchant dashboard, storefront badge and admin panel. */
  demoKycStatus: MockKycStatus;
  demoKyc: MockKycRecord;
  /** The merchant sends (or re-sends) their ID; it goes to the admin queue. Validate with kycSubmissionSchema first. */
  submitDemoKyc: (submission: KycSubmission) => void;
  auditLog: AdminAuditEntry[];
  approveKyc: (storeId: string, storeName: StoreName) => void;
  /** Validate with kycRejectionSchema first. The merchant sees the reason and note. */
  rejectKyc: (storeId: string, rejection: KycRejection, storeName: StoreName) => void;
  /** For the example stores. The demo store goes through its own subscription context, then calls logChange. */
  overrideStore: (storeId: string, override: AdminOverride) => void;
  logChange: (storeName: StoreName, override: AdminOverride) => void;
  settings: AdminSettings;
  /** Callers validate with adminSettingsSchema first; saved values are always valid. */
  saveSettings: (settings: AdminSettings) => void;
  /** The example stores' invoices. The demo store's own live in its subscription. */
  invoices: MockAdminInvoice[];
  /** Validate with invoiceManualPaymentSchema first. Reopens the store if it was overdue or paused. */
  markInvoicePaid: (invoiceId: string, payment: InvoiceManualPayment) => void;
  /** Validate with invoiceVoidSchema first. */
  voidInvoice: (invoiceId: string, detail: InvoiceVoid) => void;
  /** Manual payments recorded against the demo store's invoices, by invoice id. */
  demoManualPayments: Record<string, InvoiceManualPayment>;
  recordDemoInvoicePaid: (invoice: { id: string; number: string }, payment: InvoiceManualPayment, storeName: StoreName) => void;
  failedChecks: MockFailedCheck[];
  /** Asks the provider again. "confirmed" = it now reports the exact payment, and the check is settled. */
  recheckPayment: (checkId: string) => "confirmed" | "no_change";
  /** Validate with failedCheckCloseSchema first. */
  closeFailedCheck: (checkId: string, detail: FailedCheckClose) => void;
  adminUsers: MockAdminUser[];
  /** Validate with adminInviteSchema first. */
  inviteAdmin: (invite: AdminInvite) => void;
  /** False (and nothing changes) if it would leave no active owner. */
  changeAdmin: (adminId: string, change: { role?: AdminRole; disabled?: boolean }) => boolean;
  /** A website page was published, or an earlier version restored to its draft (A10). */
  /** The page's key goes in the name fields; the audit log shows its name in the reader's language. */
  logWebsiteChange: (action: "websitePublished" | "websiteRestored", pageKey: string, version: number) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

// Switching locale changes the [locale] URL segment, which remounts this
// provider — localStorage is what survives that (and a page refresh).
const STORAGE_KEY = "khmio:mockup-admin";

interface PersistedAdmin {
  stores: MockAdminStore[];
  demoKycStatus: MockKycStatus;
  demoKyc: MockKycRecord;
  auditLog: AdminAuditEntry[];
  settings: AdminSettings;
  invoices: MockAdminInvoice[];
  demoManualPayments: Record<string, InvoiceManualPayment>;
  failedChecks: MockFailedCheck[];
  adminUsers: MockAdminUser[];
}

const seedAuditLog: AdminAuditEntry[] = [
  { id: "a2", storeNameKm: "ភ្នំពេញម៉ាត", storeNameEn: "Phnom Penh Mart", action: "periodExtended", days: 30, minutesAgo: 2880 },
  { id: "a1", storeNameKm: "ហាងឃ្វីនប៊ី", storeNameEn: "Queen Bee Fashion", action: "kycApproved", minutesAgo: 4320 },
];

let entryCounter = 0;
function newEntry(storeName: StoreName, fields: Pick<AdminAuditEntry, "action" | "plan" | "days" | "reason" | "detail" | "role">) {
  entryCounter += 1;
  return { id: `a-${Date.now()}-${entryCounter}`, storeNameKm: storeName.km, storeNameEn: storeName.en, minutesAgo: 0, ...fields };
}

function overrideEntryFields(override: AdminOverride): Pick<AdminAuditEntry, "action" | "plan" | "days"> {
  return override.kind === "setPlan"
    ? { action: "planChanged", plan: override.plan }
    : { action: "periodExtended", days: override.days };
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<MockAdminStore[]>(mockAdminStores);
  const [demoKycStatus, setDemoKycStatus] = useState<MockKycStatus>("not_submitted");
  const [demoKyc, setDemoKyc] = useState<MockKycRecord>({});
  const [auditLog, setAuditLog] = useState<AdminAuditEntry[]>(seedAuditLog);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [invoices, setInvoices] = useState<MockAdminInvoice[]>(mockAdminInvoices);
  const [demoManualPayments, setDemoManualPayments] = useState<Record<string, InvoiceManualPayment>>({});
  const [failedChecks, setFailedChecks] = useState<MockFailedCheck[]>(mockFailedChecks);
  const [adminUsers, setAdminUsers] = useState<MockAdminUser[]>(mockAdminUsers);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedAdmin>;
        if (parsed.stores) {
          // Stores saved before documents existed are "pending" with nothing to review;
          // take the example's current KYC state instead. Real decisions (approved/rejected) are kept.
          const seedById = new Map(mockAdminStores.map((store) => [store.id, store]));
          setStores(
            parsed.stores.map((store) => {
              const seed = seedById.get(store.id);
              return store.kycStatus === "pending" && !store.kyc && seed
                ? { ...store, kycStatus: seed.kycStatus, kyc: seed.kyc }
                : store;
            }),
          );
        }
        // A "pending" saved before documents existed has nothing to review, so it starts over.
        const storedStatus = kycStatusSchema.safeParse(parsed.demoKycStatus);
        if (storedStatus.success && (storedStatus.data !== "pending" || parsed.demoKyc?.submission)) {
          setDemoKycStatus(storedStatus.data);
        }
        if (parsed.demoKyc) setDemoKyc(parsed.demoKyc);
        if (parsed.auditLog) setAuditLog(parsed.auditLog);
        const storedSettings = adminSettingsSchema.safeParse(parsed.settings);
        if (storedSettings.success) setSettings(storedSettings.data);
        if (Array.isArray(parsed.invoices)) setInvoices(parsed.invoices);
        if (parsed.demoManualPayments) setDemoManualPayments(parsed.demoManualPayments);
        if (Array.isArray(parsed.failedChecks)) setFailedChecks(parsed.failedChecks);
        if (Array.isArray(parsed.adminUsers)) setAdminUsers(parsed.adminUsers);
      }
    } catch {
      // Corrupt or inaccessible storage (e.g. private browsing) — keep the seed data.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedAdmin = {
        stores,
        demoKycStatus,
        demoKyc,
        auditLog,
        settings,
        invoices,
        demoManualPayments,
        failedChecks,
        adminUsers,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage full or unavailable — changes just won't persist this time.
    }
  }, [stores, demoKycStatus, demoKyc, auditLog, settings, invoices, demoManualPayments, failedChecks, adminUsers, hydrated]);

  function submitDemoKyc(submission: KycSubmission) {
    setDemoKyc({ submission: { ...submission, submittedMinutesAgo: 0 } });
    setDemoKycStatus("pending");
  }

  function updateKyc(storeId: string, status: "approved" | "rejected", rejection?: KycRejection) {
    const record = (prev: MockKycRecord = {}): MockKycRecord => ({ submission: prev.submission, rejection });
    if (storeId === DEMO_STORE_ID) {
      setDemoKycStatus(status);
      setDemoKyc((prev) => record(prev));
    } else {
      setStores((prev) =>
        prev.map((store) => (store.id === storeId ? { ...store, kycStatus: status, kyc: record(store.kyc) } : store)),
      );
    }
  }

  function approveKyc(storeId: string, storeName: StoreName) {
    updateKyc(storeId, "approved");
    setAuditLog((prev) => [newEntry(storeName, { action: "kycApproved" }), ...prev]);
  }

  function rejectKyc(storeId: string, rejection: KycRejection, storeName: StoreName) {
    updateKyc(storeId, "rejected", rejection);
    setAuditLog((prev) => [newEntry(storeName, { action: "kycRejected", reason: rejection.reason }), ...prev]);
  }

  function logChange(storeName: StoreName, override: AdminOverride) {
    setAuditLog((prev) => [newEntry(storeName, overrideEntryFields(override)), ...prev]);
  }

  function overrideStore(storeId: string, override: AdminOverride) {
    const store = stores.find((item) => item.id === storeId);
    if (!store) return;
    const next = applyAdminOverride({ plan: store.plan, status: store.status, daysLeft: store.daysLeft }, override);
    setStores((prev) => prev.map((item) => (item.id === storeId ? { ...item, ...next } : item)));
    logChange({ km: store.nameKm, en: store.nameEn }, override);
  }

  const nameOfStore = (storeId: string): StoreName => {
    const store = stores.find((item) => item.id === storeId);
    return { km: store?.nameKm ?? storeId, en: store?.nameEn ?? storeId };
  };
  const log = (storeName: StoreName, fields: Parameters<typeof newEntry>[1]) =>
    setAuditLog((prev) => [newEntry(storeName, fields), ...prev]);

  function markInvoicePaid(invoiceId: string, payment: InvoiceManualPayment) {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice || invoice.status !== "open") return;
    setInvoices((prev) =>
      prev.map((item) => (item.id === invoiceId ? { ...item, status: "paid", paidDaysAgo: 0, manualPayment: payment } : item)),
    );
    // Paying is what reopens an overdue or paused store — the same rule the automatic KHQR check follows.
    setStores((prev) =>
      prev.map((store) =>
        store.id === invoice.storeId
          ? { ...store, ...applyInvoicePaid({ plan: store.plan, status: store.status, daysLeft: store.daysLeft }, invoice) }
          : store,
      ),
    );
    log(nameOfStore(invoice.storeId), { action: "invoicePaid", detail: invoice.number });
  }

  function voidInvoice(invoiceId: string, detail: InvoiceVoid) {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice || invoice.status !== "open") return;
    setInvoices((prev) => prev.map((item) => (item.id === invoiceId ? { ...item, status: "void", voidReason: detail.reason } : item)));
    log(nameOfStore(invoice.storeId), { action: "invoiceVoided", detail: invoice.number });
  }

  function recordDemoInvoicePaid(invoice: { id: string; number: string }, payment: InvoiceManualPayment, storeName: StoreName) {
    setDemoManualPayments((prev) => ({ ...prev, [invoice.id]: payment }));
    log(storeName, { action: "invoicePaid", detail: invoice.number });
  }

  function recheckPayment(checkId: string): "confirmed" | "no_change" {
    const check = failedChecks.find((item) => item.id === checkId);
    if (!check || check.status !== "open" || check.recheckFinds !== "exact_payment") return "no_change";
    setFailedChecks((prev) =>
      prev.map((item) => (item.id === checkId ? { ...item, status: "confirmed", reported: item.expected, checks: item.checks + 1 } : item)),
    );
    return "confirmed";
  }

  function closeFailedCheck(checkId: string, detail: FailedCheckClose) {
    const check = failedChecks.find((item) => item.id === checkId);
    if (!check || check.status !== "open") return;
    setFailedChecks((prev) => prev.map((item) => (item.id === checkId ? { ...item, status: "closed", closeNote: detail.note } : item)));
    log(nameOfStore(check.storeId), { action: "checkClosed", detail: check.orderNumber });
  }

  function inviteAdmin(invite: AdminInvite) {
    const admin: MockAdminUser = {
      id: `admin-${Date.now()}`,
      name: invite.name,
      telegramUsername: invite.telegramUsername,
      role: invite.role,
      disabled: false,
      lastActiveMinutesAgo: null,
    };
    setAdminUsers((prev) => [...prev, admin]);
    log({ km: admin.name, en: admin.name }, { action: "adminInvited", role: admin.role });
  }

  function changeAdmin(adminId: string, change: { role?: AdminRole; disabled?: boolean }): boolean {
    const admin = adminUsers.find((item) => item.id === adminId);
    if (!admin || !canChangeAdmin(adminUsers, adminId, change)) return false;
    setAdminUsers((prev) => prev.map((item) => (item.id === adminId ? { ...item, ...change } : item)));
    const name = { km: admin.name, en: admin.name };
    if (change.role && change.role !== admin.role) log(name, { action: "adminRoleChanged", role: change.role });
    if (change.disabled !== undefined && change.disabled !== admin.disabled) {
      log(name, { action: change.disabled ? "adminDisabled" : "adminEnabled" });
    }
    return true;
  }

  return (
    <AdminContext.Provider
      value={{
        hydrated,
        stores,
        demoKycStatus,
        demoKyc,
        submitDemoKyc,
        auditLog,
        approveKyc,
        rejectKyc,
        overrideStore,
        logChange,
        logWebsiteChange: (action, pageKey, version) => log({ km: pageKey, en: pageKey }, { action, detail: String(version) }),
        settings,
        saveSettings: setSettings,
        invoices,
        markInvoicePaid,
        voidInvoice,
        demoManualPayments,
        recordDemoInvoicePaid,
        failedChecks,
        recheckPayment,
        closeFailedCheck,
        adminUsers,
        inviteAdmin,
        changeAdmin,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within an AdminProvider");
  return ctx;
}
