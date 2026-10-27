"use client";

import { getInvoiceView } from "@khmio/shared";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AdminFrame } from "@/components/admin-frame/admin-frame";
import type { AdminBadge } from "@/components/admin-frame/admin-nav";
import { useAdmin } from "../admin-context";
import { useMerchantProducts } from "../merchant-products-context";
import { useMerchantProfile } from "../merchant-profile-context";
import { useMerchantSubscription } from "../merchant-subscription-context";
import { useAdminData } from "./use-admin-data";
import { useAdminInvoices } from "./use-admin-money";

// Mock only: the real admin area (/admin) sits behind admin login with 2FA
// and uses the same frame (components/admin-frame).
export default function AdminLayout({ children }: { children: ReactNode }) {
  const ready = [useAdmin(), useMerchantSubscription(), useMerchantProfile(), useMerchantProducts()].every(
    (context) => context.hydrated,
  );
  return ready ? <MockAdminShell>{children}</MockAdminShell> : null;
}

function MockAdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("AdminNav");
  const { counts } = useAdminData();
  const { rows: invoiceRows } = useAdminInvoices();
  const { failedChecks } = useAdmin();
  const badgeCount: Partial<Record<AdminBadge, number>> = {
    kycPending: counts.kycPending,
    invoicesOverdue: invoiceRows.filter((invoice) => getInvoiceView(invoice) === "overdue").length,
    failedChecks: failedChecks.filter((check) => check.status === "open").length,
  };
  return (
    <AdminFrame area="mockup" badgeCount={badgeCount} account={{ name: t("accountName"), role: t("accountRole") }}>
      {children}
    </AdminFrame>
  );
}
