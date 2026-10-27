"use client";

import { formatUsd } from "@khmio/shared";
import { Card, cn } from "@khmio/ui";
import { AlertTriangle, BadgeCheck, ChevronRight, Hourglass, KeyRound, PauseCircle, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { mockPaymentAttempts } from "@/mock/mock-admin-billing";
import { mockPlatformHealth } from "@/mock/mock-data";
import { useAdmin } from "../admin-context";
import { adminHref } from "./admin-nav";
import { formatSums, sumByCurrency } from "./money-ui";
import { PageHeader, SectionTitle, StatCard } from "./admin-ui";
import { useAdminData, useAuditText, useTimeAgo } from "./use-admin-data";

export default function AdminOverviewPage() {
  const t = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const locale = useLocale();
  const timeAgo = useTimeAgo();
  const { counts, paying, mrrUsdCents, auditLog } = useAdminData();
  const auditText = useAuditText();
  const { failedChecks } = useAdmin();
  const openChecks = failedChecks.filter((check) => check.status === "open").length;
  // A payment a later check confirmed counts as paid, the same as on the Buyer payments page.
  const confirmedOrders = new Set(failedChecks.filter((check) => check.status === "confirmed").map((check) => check.orderNumber));
  const paidToday = mockPaymentAttempts.filter((attempt) => attempt.status === "paid" || confirmedOrders.has(attempt.orderNumber));

  const healthItems = [
    { label: t("bakongToken"), value: t("bakongTokenValid", { count: mockPlatformHealth.bakongTokenDaysLeft }), ok: true },
    {
      label: t("paymentsToday"),
      value: t("paymentsTodayValue", { count: paidToday.length, total: formatSums(sumByCurrency(paidToday)) }),
      ok: true,
    },
    {
      label: t("failedChecks"),
      value: String(openChecks),
      ok: openChecks === 0,
    },
  ];

  // Everything that needs a human, linked to the page where it's handled.
  const attention = [
    { label: t("kpiKycPending"), count: counts.kycPending, href: adminHref(locale, "kyc"), tone: "warning" },
    { label: t("kpiOverdue"), count: counts.grace, href: `${adminHref(locale, "merchants")}?filter=grace`, tone: "warning" },
    { label: t("kpiPaused"), count: counts.paused, href: `${adminHref(locale, "merchants")}?filter=paused`, tone: "danger" },
    {
      label: t("failedChecks"),
      count: openChecks,
      href: adminHref(locale, "failed-checks"),
      tone: "danger",
    },
  ].filter((item) => item.count > 0);

  return (
    <>
      <PageHeader title={tNav("overview")} description={t("overviewDescription")} />

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("overviewTitle")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={Wallet} label={t("kpiMrr")} value={formatUsd(mrrUsdCents)} />
          <StatCard icon={BadgeCheck} label={t("kpiPaying")} value={String(paying.length)} />
          <StatCard icon={Hourglass} label={t("kpiTrialing")} value={String(counts.trialing)} />
          <StatCard
            icon={AlertTriangle}
            label={t("kpiOverdue")}
            value={String(counts.grace)}
            tone={counts.grace ? "warning" : "muted"}
          />
          <StatCard
            icon={PauseCircle}
            label={t("kpiPaused")}
            value={String(counts.paused)}
            tone={counts.paused ? "danger" : "muted"}
          />
          <StatCard
            icon={KeyRound}
            label={t("kpiKycPending")}
            value={String(counts.kycPending)}
            tone={counts.kycPending ? "warning" : "muted"}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("healthTitle")}</SectionTitle>
        <Card className="grid gap-4 p-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
          {healthItems.map((item) => (
            <div key={item.label} className="flex items-start gap-3 sm:px-4 sm:first:pl-0 sm:last:pr-0">
              <span
                className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", item.ok ? "bg-success" : "bg-danger")}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs text-muted">{item.label}</p>
                <p className={cn("font-semibold tabular-nums", !item.ok && "text-danger")}>{item.value}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <SectionTitle>{t("attentionTitle")}</SectionTitle>
          <Card className="p-0">
            {attention.length === 0 ? (
              <p className="p-4 text-sm text-muted">{t("attentionNone")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {attention.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="flex min-h-touch items-center gap-3 px-4 py-3 text-sm hover:bg-border/10">
                      <span
                        className={cn(
                          "flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold",
                          item.tone === "danger" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning",
                        )}
                      >
                        {item.count}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle
            aside={
              <Link href={adminHref(locale, "audit-log")} className="-my-3 flex min-h-touch items-center text-sm font-medium text-brand">
                {t("viewAll")}
              </Link>
            }
          >
            {t("activityTitle")}
          </SectionTitle>
          <Card className="p-0">
            {auditLog.length === 0 ? (
              <p className="p-4 text-sm text-muted">{t("noActivity")}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {auditLog.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">{auditText(entry)}</span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(entry.minutesAgo)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
