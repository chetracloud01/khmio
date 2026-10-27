"use client";

import { cn } from "@khmio/ui";
import { BadgeCheck, CalendarPlus, CreditCard, Globe, History, Layers, ReceiptText, ShieldX, UserCog } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AdminAuditEntry } from "../../admin-context";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { PageHeader } from "../admin-ui";
import { useAdminData, useAuditText, useTimeAgo } from "../use-admin-data";

const ACTION_ICON: Record<AdminAuditEntry["action"], { icon: typeof Layers; style: string }> = {
  planChanged: { icon: Layers, style: "bg-brand/10 text-brand" },
  periodExtended: { icon: CalendarPlus, style: "bg-info/10 text-info" },
  kycApproved: { icon: BadgeCheck, style: "bg-success/10 text-success" },
  kycRejected: { icon: ShieldX, style: "bg-danger/10 text-danger" },
  invoicePaid: { icon: ReceiptText, style: "bg-success/10 text-success" },
  invoiceVoided: { icon: ReceiptText, style: "bg-border/30 text-muted" },
  checkClosed: { icon: CreditCard, style: "bg-warning/10 text-warning" },
  adminInvited: { icon: UserCog, style: "bg-brand/10 text-brand" },
  adminRoleChanged: { icon: UserCog, style: "bg-brand/10 text-brand" },
  adminDisabled: { icon: UserCog, style: "bg-danger/10 text-danger" },
  adminEnabled: { icon: UserCog, style: "bg-success/10 text-success" },
  websitePublished: { icon: Globe, style: "bg-brand/10 text-brand" },
  websiteRestored: { icon: History, style: "bg-info/10 text-info" },
};

type AuditKind = "plan" | "period" | "kyc" | "billing" | "payments" | "admins" | "website";

/** The filter chip an entry belongs under. */
function kindOf(entry: AdminAuditEntry): AuditKind {
  switch (entry.action) {
    case "planChanged":
      return "plan";
    case "periodExtended":
      return "period";
    case "kycApproved":
    case "kycRejected":
      return "kyc";
    case "invoicePaid":
    case "invoiceVoided":
      return "billing";
    case "checkClosed":
      return "payments";
    case "adminInvited":
    case "adminRoleChanged":
    case "adminDisabled":
    case "adminEnabled":
      return "admins";
    case "websitePublished":
    case "websiteRestored":
      return "website";
  }
}

const KIND_LABEL: Record<AuditKind, string> = {
  plan: "auditFilterPlan",
  period: "auditFilterPeriod",
  kyc: "auditFilterKyc",
  billing: "auditFilterBilling",
  payments: "auditFilterPayments",
  admins: "auditFilterAdmins",
  website: "auditFilterWebsite",
};
const KINDS = Object.keys(KIND_LABEL) as AuditKind[];

export default function AdminAuditLogPage() {
  const t = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const locale = useLocale();
  const { auditLog } = useAdminData();
  const auditText = useAuditText();
  const timeAgo = useTimeAgo();

  const store = (entry: AdminAuditEntry) => (locale === "km" ? entry.storeNameKm : entry.storeNameEn);
  const actionLabel = (entry: AdminAuditEntry) => t(KIND_LABEL[kindOf(entry)]);

  const icon = (entry: AdminAuditEntry) => {
    const { icon: Icon, style } = ACTION_ICON[entry.action];
    return (
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", style)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  };

  const columns: DataGridColumn<AdminAuditEntry>[] = [
    {
      key: "change",
      header: t("colChange"),
      hideable: false,
      value: (entry) => auditText(entry),
      cell: (entry) => (
        <div className="flex items-center gap-3">
          {icon(entry)}
          <span>{auditText(entry)}</span>
        </div>
      ),
    },
    { key: "store", header: t("auditColSubject"), sortable: true, value: store, cell: store },
    { key: "type", header: t("colChangeType"), sortable: true, value: actionLabel, cell: actionLabel },
    {
      key: "when",
      header: t("colWhen"),
      align: "right",
      sortable: true,
      value: (entry) => entry.minutesAgo,
      exportValue: (entry) => timeAgo(entry.minutesAgo),
      cell: (entry) => <span className="text-muted">{timeAgo(entry.minutesAgo)}</span>,
    },
  ];

  return (
    <>
      <PageHeader title={tNav("auditLog")} description={t("auditDescription")} />
      <DataGrid
        rows={auditLog}
        getRowId={(entry) => entry.id}
        columns={columns}
        searchText={(entry) => `${entry.storeNameEn} ${entry.storeNameKm}`}
        searchPlaceholder={t("auditSearchPlaceholder")}
        chips={KINDS.map((kind) => ({
          value: kind,
          label: t(KIND_LABEL[kind]),
          predicate: (entry: AdminAuditEntry) => kindOf(entry) === kind,
        }))}
        initialSort={{ key: "when", direction: "asc" }}
        renderCard={(entry) => (
          <div className="flex items-center gap-3">
            {icon(entry)}
            <div className="min-w-0">
              <p className="text-sm">{auditText(entry)}</p>
              <p className="text-xs text-muted">{timeAgo(entry.minutesAgo)}</p>
            </div>
          </div>
        )}
        exportFileName="audit-log"
        storageKey="admin-audit-log"
        emptyTitle={t("noActivity")}
      />
    </>
  );
}
