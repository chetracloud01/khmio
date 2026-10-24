"use client";

import {
  BILLING_PERIOD_DAYS,
  formatKhr,
  formatUsd,
  GRACE_PERIOD_DAYS,
  INVOICE_LEAD_DAYS,
  PLAN_ORDER,
  PLANS,
  planHasFeature,
  PLAN_FEATURES,
} from "@khmio/shared";
import { Card } from "@khmio/ui";
import { Check, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePlanFeatureLabels } from "@/components/plan-features";
import { PageHeader, SectionTitle } from "../admin-ui";


// Read-only on purpose: packages/shared/src/plans.ts is the single source of
// truth for prices and features, so this page can never disagree with what
// the dashboard, API and storefront enforce.
export default function AdminPlansPage() {
  const t = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const tPlan = useTranslations("Plans");
  const tBilling = useTranslations("Billing");
  const featureLabels = usePlanFeatureLabels();

  const included = (yes: boolean, label: string) =>
    yes ? (
      <Check className="h-4 w-4 text-success" aria-label={label} />
    ) : (
      <Minus className="h-4 w-4 text-muted" aria-label={t("notIncluded")} />
    );

  return (
    <>
      <PageHeader title={tNav("plans")} description={t("plansDescription")} />

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("plansTitle")}</SectionTitle>
        <Card className="hidden overflow-x-auto p-0 lg:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t("colPlan")}</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">{t("colPriceUsd")}</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">{t("colPriceKhr")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colProductLimit")}</th>
                {PLAN_FEATURES.map((feature) => (
                  <th key={feature} scope="col" className="px-4 py-2 text-center font-medium">
                    {featureLabels[feature]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PLAN_ORDER.map((plan) => {
                const definition = PLANS[plan];
                return (
                  <tr key={plan}>
                    <td className="px-4 py-3 font-semibold">
                      {tPlan(plan)}
                      {definition.trialDays !== null && (
                        <span className="ml-2 text-xs font-normal text-muted">
                          {tBilling("trialLength", { count: definition.trialDays })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatUsd(definition.monthlyPrice.usdCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatKhr(definition.monthlyPrice.khr)}</td>
                    <td className="px-4 py-3">
                      {definition.maxProducts === null ? t("unlimited") : definition.maxProducts}
                    </td>
                    {PLAN_FEATURES.map((feature) => (
                      <td key={feature} className="px-4 py-3">
                        <span className="flex justify-center">
                          {included(planHasFeature(plan, feature), featureLabels[feature])}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
          {PLAN_ORDER.map((plan) => {
            const definition = PLANS[plan];
            return (
              <Card key={plan} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold">{tPlan(plan)}</p>
                  <p className="text-right text-sm tabular-nums">
                    {formatUsd(definition.monthlyPrice.usdCents)} · {formatKhr(definition.monthlyPrice.khr)}
                  </p>
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  <li className="flex justify-between gap-2">
                    <span className="text-muted">{t("colProductLimit")}</span>
                    <span>{definition.maxProducts === null ? t("unlimited") : definition.maxProducts}</span>
                  </li>
                  {PLAN_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center justify-between gap-2">
                      <span className="text-muted">{featureLabels[feature]}</span>
                      {included(planHasFeature(plan, feature), featureLabels[feature])}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("billingRulesTitle")}</SectionTitle>
        <Card className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">{t("ruleBillingPeriod")}</p>
            <p className="font-semibold">{t("daysValue", { count: BILLING_PERIOD_DAYS })}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("ruleGracePeriod")}</p>
            <p className="font-semibold">{t("daysValue", { count: GRACE_PERIOD_DAYS })}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{t("ruleInvoiceLead")}</p>
            <p className="font-semibold">{t("daysValue", { count: INVOICE_LEAD_DAYS })}</p>
          </div>
        </Card>
        <p className="text-xs text-muted">{t("plansSourceNote")}</p>
      </section>
    </>
  );
}
