"use client";

import {
  canChangePlan,
  formatKhr,
  formatUsd,
  getAmountDueForPlanChange,
  getPlanPrice,
  isUpgrade,
  PLAN_ORDER,
  PLANS,
  planHasFeature,
  type Currency,
  PLAN_FEATURES,
  type PlanId,
} from "@khmio/shared";
import { BottomSheet, Button, Card, cn, SegmentedControl } from "@khmio/ui";
import { Check, Minus, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePlanFeatureLabels } from "@/components/plan-features";
import { useState } from "react";
import { useMerchantProducts } from "../../merchant-products-context";
import { useMerchantSubscription, type SubscriptionPreview } from "../../merchant-subscription-context";


const STATUS_STYLES = {
  trialing: "bg-brand/10 text-brand",
  active: "bg-success/10 text-success",
  grace: "bg-warning/10 text-warning",
  paused: "bg-danger/10 text-danger",
} as const;

function formatMoney(amount: number, currency: Currency): string {
  return currency === "USD" ? formatUsd(amount) : formatKhr(amount);
}

export default function DashboardBillingMockupPage() {
  const { hydrated: subscriptionReady } = useMerchantSubscription();
  const { hydrated: productsReady } = useMerchantProducts();
  return subscriptionReady && productsReady ? <Billing /> : null;
}

