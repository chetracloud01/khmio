"use client";

import {
  adminCan,
  adminExtendSchema,
  adminPlanChangeSchema,
  BUSINESS_TYPES,
  PLAN_ORDER,
  toFieldErrors,
  type FormErrorCode,
  type SubscriptionStatus,
} from "@khmio/shared";
import { BottomSheet, Button, cn, DetailList, EmptyState, Input, Select } from "@khmio/ui";
import { ChevronRight, ExternalLink, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { useFormErrorText } from "@/components/form-ui";
import { adminMerchantDetailSchema, adminMerchantRowSchema, type AdminMerchantDetail, type AdminMerchantRow } from "@/lib/admin-api";
import { api, ApiError, apiSend } from "@/lib/api";
import { useDateText } from "@/components/use-date-text";
import { useAdminMe } from "../admin-context";
import { LoadState, PageHeader, Pill, STATUS_STYLES } from "../admin-ui";
import { useAuditText } from "../audit-text";
import { z } from "zod";

const STATUSES: SubscriptionStatus[] = ["trialing", "active", "grace", "paused"];
const DAY_MS = 24 * 60 * 60 * 1000;
/** A trial ending in the next 3 days — the same window as the menu's badge (GET /admin/badges). */
const endingSoon = (row: AdminMerchantRow) =>
  row.status === "trialing" && row.endsAt !== null && Date.parse(row.endsAt) >= Date.now() && Date.parse(row.endsAt) - Date.now() <= 3 * DAY_MS;

export default function MerchantsPage() {
  // useSearchParams (the ?status= filter) needs a Suspense boundary for Next's static build.
  return (
    <Suspense fallback={<LoadState failed={false} onRetry={() => undefined} />}>
      <Merchants />
    </Suspense>
  );
}

// Every shop on the platform (design/screens.md A2), in the shared data grid:
// search, status chips, plan and type filters, sorting, CSV export; a table
// on a laptop and cards on a phone. Open one to see its details and trail,
// and to extend its period or change its plan.
function Merchants() {
  const t = useTranslations("AdminApp");
  const tAdmin = useTranslations("Admin");
  const tPlans = useTranslations("Plans");
  const tType = useTranslations("BusinessType");
  const { date } = useDateText();
  const initialStatus = useSearchParams().get("status");
  const [rows, setRows] = useState<AdminMerchantRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    api("/admin/merchants", z.array(adminMerchantRowSchema)).then(setRows, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const statusLabel = (value: SubscriptionStatus | null) => (value ? t(`status_${value}`) : "—");
  const statusPill = (row: AdminMerchantRow) => (row.status ? <Pill className={STATUS_STYLES[row.status]}>{statusLabel(row.status)}</Pill> : "—");

  const columns: DataGridColumn<AdminMerchantRow>[] = [
    {
      key: "store",
      header: tAdmin("colStore"),
      hideable: false,
      sortable: true,
      value: (row) => row.name,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="truncate text-xs text-muted">/s/{row.slug}</p>
        </div>
      ),
    },
    {
      key: "owner",
      header: tAdmin("fieldOwner"),
      sortable: true,
      value: (row) => row.owner?.name ?? "",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{row.owner?.name ?? "—"}</p>
          {row.owner?.telegramUsername && <p className="truncate text-xs text-muted">@{row.owner.telegramUsername}</p>}
        </div>
      ),
    },
    { key: "type", header: tAdmin("colType"), sortable: true, defaultHidden: true, value: (row) => tType(row.businessType), cell: (row) => tType(row.businessType) },
    {
      key: "plan",
      header: tAdmin("colPlan"),
      sortable: true,
      value: (row) => (row.plan ? PLAN_ORDER.indexOf(row.plan) : -1),
      exportValue: (row) => (row.plan ? tPlans(row.plan) : ""),
      cell: (row) => <span className="font-medium">{row.plan ? tPlans(row.plan) : "—"}</span>,
    },
    { key: "status", header: tAdmin("colStatus"), sortable: true, value: (row) => statusLabel(row.status), cell: statusPill },
    {
      key: "ends",
      header: t("colEnds"),
      sortable: true,
      value: (row) => (row.endsAt ? Date.parse(row.endsAt) : 0),
      exportValue: (row) => date(row.endsAt),
      cell: (row) => <span className={cn("tabular-nums", endingSoon(row) && "font-medium text-warning")}>{date(row.endsAt)}</span>,
    },
    { key: "products", header: tAdmin("colProducts"), align: "right", sortable: true, value: (row) => row.products, cell: (row) => <span className="tabular-nums">{row.products}</span> },
    { key: "orders", header: t("colOrders"), align: "right", sortable: true, value: (row) => row.orders, cell: (row) => <span className="tabular-nums">{row.orders}</span> },
    {
      key: "joined",
      header: tAdmin("colJoined"),
      sortable: true,
      defaultHidden: true,
      value: (row) => Date.parse(row.createdAt),
      exportValue: (row) => date(row.createdAt),
      cell: (row) => <span className="tabular-nums">{date(row.createdAt)}</span>,
    },
    {
      key: "open",
      header: tAdmin("manage"),
      align: "right",
      hideable: false,
      cell: () => (
        <span className="inline-flex items-center gap-1 font-medium text-brand">
          {tAdmin("manage")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t("merchantsTitle")} description={t("merchantsDescription")} />
      {!rows ? (
        <LoadState failed={failed} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Store} title={t("merchantsEmpty")} body={t("merchantsEmptyBody")} />
      ) : (
        <DataGrid
          rows={rows}
          getRowId={(row) => row.id}
          columns={columns}
          searchText={(row) => `${row.name} ${row.slug} ${row.owner?.name ?? ""} ${row.owner?.telegramUsername ?? ""}`}
          searchPlaceholder={tAdmin("searchPlaceholder")}
          initialChip={STATUSES.find((value) => value === initialStatus) ?? (initialStatus === "endingSoon" ? "endingSoon" : "all")}
          chips={[
            ...STATUSES.map((status) => ({ value: status, label: statusLabel(status), predicate: (row: AdminMerchantRow) => row.status === status })),
            { value: "endingSoon", label: t("filterTrialsEnding"), predicate: endingSoon },
          ]}
          filters={[
            { key: "plan", label: tAdmin("colPlan"), options: PLAN_ORDER.map((plan) => ({ value: plan, label: tPlans(plan) })), predicate: (row, value) => row.plan === value },
            { key: "type", label: tAdmin("colType"), options: BUSINESS_TYPES.map((type) => ({ value: type, label: tType(type) })), predicate: (row, value) => row.businessType === value },
          ]}
          onRowClick={(row) => setOpenId(row.id)}
          initialSort={{ key: "joined", direction: "desc" }}
          renderCard={(row) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted">
                    {row.owner?.name ?? "—"} · {tType(row.businessType)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold">{row.plan ? tPlans(row.plan) : "—"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {statusPill(row)}
                <span className={cn("tabular-nums", endingSoon(row) && "font-medium text-warning")}>
                  {t("colEnds")}: {date(row.endsAt)}
                </span>
                <span className="tabular-nums">{t("ordersCount", { count: row.orders })}</span>
              </div>
            </div>
          )}
          exportFileName="merchants"
          storageKey="admin-live-merchants"
          emptyTitle={tAdmin("noMatches")}
        />
      )}

      {openId && <MerchantPanel storeId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </>
  );
}

function MerchantPanel({ storeId, onClose, onChanged }: { storeId: string; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations("AdminApp");
  const tAdmin = useTranslations("Admin");
  const tPlans = useTranslations("Plans");
  const tType = useTranslations("BusinessType");
  const locale = useLocale();
  const errorText = useFormErrorText();
  const me = useAdminMe();
  const { date, dateTime } = useDateText();
  const { describe } = useAuditText();
  // Owner and Support may extend and change plans; Finance only looks (packages/shared admin-roles.ts).
  const canManage = adminCan(me.role, "merchants_manage");
  const [detail, setDetail] = useState<AdminMerchantDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [days, setDays] = useState("14");
  const [plan, setPlan] = useState<"basic" | "pro" | "advance">("basic");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [busy, setBusy] = useState<"extend" | "plan" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    api(`/admin/merchants/${storeId}`, adminMerchantDetailSchema).then(setDetail, () => setFailed(true));
  }, [storeId]);
  useEffect(load, [load]);

  async function run(kind: "extend" | "plan") {
    const body = kind === "extend" ? { days: /^\d+$/.test(days.trim()) ? Number(days) : Number.NaN, note } : { plan, note };
    const parsed = kind === "extend" ? adminExtendSchema.safeParse(body) : adminPlanChangeSchema.safeParse(body);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(kind);
    setMessage(null);
    try {
      await apiSend(`/admin/merchants/${storeId}/${kind === "extend" ? "extend" : "plan"}`, { method: "POST", body: parsed.data });
      setMessage({ tone: "success", text: kind === "extend" ? t("extendDone", { count: Number(days) }) : t("planDone", { plan: tPlans(plan) }) });
      setNote("");
      load();
      onChanged();
    } catch (failure) {
      setMessage({ tone: "danger", text: failure instanceof ApiError && failure.code === "action_not_allowed" ? t("changedMeanwhile") : t("saveFailed") });
    } finally {
      setBusy(null);
    }
  }

  const sub = detail?.subscription;
  const owner = detail?.members.find((member) => member.role === "owner");
  return (
    <BottomSheet open onClose={onClose} closeLabel={tAdmin("close")} title={detail?.name ?? "…"} placement="side">
      {!detail ? (
        <LoadState failed={failed} onRetry={load} />
      ) : (
        <div className="flex flex-col gap-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {sub && <Pill className="bg-border/20 text-fg">{tPlans(sub.plan)}</Pill>}
            {sub && <Pill className={STATUS_STYLES[sub.status]}>{t(`status_${sub.status}`)}</Pill>}
            <Link href={`/${locale}/s/${detail.slug}`} target="_blank" className="ml-auto inline-flex min-h-touch items-center gap-1 font-medium text-brand">
              /s/{detail.slug}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <DetailList
            items={[
              { label: tAdmin("fieldOwner"), value: owner ? `${owner.name}${owner.telegramUsername ? ` · @${owner.telegramUsername}` : ""}` : "—" },
              { label: t("fieldType"), value: tType(detail.businessType) },
              { label: t("colEnds"), value: date(sub?.endsAt ?? null) },
              { label: tAdmin("colJoined"), value: date(detail.createdAt) },
              { label: tAdmin("colProducts"), value: String(detail.products) },
              { label: t("colOrders"), value: `${detail.orders} · ${t("lastOrder")}: ${date(detail.lastOrderAt)}` },
            ]}
          />

          {message && (
            <p role="status" className={cn("rounded-DEFAULT p-3", message.tone === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
              {message.text}
            </p>
          )}

          {canManage && sub && (
            <div className="flex flex-col gap-4 rounded-DEFAULT border border-border p-4">
              <p className="text-muted">{tAdmin("overrideNote")}</p>
              <Input
                label={t("noteLabel")}
                placeholder={t("notePlaceholder")}
                maxLength={200}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setErrors((previous) => ({ ...previous, note: undefined }));
                }}
                error={errorText(errors.note)}
              />
              <div className="flex flex-col gap-2">
                <Input
                  label={t("extendDays")}
                  inputMode="numeric"
                  value={days}
                  onChange={(e) => {
                    setDays(e.target.value);
                    setErrors((previous) => ({ ...previous, days: undefined }));
                  }}
                  error={errorText(errors.days)}
                />
                <p className="text-xs text-muted">{sub.status === "paused" || sub.status === "grace" ? t("extendReopens") : t("extendAdds")}</p>
                <Button variant="primary" loading={busy === "extend"} disabled={busy !== null} onClick={() => void run("extend")}>
                  {tAdmin("extendTitle")}
                </Button>
              </div>
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <Select
                  label={tAdmin("changePlan")}
                  value={plan}
                  onChange={(e) => setPlan(e.target.value === "pro" ? "pro" : e.target.value === "advance" ? "advance" : "basic")}
                  options={(["basic", "pro", "advance"] as const).map((value) => ({ value, label: tPlans(value) }))}
                />
                <p className="text-xs text-muted">{t("planHint")}</p>
                <Button variant="secondary" loading={busy === "plan"} disabled={busy !== null || sub.plan === plan} onClick={() => void run("plan")}>
                  {tAdmin("applyPlan")}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">{t("trail")}</h3>
            {detail.audit.length === 0 ? (
              <p className="text-muted">{tAdmin("noActivity")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {detail.audit.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap justify-between gap-x-3 py-2">
                    <span>
                      {describe(entry)}
                      {typeof entry.after?.note === "string" && <span className="block text-xs text-muted">“{entry.after.note}”</span>}
                    </span>
                    <span className="text-xs text-muted tabular-nums">{dateTime(entry.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
