"use client";

import {
  BUSINESS_TYPES,
  kycStatusSchema,
  PLAN_ORDER,
  type PlanId,
  type SubscriptionStatus,
} from "@khmio/shared";
import { BottomSheet, Button, Select } from "@khmio/ui";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { adminHref } from "../admin-nav";
import { KYC_STYLES, PageHeader, Pill, STATUS_STYLES } from "../admin-ui";
import { useAdminData, type AdminRow } from "../use-admin-data";

const STATUSES: SubscriptionStatus[] = ["trialing", "active", "grace", "paused"];
const KYC_STATUSES = kycStatusSchema.options;
const CHIPS = [...STATUSES, "kycPending"] as const;
const PAID_PLANS = PLAN_ORDER.filter((plan) => plan !== "free");

// useSearchParams needs a Suspense boundary for Next's static prerender.
export default function AdminMerchantsPage() {
  return (
    <Suspense fallback={null}>
      <Merchants />
    </Suspense>
  );
}

function Merchants() {
  const t = useTranslations("Admin");
  const tDates = useTranslations("Dates");
  const tNav = useTranslations("AdminNav");
  const tPlan = useTranslations("Plans");
  const tType = useTranslations("BusinessType");
  const tBilling = useTranslations("Billing");
  const searchParams = useSearchParams();
  const locale = useLocale();
  const { rows, storeName, applyOverride } = useAdminData();

  const initialChip = CHIPS.find((value) => value === searchParams.get("filter")) ?? "all";
  const [managingId, setManagingId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("basic");
  const managing = rows.find((row) => row.id === managingId);

  function openManage(row: AdminRow) {
    setManagingId(row.id);
    setSelectedPlan(row.plan === "free" ? "basic" : row.plan);
  }

  function statusText(row: AdminRow) {
    if (row.status === "paused") return tBilling("status_paused");
    return `${tBilling(`status_${row.status}`)} · ${t("daysLeft", { count: row.daysLeft })}`;
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
          <p className="text-xs text-muted">
            {row.ownerName} · @{row.telegramUsername}
          </p>
        </div>
      ),
    },
    { key: "type", header: t("colType"), sortable: true, value: (row) => tType(row.businessType), cell: (row) => tType(row.businessType) },
    {
      key: "plan",
      header: t("colPlan"),
      sortable: true,
      value: (row) => PLAN_ORDER.indexOf(row.plan),
      exportValue: (row) => tPlan(row.plan),
      cell: (row) => <span className="font-medium">{tPlan(row.plan)}</span>,
    },
    {
      key: "status",
      header: t("colStatus"),
      sortable: true,
      value: (row) => tBilling(`status_${row.status}`),
      cell: (row) => <Pill className={STATUS_STYLES[row.status]}>{statusText(row)}</Pill>,
    },
    {
      key: "kyc",
      header: t("colKyc"),
      sortable: true,
      value: (row) => t(`kyc_${row.kycStatus}`),
      cell: (row) => <Pill className={KYC_STYLES[row.kycStatus]}>{t(`kyc_${row.kycStatus}`)}</Pill>,
    },
    {
      key: "products",
      header: t("colProducts"),
      align: "right",
      sortable: true,
      value: (row) => row.productCount,
      cell: (row) => row.productCount,
    },
    {
      key: "joined",
      header: t("colJoined"),
      align: "right",
      sortable: true,
      defaultHidden: true,
      value: (row) => row.joinedDaysAgo,
      exportValue: (row) => (row.joinedDaysAgo === 0 ? t("appliedToday") : tDates("daysAgo", { count: row.joinedDaysAgo })),
      cell: (row) => (row.joinedDaysAgo === 0 ? t("appliedToday") : tDates("daysAgo", { count: row.joinedDaysAgo })),
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

  return (
    <>
      <PageHeader title={tNav("merchants")} description={t("merchantsDescription")} />

      <DataGrid
        rows={rows}
        getRowId={(row) => row.id}
        columns={columns}
        searchText={(row) => [row.nameKm, row.nameEn, row.ownerName, row.telegramUsername].join(" ")}
        searchPlaceholder={t("searchPlaceholder")}
        initialChip={initialChip}
        chips={[
          ...STATUSES.map((status) => ({
            value: status,
            label: tBilling(`status_${status}`),
            predicate: (row: AdminRow) => row.status === status,
          })),
          { value: "kycPending", label: t("filterKycPending"), predicate: (row: AdminRow) => row.kycStatus === "pending" },
        ]}
        filters={[
          {
            key: "plan",
            label: t("colPlan"),
            options: PLAN_ORDER.map((plan) => ({ value: plan, label: tPlan(plan) })),
            predicate: (row, value) => row.plan === value,
          },
          {
            key: "type",
            label: t("colType"),
            options: BUSINESS_TYPES.map((type) => ({ value: type, label: tType(type) })),
            predicate: (row, value) => row.businessType === value,
          },
          {
            key: "kyc",
            label: t("colKyc"),
            options: KYC_STATUSES.map((status) => ({
              value: status,
              label: t(`kyc_${status}`),
            })),
            predicate: (row, value) => row.kycStatus === value,
          },
        ]}
        bulkActions={[
          {
            key: "extend",
            label: t("bulkExtend30"),
            run: (targets) => targets.forEach((row) => applyOverride(row, { kind: "extend", days: 30 })),
          },
        ]}
        onRowClick={openManage}
        renderCard={(row) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{storeName(row)}</p>
                <p className="truncate text-xs text-muted">
                  {tType(row.businessType)} · {row.ownerName}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold">{tPlan(row.plan)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {row.isDemo && <Pill className="bg-brand/10 text-brand">{t("demoTag")}</Pill>}
              <Pill className={STATUS_STYLES[row.status]}>{statusText(row)}</Pill>
              <Pill className={KYC_STYLES[row.kycStatus]}>{t(`kyc_${row.kycStatus}`)}</Pill>
            </div>
          </div>
        )}
        exportFileName="merchants"
        storageKey="admin-merchants"
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
              <Pill className={STATUS_STYLES[managing.status]}>{statusText(managing)}</Pill>
              <Pill className={KYC_STYLES[managing.kycStatus]}>{t(`kyc_${managing.kycStatus}`)}</Pill>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-DEFAULT bg-border/10 p-3">
              <div>
                <dt className="text-xs text-muted">{t("fieldOwner")}</dt>
                <dd className="font-medium">{managing.ownerName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("fieldTelegram")}</dt>
                <dd className="truncate font-medium">@{managing.telegramUsername}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("colType")}</dt>
                <dd className="font-medium">{tType(managing.businessType)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t("colProducts")}</dt>
                <dd className="font-medium tabular-nums">{managing.productCount}</dd>
              </div>
            </dl>

            {/* Decisions are made on the review page, next to the documents — never blind from here. */}
            {managing.kycStatus === "pending" && (
              <Link
                href={adminHref(locale, "kyc")}
                className="flex min-h-touch items-center gap-3 rounded-DEFAULT border border-warning/40 bg-warning/5 p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t("kycTitle")}</span>
                  <span className="block text-xs text-muted">{t("kycReviewHint")}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            )}

            <div className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
              <Select
                label={t("changePlan")}
                value={selectedPlan}
                onChange={(e) => {
                  const next = PAID_PLANS.find((plan) => plan === e.target.value);
                  if (next) setSelectedPlan(next);
                }}
                options={PAID_PLANS.map((plan) => ({ value: plan, label: tPlan(plan) }))}
              />
              <Button
                variant="primary"
                disabled={selectedPlan === managing.plan}
                onClick={() => applyOverride(managing, { kind: "setPlan", plan: selectedPlan })}
              >
                {t("applyPlan")}
              </Button>
            </div>

            <div className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
              <p className="font-medium">{t("extendTitle")}</p>
              <div className="flex gap-2">
                {[7, 30].map((days) => (
                  <Button
                    key={days}
                    variant="secondary"
                    onClick={() => applyOverride(managing, { kind: "extend", days })}
                    className="w-full"
                  >
                    {t("extendBy", { count: days })}
                  </Button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted">{t("overrideNote")}</p>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
