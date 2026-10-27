"use client";

import {
  getInvoiceView,
  GRACE_PERIOD_DAYS,
  type InvoiceManualPayment,
  type InvoiceVoid,
  type SubscriptionState,
} from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import type { MockAdminInvoice } from "@/mock/mock-admin-billing";
import type { MockSubscriptionInvoice } from "@/mock/mock-data";
import { DEMO_STORE_ID, useAdmin } from "../admin-context";
import { useMerchantSubscription } from "../merchant-subscription-context";
import { useAdminData } from "./use-admin-data";

export type InvoiceRow = MockAdminInvoice & { isDemo: boolean; nameKm: string; nameEn: string };

/** The demo store's dashboard invoices don't carry a due date; it follows from where the subscription is. */
function demoDueInDays(invoice: MockSubscriptionInvoice, subscription: SubscriptionState): number {
  if (invoice.status !== "open") return 0;
  if (subscription.status === "grace") return subscription.daysLeft - GRACE_PERIOD_DAYS;
  if (subscription.status === "paused") return -(GRACE_PERIOD_DAYS + 1);
  return subscription.daysLeft;
}

/**
 * Every invoice the admin sees: the example stores' plus your own demo
 * store's, linked live — marking the demo invoice paid here reopens the shop
 * in its dashboard, exactly as paying it there would.
 */
export function useAdminInvoices() {
  const admin = useAdmin();
  const { rows: stores } = useAdminData();
  const { subscription, payInvoice } = useMerchantSubscription();

  const rows: InvoiceRow[] = useMemo(() => {
    const names = new Map(stores.map((store) => [store.id, store]));
    const demoStore = names.get(DEMO_STORE_ID);
    const demo: InvoiceRow[] = subscription.invoices.map((invoice) => ({
      id: invoice.id,
      // The dashboard mock has no invoice numbers; the end of its id is unique enough to quote.
      number: `INV-D${invoice.id.replace(/\D/g, "").slice(-4)}`,
      storeId: DEMO_STORE_ID,
      plan: invoice.plan,
      reason: invoice.reason,
      currency: invoice.currency,
      amountMinor: invoice.amountMinor,
      status: invoice.status,
      dueInDays: demoDueInDays(invoice, subscription),
      createdDaysAgo: invoice.createdDaysAgo,
      paidDaysAgo: invoice.status === "paid" ? 0 : undefined,
      manualPayment: admin.demoManualPayments[invoice.id],
      isDemo: true,
      nameKm: demoStore?.nameKm ?? "",
      nameEn: demoStore?.nameEn ?? "",
    }));
    const examples: InvoiceRow[] = admin.invoices.map((invoice) => ({
      ...invoice,
      isDemo: false,
      nameKm: names.get(invoice.storeId)?.nameKm ?? invoice.storeId,
      nameEn: names.get(invoice.storeId)?.nameEn ?? invoice.storeId,
    }));
    return [...demo, ...examples];
  }, [admin.invoices, admin.demoManualPayments, stores, subscription]);

  function markPaid(row: InvoiceRow, payment: InvoiceManualPayment) {
    if (row.isDemo) {
      payInvoice(row.id);
      admin.recordDemoInvoicePaid({ id: row.id, number: row.number }, payment, { km: row.nameKm, en: row.nameEn });
    } else {
      admin.markInvoicePaid(row.id, payment);
    }
  }

  function voidInvoice(row: InvoiceRow, detail: InvoiceVoid) {
    // The demo store's invoices belong to its dashboard; only the example stores' can be voided here.
    if (!row.isDemo) admin.voidInvoice(row.id, detail);
  }

  /** The invoice a store still has to pay, if any (the oldest first). */
  function openInvoiceFor(storeId: string): InvoiceRow | undefined {
    return rows.filter((row) => row.storeId === storeId && row.status === "open").sort((a, b) => a.dueInDays - b.dueInDays)[0];
  }

  return { rows, markPaid, voidInvoice, openInvoiceFor };
}

/** "Due in 5 days" / "Due today" / "4 days overdue" for an open invoice. */
export function useDueText() {
  const t = useTranslations("Admin");
  return (dueInDays: number) =>
    dueInDays < 0 ? t("overdueBy", { count: -dueInDays }) : dueInDays === 0 ? t("dueToday") : t("dueIn", { count: dueInDays });
}

/** "Today" / "3 days ago". */
export function useDaysAgo() {
  const t = useTranslations("Admin");
  const tDates = useTranslations("Dates");
  return (days: number) => (days === 0 ? t("today") : tDates("daysAgo", { count: days }));
}

/** A store's name by id, in the viewer's language — for rows that only carry the id. */
export function useStoreNames() {
  const locale = useLocale();
  const { rows } = useAdminData();
  const names = useMemo(() => new Map(rows.map((row) => [row.id, locale === "km" ? row.nameKm : row.nameEn])), [rows, locale]);
  return (storeId: string) => names.get(storeId) ?? storeId;
}
