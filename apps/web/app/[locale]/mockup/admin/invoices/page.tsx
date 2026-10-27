"use client";

import {
  getInvoiceView,
  invoiceManualPaymentSchema,
  invoiceReasonSchema,
  invoiceVoidSchema,
  PLAN_ORDER,
  toFieldErrors,
  type FormErrorCode,
  type InvoiceView,
} from "@khmio/shared";
import { BottomSheet, Button, Input } from "@khmio/ui";
import { AlertTriangle, ChevronRight, CircleCheck, Clock, ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { useFormErrorText } from "@/components/form-ui";
import { PageHeader, Pill, StatCard } from "../admin-ui";
import { DetailList, formatSums, INVOICE_VIEW_STYLES, money, shortRef, sumByCurrency } from "../money-ui";
import { useAdminInvoices, useDaysAgo, useDueText, type InvoiceRow } from "../use-admin-money";

const VIEWS: InvoiceView[] = ["due", "overdue", "paid", "void"];
const VIEW_RANK: Record<InvoiceView, number> = { overdue: 0, due: 1, paid: 2, void: 3 };
/** "This month" on the paid total. */
const RECENT_DAYS = 30;

// useSearchParams needs a Suspense boundary for Next's static prerender.
export default function AdminInvoicesPage() {
  return (
    <Suspense fallback={null}>
      <Invoices />
    </Suspense>
  );
}

// Admin A7 (design/screens.md): what stores owe the platform. Invoices are
// paid by KHQR and confirmed automatically; "Mark as paid" is the by-hand
// exception, so it asks for the bank's reference and lands in the audit log.
function Invoices() {
  const t = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const tPlan = useTranslations("Plans");
  const locale = useLocale();
  const errorText = useFormErrorText();
  const { rows, markPaid, voidInvoice } = useAdminInvoices();
  const dueText = useDueText();
  const daysAgo = useDaysAgo();
  const initialSearch = useSearchParams().get("q") ?? "";

  const [openId, setOpenId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === openId);
  const [bankReference, setBankReference] = useState("");
  const [note, setNote] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});

  const storeName = (row: InvoiceRow) => (locale === "km" ? row.nameKm : row.nameEn);
  const viewLabel = (row: InvoiceRow) => t(`invView_${getInvoiceView(row)}`);

  function open(row: InvoiceRow) {
    setOpenId(row.id);
    setBankReference("");
    setNote("");
    setVoidReason("");
    setErrors({});
  }

  function handleMarkPaid(row: InvoiceRow) {
    const result = invoiceManualPaymentSchema.safeParse({ bankReference, note });
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    markPaid(row, result.data);
    setErrors({});
  }

  function handleVoid(row: InvoiceRow) {
    const result = invoiceVoidSchema.safeParse({ reason: voidReason });
    if (!result.success) {
      setErrors({ voidReason: toFieldErrors(result.error).reason });
      return;
    }
    voidInvoice(row, result.data);
    setErrors({});
  }

  /** When it's due, or when it was paid — whichever matters for this invoice. */
  function whenText(row: InvoiceRow): string {
    if (row.status === "open") return dueText(row.dueInDays);
    if (row.status === "paid") return t("invPaidWhen", { when: daysAgo(row.paidDaysAgo ?? 0) });
    return t("invView_void");
  }

  /** How it was paid: the KHQR payment Bakong confirmed, or the bank reference an admin typed in. */
  function referenceText(row: InvoiceRow, full = false): string {
    if (row.manualPayment) return t("invRefManual", { ref: row.manualPayment.bankReference });
    if (row.paymentRef) return `KHQR · ${full ? row.paymentRef : shortRef(row.paymentRef)}`;
    return "—";
  }

  const open_ = rows.filter((row) => row.status === "open");
  const overdue = open_.filter((row) => getInvoiceView(row) === "overdue");
  const paidRecently = rows.filter((row) => row.status === "paid" && (row.paidDaysAgo ?? 0) <= RECENT_DAYS);

  const columns: DataGridColumn<InvoiceRow>[] = [
    {
      key: "invoice",
      header: t("invColInvoice"),
      hideable: false,
      sortable: true,
      value: (row) => row.createdDaysAgo,
      exportValue: (row) => row.number,
      cell: (row) => (
        <div>
          <p className="font-medium tabular-nums">{row.number}</p>
          <p className="text-xs text-muted">{daysAgo(row.createdDaysAgo)}</p>
        </div>
      ),
    },
    {
      key: "store",
      header: t("colStore"),
      sortable: true,
      value: storeName,
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="truncate">{storeName(row)}</span>
          {row.isDemo && <Pill className="bg-brand/10 text-brand">{t("demoTag")}</Pill>}
        </span>
      ),
    },
    {
      key: "for",
      header: t("invColFor"),
      value: (row) => `${tPlan(row.plan)} ${t(`invReason_${row.reason}`)}`,
      cell: (row) => (
        <div>
          <p>{tPlan(row.plan)}</p>
          <p className="text-xs text-muted">{t(`invReason_${row.reason}`)}</p>
        </div>
      ),
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
    {
      key: "status",
      header: t("colStatus"),
      sortable: true,
      value: (row) => VIEW_RANK[getInvoiceView(row)],
      exportValue: viewLabel,
      cell: (row) => <Pill className={INVOICE_VIEW_STYLES[getInvoiceView(row)]}>{viewLabel(row)}</Pill>,
    },
    { key: "when", header: t("invColWhen"), value: whenText, cell: (row) => <span className="text-muted">{whenText(row)}</span> },
    {
      key: "reference",
      header: t("invColReference"),
      value: (row) => referenceText(row, true),
      cell: (row) => <span className="tabular-nums text-muted">{referenceText(row)}</span>,
    },
    {
      key: "actions",
      header: t("invView"),
      align: "right",
      hideable: false,
      cell: () => (
        <span className="inline-flex items-center gap-1 font-medium text-brand">
          {t("invView")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      ),
    },
  ];

  const selectedView = selected ? getInvoiceView(selected) : null;

  return (
    <>
      <PageHeader title={tNav("invoices")} description={tNav("invoicesDescription")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ReceiptText} label={t("invStatOpen")} value={formatSums(sumByCurrency(open_))} />
        <StatCard icon={Clock} label={t("invStatOpenCount")} value={String(open_.length)} tone="muted" />
        <StatCard icon={AlertTriangle} label={t("invStatOverdue")} value={String(overdue.length)} tone={overdue.length ? "danger" : "muted"} />
        <StatCard icon={CircleCheck} label={t("invStatPaid")} value={formatSums(sumByCurrency(paidRecently))} />
      </div>

      <DataGrid
        rows={rows}
        getRowId={(row) => row.id}
        columns={columns}
        searchText={(row) => [row.number, row.nameKm, row.nameEn, row.paymentRef ?? "", row.manualPayment?.bankReference ?? ""].join(" ")}
        searchPlaceholder={t("invSearchPlaceholder")}
        initialSearch={initialSearch}
        chips={VIEWS.map((view) => ({
          value: view,
          label: t(`invView_${view}`),
          predicate: (row: InvoiceRow) => getInvoiceView(row) === view,
        }))}
        filters={[
          {
            key: "currency",
            label: t("invColCurrency"),
            options: [
              { value: "USD", label: "USD" },
              { value: "KHR", label: "KHR" },
            ],
            predicate: (row, value) => row.currency === value,
          },
          {
            key: "plan",
            label: t("colPlan"),
            options: PLAN_ORDER.filter((plan) => plan !== "free").map((plan) => ({ value: plan, label: tPlan(plan) })),
            predicate: (row, value) => row.plan === value,
          },
          {
            key: "reason",
            label: t("invColFor"),
            options: invoiceReasonSchema.options.map((reason) => ({ value: reason, label: t(`invReason_${reason}`) })),
            predicate: (row, value) => row.reason === value,
          },
        ]}
        onRowClick={open}
        initialSort={{ key: "status", direction: "asc" }}
        renderCard={(row) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{storeName(row)}</p>
                <p className="truncate text-sm text-muted">
                  {row.number} · {tPlan(row.plan)} · {t(`invReason_${row.reason}`)}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{money(row.amountMinor, row.currency)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill className={INVOICE_VIEW_STYLES[getInvoiceView(row)]}>{viewLabel(row)}</Pill>
              <span className="text-sm text-muted">{whenText(row)}</span>
            </div>
          </div>
        )}
        exportFileName="invoices"
        storageKey="admin-invoices"
        emptyTitle={t("invEmpty")}
      />

      <BottomSheet
        open={selected !== undefined}
        onClose={() => setOpenId(null)}
        closeLabel={t("close")}
        title={selected?.number}
        placement="side"
      >
        {selected && selectedView && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Pill className={INVOICE_VIEW_STYLES[selectedView]}>{viewLabel(selected)}</Pill>
              <span className="text-lg font-bold tabular-nums">{money(selected.amountMinor, selected.currency)}</span>
            </div>

            <DetailList
              items={[
                { label: t("colStore"), value: storeName(selected) },
                { label: t("invColFor"), value: `${tPlan(selected.plan)} · ${t(`invReason_${selected.reason}`)}` },
                { label: t("invCreated"), value: daysAgo(selected.createdDaysAgo) },
                { label: t("invColWhen"), value: whenText(selected) },
              ]}
            />

            {selected.status === "paid" && (
              <div className="flex flex-col gap-1 rounded-DEFAULT border border-success/40 bg-success/5 p-3">
                <p className="font-medium">{selected.manualPayment ? t("invPaidByHand") : t("invPaidByKhqr")}</p>
                <p className="break-all tabular-nums text-muted">{referenceText(selected, true)}</p>
                {selected.manualPayment?.note && <p className="text-muted">{selected.manualPayment.note}</p>}
              </div>
            )}

            {selected.status === "void" && (
              <div className="flex flex-col gap-1 rounded-DEFAULT border border-border bg-border/10 p-3">
                <p className="font-medium">{t("invVoidedTitle")}</p>
                <p className="text-muted">{selected.voidReason}</p>
              </div>
            )}

            {selected.status === "open" && (
              <>
                <p className="rounded-DEFAULT bg-info/5 p-3 text-muted">{t("invAutoNote")}</p>

                <div className="flex flex-col gap-3 rounded-DEFAULT border border-border p-3">
                  <div>
                    <p className="font-medium">{t("invMarkPaidTitle")}</p>
                    <p className="text-muted">{t("invMarkPaidHelp")}</p>
                  </div>
                  <Input
                    label={t("invBankReference")}
                    placeholder="FT24273-00000"
                    value={bankReference}
                    onChange={(e) => {
                      setBankReference(e.target.value);
                      setErrors((prev) => ({ ...prev, bankReference: undefined }));
                    }}
                    error={errorText(errors.bankReference)}
                  />
                  <Input
                    label={t("invNote")}
                    maxLength={200}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      setErrors((prev) => ({ ...prev, note: undefined }));
                    }}
                    error={errorText(errors.note)}
                  />
                  <Button variant="primary" onClick={() => handleMarkPaid(selected)}>
                    {t("invMarkPaid")}
                  </Button>
                </div>

                {/* The demo store's invoices belong to its own dashboard; only the example stores' can be voided here. */}
                {!selected.isDemo && (
                  <div className="flex flex-col gap-3 rounded-DEFAULT border border-border p-3">
                    <div>
                      <p className="font-medium">{t("invVoidTitle")}</p>
                      <p className="text-muted">{t("invVoidHelp")}</p>
                    </div>
                    <Input
                      label={t("invVoidReason")}
                      maxLength={200}
                      value={voidReason}
                      onChange={(e) => {
                        setVoidReason(e.target.value);
                        setErrors((prev) => ({ ...prev, voidReason: undefined }));
                      }}
                      error={errorText(errors.voidReason)}
                    />
                    <Button variant="danger" onClick={() => handleVoid(selected)}>
                      {t("invVoid")}
                    </Button>
                  </div>
                )}

                <p className="text-xs text-muted">{t("invAuditNote")}</p>
              </>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
