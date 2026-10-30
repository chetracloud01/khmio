"use client";

import { getMinimumPlanFor, planHasFeature, type PlanFeature, type PlanId } from "@khmio/shared";
import { StatusPill } from "@khmio/ui";
import { Boxes, ChevronRight, ClipboardCheck, Coins, ReceiptText, ShoppingBag, Truck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** Every report, in the order a shop reads them: each one's address under /m/reports, icon, words (messages "Reports") and the plan feature it needs (null: every plan). */
const REPORTS = [
  { key: "sales", icon: ShoppingBag, feature: null },
  { key: "profit", icon: Coins, feature: "profitReport" },
  { key: "payables", icon: ReceiptText, feature: "stock" },
  { key: "stock", icon: Boxes, feature: "stock" },
  { key: "suppliers", icon: Truck, feature: "stock" },
  { key: "counts", icon: ClipboardCheck, feature: "stock" },
] as const satisfies readonly { key: string; icon: LucideIcon; feature: PlanFeature | null }[];

/**
 * The shop's reports (design/screens.md S17), each a link with the plan it
 * comes with when this shop's plan doesn't have it: as cards with what each
 * shows (the Reports page), or as one compact row (the dashboard).
 */
export function ReportLinks({ base, plan, variant = "cards" }: { /** "/km/m" */ base: string; plan: PlanId; variant?: "cards" | "compact" }) {
  const t = useTranslations("Reports");
  const tPlans = useTranslations("Plans");
  const reports = REPORTS.map((report) => ({ ...report, href: `${base}/reports/${report.key}`, lockedPlan: report.feature === null || planHasFeature(plan, report.feature) ? null : getMinimumPlanFor(report.feature) }));

  if (variant === "compact")
    return (
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <li key={report.key}>
              <Link href={report.href} className="flex h-full min-h-touch items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm font-medium shadow-card transition-colors hover:border-brand/40 hover:text-brand">
                <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{t(`report_${report.key}`)}</span>
                {report.lockedPlan && <StatusPill tone="muted">{tPlans(report.lockedPlan)}</StatusPill>}
              </Link>
            </li>
          );
        })}
      </ul>
    );

  return (
    <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {reports.map((report) => {
        const Icon = report.icon;
        return (
          <li key={report.key}>
            <Link
              href={report.href}
              className="group flex h-full min-h-touch flex-col gap-3 rounded-2xl border border-border bg-bg p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand" aria-hidden="true">
                  <Icon className="h-5 w-5" />
                </span>
                {report.lockedPlan && <StatusPill tone="muted">{tPlans(report.lockedPlan)}</StatusPill>}
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-semibold leading-normal">{t(`report_${report.key}`)}</span>
                <span className="text-sm text-muted">{t(`reportHint_${report.key}`)}</span>
              </span>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-brand">
                {t("open")}
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