function Billing() {
  const t = useTranslations("Billing");
  const featureLabels = usePlanFeatureLabels();
  const tDates = useTranslations("Dates");
  const tPlan = useTranslations("Plans");
  const { subscription, setBillingCurrency, changePlan, cancelPendingDowngrade, payInvoice, preview } =
    useMerchantSubscription();
  const { products } = useMerchantProducts();
  const { plan, status, daysLeft, pendingPlan, billingCurrency: currency, invoices } = subscription;

  const [confirmPlan, setConfirmPlan] = useState<PlanId | null>(null);
  // "latest" = the newest open invoice, used right after a plan change creates one.
  const [payTarget, setPayTarget] = useState<string | "latest" | null>(null);

  const nextOpenInvoice = invoices.find((invoice) => invoice.status === "open");
  const payingInvoice =
    payTarget === "latest" ? nextOpenInvoice : invoices.find((invoice) => invoice.id === payTarget);

  const maxProducts = PLANS[plan].maxProducts;
  const previewValue: SubscriptionPreview = status === "trialing" ? "trial" : status;

  function statusLine() {
    if (status === "trialing") return t("statusLineTrial", { count: daysLeft });
    if (status === "active") return t("statusLineActive", { count: daysLeft });
    if (status === "grace") return t("statusLineGrace", { count: daysLeft });
    return t("statusLinePaused");
  }

  function actionLabel(target: PlanId) {
    if (target === plan) return t("currentPlan");
    if (target === pendingPlan) return t("scheduled");
    if (target === "free") return t("trialOnly");
    return plan === "free" || isUpgrade(plan, target) ? t("upgrade") : t("downgrade");
  }

  function handleConfirm() {
    if (!confirmPlan) return;
    const needsPayment = plan === "free" || isUpgrade(plan, confirmPlan);
    const due = getAmountDueForPlanChange(plan, confirmPlan, currency, daysLeft);
    changePlan(confirmPlan);
    setConfirmPlan(null);
    if (needsPayment && due > 0) setPayTarget("latest");
  }

  function handlePay() {
    if (payingInvoice) payInvoice(payingInvoice.id);
    setPayTarget(null);
  }

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-5 p-4 text-fg">
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted">{t("yourPlan")}</p>
            <p className="text-xl font-bold">{tPlan(plan)}</p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", STATUS_STYLES[status])}>
            {t(`status_${status}`)}
          </span>
        </div>
        <p className="text-sm text-muted">{statusLine()}</p>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span>{t("usageProducts")}</span>
            <span className="font-semibold">
              {maxProducts === null
                ? t("usageUnlimited", { count: products.length })
                : t("usageOf", { count: products.length, max: maxProducts })}
            </span>
          </div>
          {maxProducts !== null && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-border/30">
              <div
                className={cn("h-full rounded-full", products.length >= maxProducts ? "bg-danger" : "bg-brand")}
                style={{ width: `${Math.min(100, (products.length / maxProducts) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {pendingPlan && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-DEFAULT border border-dashed border-border p-3 text-sm">
            <span>{t("pendingDowngrade", { plan: tPlan(pendingPlan), count: daysLeft })}</span>
            <Button variant="secondary" onClick={cancelPendingDowngrade}>
              {t("keepCurrent")}
            </Button>
          </div>
        )}

        {nextOpenInvoice && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-DEFAULT bg-warning/10 p-3 text-sm">
            <span className="font-medium">
              {t("amountDue", { amount: formatMoney(nextOpenInvoice.amountMinor, nextOpenInvoice.currency) })}
            </span>
            <Button variant="primary" onClick={() => setPayTarget(nextOpenInvoice.id)}>
              {t("payNow")}
            </Button>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted">{t("choosePlan")}</h2>
        <SegmentedControl
          value={currency}
          onChange={(next) => setBillingCurrency(next === "KHR" ? "KHR" : "USD")}
          options={[
            { value: "USD", label: t("payInUsd") },
            { value: "KHR", label: t("payInKhr") },
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_ORDER.map((target) => {
          const isCurrent = target === plan;
          const definition = PLANS[target];
          const enabled = canChangePlan(plan, target) && target !== pendingPlan;
          return (
            <Card key={target} className={cn("flex flex-col gap-3", isCurrent && "border-brand ring-1 ring-brand")}>
              <div>
                <p className="font-semibold">{tPlan(target)}</p>
                <p className="text-2xl font-bold">
                  {formatMoney(getPlanPrice(target, currency), currency)}
                  {target !== "free" && <span className="text-sm font-normal text-muted"> {t("perMonth")}</span>}
                </p>
                {definition.trialDays !== null && (
                  <p className="text-xs text-muted">{t("trialLength", { count: definition.trialDays })}</p>
                )}
              </div>
              <ul className="flex flex-1 flex-col gap-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  {definition.maxProducts === null
                    ? t("featureUnlimitedProducts")
                    : t("featureProductLimit", { count: definition.maxProducts })}
                </li>
                {PLAN_FEATURES.map((feature) => {
                  const included = planHasFeature(target, feature);
                  return (
                    <li key={feature} className={cn("flex items-center gap-2", !included && "text-muted")}>
                      {included ? (
                        <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                      ) : (
                        <Minus className="h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      <span className={cn(!included && "line-through")}>{featureLabels[feature]}</span>
                    </li>
                  );
                })}
              </ul>
              <Button
                variant={enabled && (plan === "free" || isUpgrade(plan, target)) ? "primary" : "secondary"}
                disabled={!enabled}
                onClick={() => setConfirmPlan(target)}
                className="w-full"
              >
                {actionLabel(target)}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t("invoicesTitle")}</p>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted">{t("noInvoices")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {tPlan(invoice.plan)} · {t(`reason_${invoice.reason}`)}
                  </p>
                  <p className="text-xs text-muted">
                    {invoice.createdDaysAgo === 0 ? t("today") : tDates("daysAgo", { count: invoice.createdDaysAgo })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold">{formatMoney(invoice.amountMinor, invoice.currency)}</span>
                  {invoice.status === "paid" ? (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      {t("paid")}
                    </span>
                  ) : (
                    <Button variant="primary" onClick={() => setPayTarget(invoice.id)}>
                      {t("pay")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-2 rounded-DEFAULT border border-dashed border-border p-3">
        <p className="text-xs text-muted">{t("previewLabel")}</p>
        <SegmentedControl
          value={previewValue}
          onChange={(next) => preview(next as SubscriptionPreview)}
          className="flex-wrap"
          options={[
            { value: "trial", label: t("status_trialing") },
            { value: "active", label: t("status_active") },
            { value: "grace", label: t("status_grace") },
            { value: "paused", label: t("status_paused") },
          ]}
        />
      </div>

      <BottomSheet
        open={confirmPlan !== null}
        onClose={() => setConfirmPlan(null)}
        closeLabel={t("close")}
        title={confirmPlan ? t("confirmTitle", { plan: tPlan(confirmPlan) }) : undefined}
      >
        {confirmPlan && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {plan === "free"
                ? t("explainFromTrial", { plan: tPlan(confirmPlan) })
                : isUpgrade(plan, confirmPlan)
                  ? t("explainUpgrade", { plan: tPlan(confirmPlan), count: daysLeft })
                  : t("explainDowngrade", { current: tPlan(plan), plan: tPlan(confirmPlan), count: daysLeft })}
            </p>
            <div className="flex items-center justify-between rounded-DEFAULT bg-border/10 p-3">
              <span className="text-sm">{t("dueNow")}</span>
              <span className="text-lg font-bold">
                {formatMoney(getAmountDueForPlanChange(plan, confirmPlan, currency, daysLeft), currency)}
              </span>
            </div>
            <Button variant="primary" onClick={handleConfirm} className="w-full">
              {plan === "free" || isUpgrade(plan, confirmPlan) ? t("continueToPayment") : t("confirmDowngrade")}
            </Button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={payTarget !== null && payingInvoice !== undefined}
        onClose={() => setPayTarget(null)}
        closeLabel={t("close")}
        title={t("payTitle")}
      >
        {payingInvoice && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-3xl font-bold">{formatMoney(payingInvoice.amountMinor, payingInvoice.currency)}</p>
            <p className="text-sm text-muted">
              {tPlan(payingInvoice.plan)} · {t(`reason_${payingInvoice.reason}`)}
            </p>
            <div className="flex h-48 w-48 items-center justify-center rounded-DEFAULT border-2 border-dashed border-border bg-border/10">
              <QrCode className="h-32 w-32 text-fg" aria-hidden="true" />
            </div>
            <p className="text-xs text-muted">{t("payNote")}</p>
            <button
              type="button"
              onClick={handlePay}
              className="min-h-touch w-full rounded-DEFAULT border border-dashed border-border px-4 text-xs text-muted"
            >
              {t("simulatePayment")}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
