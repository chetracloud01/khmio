"use client";

import { isNamedAuditAction } from "@khmio/shared";
import { useTranslations } from "next-intl";
import type { AdminAuditEntry } from "@/lib/admin-api";

export function useAuditText() {
  const t = useTranslations("AdminApp");
  const tPlans = useTranslations("Plans");
  function describe(entry: Pick<AdminAuditEntry, "action" | "after">): string {
    const after = entry.after ?? {};
    if (entry.action === "subscription.extended") return t("audit_extended", { count: Number(after.days ?? 0) });
    if (entry.action === "subscription.plan_changed") return t("audit_plan", { plan: typeof after.plan === "string" ? tPlans(after.plan) : "" });
    if (entry.action.startsWith("order.")) return t("audit_order", { action: entry.action.slice(6) });
    // Every named action has a sentence (messages.test.ts checks); one this screen doesn't know shows its code, so nothing is ever hidden.
    if (isNamedAuditAction(entry.action)) return t(`audit_${entry.action.replace(".", "_")}`);
    return entry.action;
  }
  return { describe };
}
