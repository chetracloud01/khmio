"use client";

import { formatKhr, formatUsd, getInvoiceView, getPlanPrice, PLAN_ORDER, type SubscriptionStatus } from "@khmio/shared";
import { BottomSheet, Button } from "@khmio/ui";
import { BadgeCheck, ChevronRight, CirclePause, Clock, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { adminHref } from "../admin-nav";
import { PageHeader, Pill, StatCard, STATUS_STYLES } from "../admin-ui";
import { INVOICE_VIEW_STYLES, money } from "../money-ui";
import { useAdminData, type AdminRow } from "../use-admin-data";
import { useAdminInvoices, useDueText, type InvoiceRow } from "../use-admin-money";

const STATUSES: SubscriptionStatus[] = ["trialing", "active", "grace", "paused"];
/** "Soon" = within the week an invoice is already out (INVOICE_LEAD_DAYS). */
const DUE_SOON_DAYS = 7;
const TRIAL_ENDING_DAYS = 3;

// Admin A7 (design/screens.md): every store's plan and where it is in its
// billing period, with the people to chase at the top.
export default function AdminSubscriptionsPage() {
  const t = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const tPlan = useTranslations("Plans");
  const tBilling = useTranslations("Billing");
  const locale = useLocale();
  const { rows, counts, paying, mrrUsdCents, storeName, applyOverride } = useAdminData();
  const { openInvoiceFor } = useAdminInvoices();
  const dueText = useDueText();
  const [managingId, setManagingId] = useState<string | null>(null);
  const managing = rows.find((row) => row.id === managingId);

  /** What happens next for the store, and when. */
  function periodText(row: AdminRow): string {
    if (row.status === "paused") return tBilling("status_paused");
    if (row.status === "trialing") return t("subTrialEnds", { count: row.daysLeft });
    if (row.status === "grace") return t("subPausesIn", { count: row.daysLeft });
    return t("subRenewsIn", { count: row.daysLeft });
  }

  function invoiceCell(invoice: InvoiceRow | undefined) {
    if (!invoice) return <span className="text-muted">—</span>;
    const view = getInvoiceView(invoice);
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="font-medium tabular-nums">
          {invoice.number} · {money(invoice.amountMinor, invoice.currency)}
        </span>
        <Pill className={INVOICE_VIEW_STYLES[view]}>{dueText(invoice.dueInDays)}</Pill>
      </div>
    );
  }

  const columns: DataGridColumn<AdminRow>[] = [
    {
      key: "store",
      header: t("colStore"),
      hideable: false,
      sortable: true,
      value: (row) => storeName(row),
      cell: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{storeName(row)}</span>
            {row.isDemo && <Pill className="bg-brand/10 text-brand">{t("demoTag")}</Pill>}
          </p>
          <p className="text-xs text-muted">{row.ownerName}</p>
        </div>
      ),
    },
    {
      key: "plan",
      header: t("colPlan"),
      sortable: true,
      value: (row) => PLAN_ORDER.indexOf(row.plan),
      exportValue: (row) => tPlan(row.plan),
      cell: (row) => (
        <div>
          <p className="font-medium">{tPlan(row.plan)}</p>
          {row.plan !== "free" && (
            <p className="text-xs tabular-nums text-muted">
              {t("subPerMonth", { usd: formatUsd(getPlanPrice(row.plan, "USD")), khr: formatKhr(getPlanPrice(row.plan, "KHR")) })}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: t("colStatus"),
      sortable: true,
      value: (row) => STATUSES.indexOf(row.status),
      exportValue: (row) => tBilling(`status_${row.status}`),
      cell: (row) => <Pill className={STATUS_STYLES[row.status]}>{tBilling(`status_${row.status}`)}</Pill>,
    },
    {
      key: "period",
      header: t("subColNext"),
      sortable: true,
      // Paused stores have no days left; they sort first, as the most urgent.
      value: (row) => (row.status === "paused" ? -1 : row.daysLeft),
      exportValue: periodText,
      cell: periodText,
    },
    {
      key: "invoice",
      header: t("subColInvoice"),
      value: (row) => openInvoiceFor(row.id)?.number ?? "",
      cell: (row) => invoiceCell(openInvoiceFor(row.id)),
    },
    {
      key: "actions",
      header: t("manage"),
      align: "right",
      hideable: false,
      cell: () => (
        <span className="inline-flex items-center gap-1 font-medium text-brand">
          {t("manage")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      ),
    },
  ];

  const managingInvoice = managing ? openInvoiceFor(managing.id) : undefined;

  return (
    <>
      <PageHeader title={tNav("subscriptions")} description={tNav("subscriptionsDescription")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Wallet} label={t("kpiMrr")} value={formatUsd(mrrUsdCents)} />
        <StatCard icon={BadgeCheck} label={t("kpiPaying")} value={String(paying.length)} />
        <StatCard icon={Clock} label={t("kpiOverdue")} value={String(counts.grace)} tone={counts.grace ? "warning" : "muted"} />
        <StatCard icon={CirclePause} label={t("kpiPaused")} value={String(counts.paused)} tone={counts.paused ? "danger" : "muted"} />
      </div>

      <DataGrid
        rows={rows}
        getRowId={(row) => row.id}
        columns={columns}
        searchText={(row) => [row.nameKm, row.nameEn, row.ownerName, row.telegramUsername].join(" ")}
        searchPlaceholder={t("searchPlaceholder")}
        chips={[
          { value: "dueSoon", label: t("subChipDueSoon"), predicate: (row) => row.status === "active" && row.daysLeft <= DUE_SOON_DAYS },
          { value: "overdue", label: tBilling("status_grace"), predicate: (row) => row.status === "grace" },
          { value: "paused", label: tBilling("status_paused"), predicate: (row) => row.status === "paused" },
          {
            value: "trialEnding",
            label: t("subChipTrialEnding"),
            predicate: (row) => row.status === "trialing" && row.daysLeft <= TRIAL_ENDING_DAYS,
          },
        ]}
        filters={[
          {
            key: "plan",
            label: t("colPlan"),
            options: PLAN_ORDER.map((plan) => ({ value: plan, label: tPlan(plan) })),
            predicate: (row, value) => row.plan === value,
          },
          {
            key: "status",
            label: t("colStatus"),
            options: STATUSES.map((status) => ({ value: status, label: tBilling(`status_${status}`) })),
            predicate: (row, value) => row.status === value,
          },
        ]}
        onRowClick={(row) => setManagingId(row.id)}
        initialSort={{ key: "period", direction: "asc" }}
        renderCard={(row) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{storeName(row)}</p>
                <p className="truncate text-sm text-muted">{periodText(row)}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold">{tPlan(row.plan)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {row.isDemo && <Pill className="bg-brand/10 text-brand">{t("demoTag")}</Pill>}
              <Pill className={STATUS_STYLES[row.status]}>{tBilling(`status_${row.status}`)}</Pill>
            </div>
            {openInvoiceFor(row.id) && <div className="text-sm">{invoiceCell(openInvoiceFor(row.id))}</div>}
          </div>
        )}
        exportFileName="subscriptions"
        storageKey="admin-subscriptions"
      />

      <BottomSheet
        open={managing !== undefined}
        onClose={() => setManagingId(null)}
        closeLabel={t("close")}
        title={managing ? storeName(managing) : undefined}
        placement="side"
      >
        {managing && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Pill className="bg-border/20 text-fg">{tPlan(managing.plan)}</Pill>
              <Pill className={STATUS_STYLES[managing.status]}>{tBilling(`status_${managing.status}`)}</Pill>
            </div>
            <p className="font-medium">{periodText(managing)}</p>

            {managingInvoice ? (
              <Link
                href={`${adminHref(locale, "invoices")}?q=${encodeURIComponent(managingInvoice.number)}`}
                className="flex min-h-touch items-center gap-3 rounded-DEFAULT border border-border p-3 hover:bg-border/10"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted">{t("subOpenInvoice")}</span>
                  {invoiceCell(managingInvoice)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            ) : (
              <p className="rounded-DEFAULT bg-border/10 p-3 text-muted">{t("subNoOpenInvoice")}</p>
            )}

            <div className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
              <p className="font-medium">{t("extendTitle")}</p>
              <div className="flex gap-2">
                {[7, 30].map((days) => (
                  <Button key={days} variant="secondary" onClick={() => applyOverride(managing, { kind: "extend", days })} className="w-full">
                    {t("extendBy", { count: days })}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted">{t("overrideNote")}</p>
            </div>

            <Link
              href={`${adminHref(locale, "invoices")}?q=${encodeURIComponent(storeName(managing))}`}
              className="flex min-h-touch items-center justify-between gap-2 font-medium text-brand"
            >
              {t("subAllInvoices")}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href={adminHref(locale, "merchants")} className="flex min-h-touch items-center justify-between gap-2 font-medium text-brand">
              {t("subChangePlanLink")}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
