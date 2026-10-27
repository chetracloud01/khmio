"use client";

import type { PlanId } from "@khmio/shared";
import { Button, cn } from "@khmio/ui";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export interface UpgradePromptProps {
  title: string;
  /** Shown only in the full (non-compact) version. */
  body?: string;
  /** The cheapest plan that unlocks this — from getMinimumPlanFor(). */
  plan: PlanId;
  /** A one-line inline version for use inside a form. */
  compact?: boolean;
  className?: string;
  /** Plan & billing; without it, the plan is named but not linked. */
  href?: string;
}

/** Shown wherever a plan doesn't include a feature (packages/shared plans.ts). Links to Plan & billing when there is one. */
export function UpgradePrompt({ title, body, plan, compact = false, className, href }: UpgradePromptProps) {
  const t = useTranslations("Upgrade");
  const tPlan = useTranslations("Plans");
  const unlock = t("unlockWith", { plan: tPlan(plan) });

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-DEFAULT border border-dashed border-border p-3 text-sm",
          className,
        )}
      >
        <span className="flex items-center gap-2 text-muted">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          {title}
        </span>
        {href ? (
          <Link href={href} className="flex min-h-touch items-center font-medium text-brand">
            {unlock}
          </Link>
        ) : (
          <span className="font-medium text-brand">{unlock}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-DEFAULT border border-border bg-bg p-6 text-center shadow-sm",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
        <Lock className="h-6 w-6 text-brand" aria-hidden="true" />
      </span>
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-[360px] text-sm text-muted">{body}</p>}
      {href ? (
        <Link href={href}>
          <Button variant="primary">{unlock}</Button>
        </Link>
      ) : (
        <p className="text-sm font-semibold text-brand">{unlock}</p>
      )}
    </div>
  );
}
