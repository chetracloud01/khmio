"use client";

import { getPlanPrice, type AdminOverride, type KycRejection } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { mockStore, type MockAdminStore } from "@/mock/mock-data";
import { useDateText } from "@/components/use-date-text";
import { DEMO_STORE_ID, useAdmin, type AdminAuditEntry } from "../admin-context";
import { useMerchantProducts } from "../merchant-products-context";
import { useMerchantProfile } from "../merchant-profile-context";
import { useMerchantSubscription } from "../merchant-subscription-context";

export type AdminRow = MockAdminStore & { isDemo: boolean };

/**
 * Every store as the admin sees it, plus platform totals. Includes your own
 * demo store from the merchant dashboard, linked live: an admin change to it
 * shows up in its dashboard and storefront immediately.
 */
export function useAdminData() {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const admin = useAdmin();
  const { subscription, applyAdminChange } = useMerchantSubscription();
  const profile = useMerchantProfile();
  const { products } = useMerchantProducts();

  const rows: AdminRow[] = useMemo(() => {
    const demo: AdminRow = {
      id: DEMO_STORE_ID,
      nameKm: profile.hasProfile ? profile.shopName : mockStore.nameKm,
      nameEn: profile.hasProfile ? profile.shopName : mockStore.nameEn,
      ownerName: t("demoOwner"),
      telegramUsername: "demo",
      businessType: profile.businessType,
      plan: subscription.plan,
      status: subscription.status,
      daysLeft: subscription.daysLeft,
      kycStatus: admin.demoKycStatus,
      kyc: admin.demoKyc,
      productCount: products.length,
      joinedDaysAgo: 0,
      isDemo: true,
    };
    return [demo, ...admin.stores.map((store) => ({ ...store, isDemo: false }))];
  }, [admin.stores, admin.demoKycStatus, admin.demoKyc, subscription, profile, products.length, t]);

  const counts = {
    all: rows.length,
    trialing: rows.filter((row) => row.status === "trialing").length,
    active: rows.filter((row) => row.status === "active").length,
    grace: rows.filter((row) => row.status === "grace").length,
    paused: rows.filter((row) => row.status === "paused").length,
    kycPending: rows.filter((row) => row.kycStatus === "pending").length,
  };
  const paying = rows.filter((row) => row.plan !== "free" && (row.status === "active" || row.status === "grace"));
  const mrrUsdCents = paying.reduce((sum, row) => sum + getPlanPrice(row.plan, "USD"), 0);

  function storeName(row: Pick<AdminRow, "nameKm" | "nameEn">) {
    return locale === "km" ? row.nameKm : row.nameEn;
  }

  function applyOverride(row: AdminRow, override: AdminOverride) {
    if (row.isDemo) {
      applyAdminChange(override);
      admin.logChange({ km: row.nameKm, en: row.nameEn }, override);
    } else {
      admin.overrideStore(row.id, override);
    }
  }

  function approveKyc(row: AdminRow) {
    admin.approveKyc(row.id, { km: row.nameKm, en: row.nameEn });
  }

  function rejectKyc(row: AdminRow, rejection: KycRejection) {
    admin.rejectKyc(row.id, rejection, { km: row.nameKm, en: row.nameEn });
  }

  return { rows, counts, paying, mrrUsdCents, storeName, applyOverride, approveKyc, rejectKyc, auditLog: admin.auditLog };
}

/** One audit entry as a sentence, e.g. "Queen Bee Fashion moved to Pro". */
export function useAuditText() {
  const t = useTranslations("Admin");
  const tPlan = useTranslations("Plans");
  const tKyc = useTranslations("Kyc");
  const tSite = useTranslations("SiteEditor");
  const locale = useLocale();
  return (entry: AdminAuditEntry) => {
    const store = locale === "km" ? entry.storeNameKm : entry.storeNameEn;
    if (entry.action === "planChanged" && entry.plan) return t("auditPlanChanged", { store, plan: tPlan(entry.plan) });
    if (entry.action === "periodExtended") return t("auditExtended", { store, count: entry.days ?? 0 });
    if (entry.action === "kycApproved") return t("auditKycApproved", { store });
    if (entry.action === "invoicePaid") return t("auditInvoicePaid", { store, invoice: entry.detail ?? "" });
    if (entry.action === "invoiceVoided") return t("auditInvoiceVoided", { store, invoice: entry.detail ?? "" });
    if (entry.action === "checkClosed") return t("auditCheckClosed", { store, order: entry.detail ?? "" });
    // Admin-user entries carry the admin's name where a store's would be.
    if (entry.action === "adminInvited") return t("auditAdminInvited", { name: store, role: entry.role ? t(`role_${entry.role}`) : "" });
    if (entry.action === "adminRoleChanged") return t("auditAdminRole", { name: store, role: entry.role ? t(`role_${entry.role}`) : "" });
    if (entry.action === "adminDisabled") return t("auditAdminDisabled", { name: store });
    if (entry.action === "adminEnabled") return t("auditAdminEnabled", { name: store });
    // Website entries carry the page's key, and the version number as their detail.
    if (entry.action === "websitePublished") return t("auditWebsitePublished", { page: tSite(`page_${entry.storeNameEn}`), version: entry.detail ?? "" });
    if (entry.action === "websiteRestored") return t("auditWebsiteRestored", { page: tSite(`page_${entry.storeNameEn}`), version: entry.detail ?? "" });
    if (entry.reason) return t("auditKycRejectedReason", { store, reason: tKyc(`reason_${entry.reason}`) });
    return t("auditKycRejected", { store });
  };
}

/** "3 min ago" / "2 hr ago" / "4 days ago", from a number of minutes (the live screens' hook). */
export function useTimeAgo() {
  return useDateText().ago;
}
