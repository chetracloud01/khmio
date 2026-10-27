"use client";

import { paymentAttemptStatusSchema, paymentProviderSchema, type PaymentAttemptStatus } from "@khmio/shared";
import { BottomSheet } from "@khmio/ui";
import { AlertTriangle, ChevronRight, CircleCheck, Hourglass, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import { mockPaymentAttempts, type MockPaymentAttempt } from "@/mock/mock-admin-billing";
import { useAdmin } from "../../admin-context";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { adminHref } from "../admin-nav";
import { PageHeader, Pill, StatCard } from "../admin-ui";
import { ATTEMPT_STATUS_STYLES, DetailList, formatSums, money, shortRef, sumByCurrency } from "../money-ui";
import { useTimeAgo } from "../use-admin-data";
import { useStoreNames } from "../use-admin-money";

type AttemptRow = MockPaymentAttempt & { needsLook: boolean };

// Admin A8 (design/screens.md): today's buyer payments across every store.
// Read-only on purpose — an attempt turns "paid" only when the provider
// confirms the exact amount, never from this screen.
export default function AdminPaymentsPage() {
  const t = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const locale = useLocale();
  const { failedChecks } = useAdmin();
  const storeName = useStoreNames();
  const timeAgo = useTimeAgo();
  const [openId, setOpenId] = useState<string | null>(null);

  // An attempt waiting on a failed check says so; one a later check confirmed shows as paid.
  const rows: AttemptRow[] = useMemo(
    () =>
      mockPaymentAttempts.map((attempt) => {
        const check = failedChecks.find((item) => item.orderNumber === attempt.orderNumber);
        const status: PaymentAttemptStatus = check?.status === "confirmed" ? "paid" : attempt.status;
        return { ...attempt, status, needsLook: check?.status === "open" };
      }),
    [failedChecks],
  );
  const selected = rows.find((row) => row.id === openId);

  const paid = rows.filter((row) => row.status === "paid");
  const pending = rows.filter((row) => row.status === "pending");
  const needingLook = rows.filter((row) => row.needsLook);

  const statusCell = (row: AttemptRow) => (
    <span className="flex flex-wrap items-center gap-1.5">
      <Pill className={ATTEMPT_STATUS_STYLES[row.status]}>{t(`payStatus_${row.status}`)}</Pill>
      {row.needsLook && <Pill className="bg-danger/10 text-danger">{t("payNeedsLook")}</Pill>}
    </span>
  );

  const columns: DataGridColumn<AttemptRow>[] = [
    {
      key: "when",
      header: t("colWhen"),
      sortable: true,
      value: (row) => row.minutesAgo,
      exportValue: (row) => timeAgo(row.minutesAgo),
      cell: (row) => <span className="text-muted">{timeAgo(row.minutesAgo)}</span>,
    },
    {
      key: "order",
      header: t("payColOrder"),
      hideable: false,
      sortable: true,
      value: (row) => row.orderNumber,
      cell: (row) => <span className="font-medium tabular-nums">{row.orderNumber}</span>,
    },
    { key: "store", header: t("colStore"), sortable: true, value: (row) => storeName(row.storeId), cell: (row) => storeName(row.storeId) },
    {
      key: "provider",
      header: t("payColProvider"),
      sortable: true,
      value: (row) => t(`provider_${row.provider}`),
      cell: (row) => t(`provider_${row.provider}`),
    },
    {
      key: "amount",
      header: t("invColAmount"),
      align: "right",
      sortable: true,
      // Sorts within a currency: riel and dollars aren't comparable numbers.
      value: (row) => row.amountMinor,
      exportValue: (row) => money(row.amountMinor, row.currency),
      cell: (row) => <span className="font-medium tabular-nums">{money(row.amountMinor, row.currency)}</span>,
    },
    { key: "status", header: t("colStatus"), sortable: true, value: (row) => t(`payStatus_${row.status}`), cell: statusCell },
    {
      key: "reference",
      header: t("invColReference"),
      defaultHidden: true,
      value: (row) => row.providerRef,
      cell: (row) => <span className="tabular-nums text-muted">{shortRef(row.providerRef)}</span>,
    },
  ];

  return (
    <>
      <PageHeader title={tNav("payments")} description={t("payDescription")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Wallet} label={t("payStatPaidTotal")} value={formatSums(sumByCurrency(paid))} />
        <StatCard icon={CircleCheck} label={t("payStatPaidCount")} value={String(paid.length)} />
        <StatCard icon={Hourglass} label={t("payStatPending")} value={String(pending.length)} tone="muted" />
        <StatCard
          icon={AlertTriangle}
          label={t("payStatNeedsLook")}
          value={String(needingLook.length)}
          tone={needingLook.length ? "danger" : "muted"}
        />
      </div>

      <DataGrid
        rows={rows}
        getRowId={(row) => row.id}
        columns={columns}
        searchText={(row) => `${row.orderNumber} ${storeName(row.storeId)} ${row.providerRef}`}
        searchPlaceholder={t("paySearchPlaceholder")}
        chips={[
          ...paymentAttemptStatusSchema.options.map((status) => ({
            value: status,
            label: t(`payStatus_${status}`),
            predicate: (row: AttemptRow) => row.status === status,
          })),
          { value: "needsLook", label: t("payNeedsLook"), predicate: (row: AttemptRow) => row.needsLook },
        ]}
        filters={[
          {
            key: "provider",
            label: t("payColProvider"),
            options: paymentProviderSchema.options.map((provider) => ({ value: provider, label: t(`provider_${provider}`) })),
            predicate: (row, value) => row.provider === value,
          },
          {
            key: "currency",
            label: t("invColCurrency"),
            options: [
              { value: "USD", label: "USD" },
              { value: "KHR", label: "KHR" },
            ],
            predicate: (row, value) => row.currency === value,
          },
        ]}
        onRowClick={(row) => setOpenId(row.id)}
        initialSort={{ key: "when", direction: "asc" }}
        renderCard={(row) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium tabular-nums">{row.orderNumber}</p>
                <p className="truncate text-sm text-muted">
                  {storeName(row.storeId)} · {t(`provider_${row.provider}`)}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{money(row.amountMinor, row.currency)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusCell(row)}
              <span className="text-sm text-muted">{timeAgo(row.minutesAgo)}</span>
            </div>
          </div>
        )}
        exportFileName="buyer-payments"
        storageKey="admin-payments"
        emptyTitle={t("payEmpty")}
      />

      <BottomSheet
        open={selected !== undefined}
        onClose={() => setOpenId(null)}
        closeLabel={t("close")}
        title={selected?.orderNumber}
        placement="side"
      >
        {selected && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {statusCell(selected)}
              <span className="text-lg font-bold tabular-nums">{money(selected.amountMinor, selected.currency)}</span>
            </div>
            <DetailList
              items={[
                { label: t("colStore"), value: storeName(selected.storeId) },
                { label: t("payColProvider"), value: t(`provider_${selected.provider}`) },
                { label: t("colWhen"), value: timeAgo(selected.minutesAgo) },
                { label: t("payChecks"), value: String(selected.checks) },
              ]}
            />
            <div>
              <p className="text-xs text-muted">{t("invColReference")}</p>
              <p className="break-all font-medium tabular-nums">{selected.providerRef}</p>
            </div>
            {selected.needsLook && (
              <Link
                href={adminHref(locale, "failed-checks")}
                className="flex min-h-touch items-center gap-3 rounded-DEFAULT border border-danger/40 bg-danger/5 p-3"
              >
                <span className="min-w-0 flex-1 font-medium">{t("payNeedsLookLink")}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            )}
            <p className="text-xs text-muted">{t("payReadOnlyNote")}</p>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
