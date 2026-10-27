"use client";

import { BILLING_PERIOD_DAYS, formatKhr, formatUsd, GRACE_PERIOD_DAYS, INVOICE_LEAD_DAYS, PLAN_ORDER, PLANS, PLAN_FEATURES } from "@khmio/shared";
import { Card } from "@khmio/ui";
import { Check, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePlanFeatureLabels } from "@/components/plan-features";
import { PageHeader } from "../admin-ui";


// The plans (design/screens.md A4), read-only: everything comes from
// packages/shared plans.ts — the same rules the API enforces — so this page
// can't drift from what the system really does.
export default function AdminPlansPage() {
  const t = useTranslations("Admin");
  const tPlans = useTranslations("Plans");
  const tBilling = useTranslations("Billing");
  const featureLabels = usePlanFeatureLabels();
  const days = (count: number) => t("daysValue", { count });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("plansTitle")} description={t("plansDescription")} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3 font-medium" />
              {PLAN_ORDER.map((plan) => (
                <th key={plan} className="px-4 py-3 font-semibold text-fg">
                  {tPlans(plan)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-medium text-muted">{t("colPriceUsd")}</th>
              {PLAN_ORDER.map((plan) => (
                <td key={plan} className="px-4 py-3 tabular-nums">
                  {formatUsd(PLANS[plan].monthlyPrice.usdCents)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-medium text-muted">{t("colPriceKhr")}</th>
              {PLAN_ORDER.map((plan) => (
                <td key={plan} className="px-4 py-3 tabular-nums">
                  {formatKhr(PLANS[plan].monthlyPrice.khr)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-medium text-muted">{t("colProductLimit")}</th>
              {PLAN_ORDER.map((plan) => (
                <td key={plan} className="px-4 py-3 tabular-nums">
                  {PLANS[plan].maxProducts ?? t("unlimited")}
                </td>
              ))}
            </tr>
            {PLAN_FEATURES.map((feature) => (
              <tr key={feature} className="border-b border-border last:border-0">
                <th className="px-4 py-3 font-medium text-muted">{featureLabels[feature]}</th>
                {PLAN_ORDER.map((plan) => (
                  <td key={plan} className="px-4 py-3">
                    {PLANS[plan].features[feature] ? (
                      <Check className="h-4 w-4 text-success" aria-label={featureLabels[feature]} />
                    ) : (
                      <Minus className="h-4 w-4 text-muted" aria-label={t("notIncluded")} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <h2 className="font-semibold">{t("billingRulesTitle")}</h2>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">{t("ruleTrialLength")}</dt>
          <dd className="tabular-nums">{days(PLANS.free.trialDays ?? 0)}</dd>
          <dt className="text-muted">{t("ruleBillingPeriod")}</dt>
          <dd className="tabular-nums">{days(BILLING_PERIOD_DAYS)}</dd>
          <dt className="text-muted">{t("ruleInvoiceLead")}</dt>
          <dd className="tabular-nums">{days(INVOICE_LEAD_DAYS)}</dd>
          <dt className="text-muted">{t("ruleGracePeriod")}</dt>
          <dd className="tabular-nums">{days(GRACE_PERIOD_DAYS)}</dd>
        </dl>
        <p className="text-xs text-muted">{t("plansSourceNote")}</p>
      </Card>
    </div>
  );
}
