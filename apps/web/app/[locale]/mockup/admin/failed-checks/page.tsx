"use client";

import { failedCheckCloseSchema, paymentCheckIssueSchema, toFieldErrors, type FormErrorCode } from "@khmio/shared";
import { BottomSheet, Button, Textarea } from "@khmio/ui";
import { CircleCheck, RefreshCw, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { MockFailedCheck } from "@/mock/mock-admin-billing";
import { useAdmin } from "../../admin-context";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { useFormErrorText } from "@/components/form-ui";
import { PageHeader, Pill } from "../admin-ui";
import { CHECK_STATUS_STYLES, DetailList, money } from "../money-ui";
import { useTimeAgo } from "../use-admin-data";
import { useStoreNames } from "../use-admin-money";

const STATUSES: MockFailedCheck["status"][] = ["open", "confirmed", "closed"];

// Admin A8 (design/screens.md): payment checks the worker couldn't settle by
// itself. The admin can ask the provider again or close the case with a note —
// never mark the payment paid, because only the provider's own answer counts
// (CLAUDE.md "Payment verification").
export default function AdminFailedChecksPage() {
  const t = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const errorText = useFormErrorText();
  const { failedChecks, recheckPayment, closeFailedCheck } = useAdmin();
  const storeName = useStoreNames();
  const timeAgo = useTimeAgo();

  const [openId, setOpenId] = useState<string | null>(null);
  const selected = failedChecks.find((check) => check.id === openId);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<FormErrorCode | undefined>();
  const [recheckResult, setRecheckResult] = useState<"confirmed" | "no_change" | null>(null);

  function open(check: MockFailedCheck) {
    setOpenId(check.id);
    setNote("");
    setNoteError(undefined);
    setRecheckResult(null);
  }

  function handleClose(check: MockFailedCheck) {
    const result = failedCheckCloseSchema.safeParse({ note });
    if (!result.success) {
      setNoteError(toFieldErrors(result.error).note);
      return;
    }
    closeFailedCheck(check.id, result.data);
  }

  /** "—" when the provider never answered. */
  const reportedText = (check: MockFailedCheck) =>
    check.reported ? money(check.reported.amountMinor, check.reported.currency) : t("chkNoAnswer");

  const statusPill = (check: MockFailedCheck) => <Pill className={CHECK_STATUS_STYLES[check.status]}>{t(`chkStatus_${check.status}`)}</Pill>;

  const columns: DataGridColumn<MockFailedCheck>[] = [
    {
      key: "order",
      header: t("payColOrder"),
      hideable: false,
      sortable: true,
      value: (check) => check.orderNumber,
      cell: (check) => (
        <div>
          <p className="font-medium tabular-nums">{check.orderNumber}</p>
          <p className="text-xs text-muted">{storeName(check.storeId)}</p>
        </div>
      ),
    },
    {
      key: "issue",
      header: t("chkColIssue"),
      sortable: true,
      value: (check) => t(`chkIssue_${check.issue}`),
      cell: (check) => t(`chkIssue_${check.issue}`),
    },
    {
      key: "expected",
      header: t("chkColExpected"),
      align: "right",
      value: (check) => money(check.expected.amountMinor, check.expected.currency),
      cell: (check) => <span className="font-medium tabular-nums">{money(check.expected.amountMinor, check.expected.currency)}</span>,
    },
    {
      key: "reported",
      header: t("chkColReported"),
      align: "right",
      value: reportedText,
      cell: (check) => <span className="tabular-nums">{reportedText(check)}</span>,
    },
    {
      key: "when",
      header: t("colWhen"),
      align: "right",
      sortable: true,
      value: (check) => check.minutesAgo,
      exportValue: (check) => timeAgo(check.minutesAgo),
      cell: (check) => <span className="text-muted">{timeAgo(check.minutesAgo)}</span>,
    },
    { key: "status", header: t("colStatus"), sortable: true, value: (check) => t(`chkStatus_${check.status}`), cell: statusPill },
  ];

  return (
    <>
      <PageHeader title={tNav("failedChecks")} description={t("chkDescription")} />

      <div className="flex items-start gap-3 rounded-DEFAULT border border-border bg-bg p-3 text-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <p className="text-muted">{t("chkRule")}</p>
      </div>

      <DataGrid
        rows={failedChecks}
        getRowId={(check) => check.id}
        columns={columns}
        searchText={(check) => `${check.orderNumber} ${storeName(check.storeId)} ${check.providerRef}`}
        searchPlaceholder={t("paySearchPlaceholder")}
        chips={STATUSES.map((status) => ({
          value: status,
          label: t(`chkStatus_${status}`),
          predicate: (check: MockFailedCheck) => check.status === status,
        }))}
        initialChip="open"
        filters={[
          {
            key: "issue",
            label: t("chkColIssue"),
            options: paymentCheckIssueSchema.options.map((issue) => ({ value: issue, label: t(`chkIssue_${issue}`) })),
            predicate: (check, value) => check.issue === value,
          },
        ]}
        onRowClick={open}
        initialSort={{ key: "when", direction: "asc" }}
        renderCard={(check) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium tabular-nums">{check.orderNumber}</p>
                <p className="truncate text-sm text-muted">
                  {storeName(check.storeId)} · {timeAgo(check.minutesAgo)}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{money(check.expected.amountMinor, check.expected.currency)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusPill(check)}
              <span className="text-sm">{t(`chkIssue_${check.issue}`)}</span>
            </div>
          </div>
        )}
        exportFileName="failed-checks"
        storageKey="admin-failed-checks"
        emptyTitle={t("chkEmpty")}
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
              {statusPill(selected)}
              <span className="font-medium">{t(`chkIssue_${selected.issue}`)}</span>
            </div>
            <p className="text-muted">{t(`chkExplain_${selected.issue}`)}</p>

            <DetailList
              items={[
                { label: t("colStore"), value: storeName(selected.storeId) },
                { label: t("payColProvider"), value: t(`provider_${selected.provider}`) },
                { label: t("chkColExpected"), value: money(selected.expected.amountMinor, selected.expected.currency) },
                { label: t("chkColReported"), value: reportedText(selected) },
                { label: t("colWhen"), value: timeAgo(selected.minutesAgo) },
                { label: t("payChecks"), value: String(selected.checks) },
              ]}
            />
            <div>
              <p className="text-xs text-muted">{t("invColReference")}</p>
              <p className="break-all font-medium tabular-nums">{selected.providerRef}</p>
            </div>

            {selected.status === "confirmed" && (
              <p role="status" className="flex items-start gap-2 rounded-DEFAULT border border-success/40 bg-success/5 p-3">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                {t("chkConfirmed")}
              </p>
            )}

            {selected.status === "closed" && (
              <div className="flex flex-col gap-1 rounded-DEFAULT border border-border bg-border/10 p-3">
                <p className="font-medium">{t("chkClosedTitle")}</p>
                <p className="text-muted">{selected.closeNote}</p>
              </div>
            )}

            {selected.status === "open" && (
              <>
                <div className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
                  <p className="text-muted">{t("chkRecheckHelp")}</p>
                  <Button variant="primary" onClick={() => setRecheckResult(recheckPayment(selected.id))}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    {t("chkRecheck")}
                  </Button>
                  {recheckResult === "no_change" && (
                    <p role="status" className="text-warning">
                      {t("chkNoChange")}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 rounded-DEFAULT border border-border p-3">
                  <div>
                    <p className="font-medium">{t("chkCloseTitle")}</p>
                    <p className="text-muted">{t("chkCloseHelp")}</p>
                  </div>
                  <Textarea
                    label={t("chkCloseNote")}
                    rows={3}
                    maxLength={300}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      setNoteError(undefined);
                    }}
                    error={errorText(noteError)}
                  />
                  <Button variant="secondary" onClick={() => handleClose(selected)}>
                    {t("chkClose")}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
