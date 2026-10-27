"use client";

import { formatKhr, formatUsd, PLAN_FEATURES, PLAN_ORDER, PLANS, type PlanFeature, type PlanId, type SiteSectionOf } from "@khmio/shared";
import { Check, Minus } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "../Button";
import { cn } from "../cn";
import { SegmentedControl } from "../SegmentedControl";
import { pick, resolveSiteHref, SiteContainer, type SiteKitContext } from "./kit";

/** The plan cards' fixed words, from the translation files. */
export interface SitePlansLabels {
  names: Record<PlanId, string>;
  perMonth: string;
  usd: string;
  khr: string;
  productLimit: (count: number) => string;
  unlimitedProducts: string;
  trial: (days: number) => string;
  features: Record<PlanFeature, string>;
  highlight: string;
  included: string;
  notIncluded: string;
  /** The comparison table's headings. */
  compareTitle: string;
  compareFeature: string;
  comparePrice: string;
  compareProducts: string;
  compareTrial: string;
  unlimited: string;
  none: string;
  days: (count: number) => string;
}


/**
 * The Shop's plans. Prices, limits and features always come from plans.ts —
 * the content only names the section and picks the highlighted plan — so the
 * site can never show a price that billing doesn't charge.
 */
export function PlansSection({ section, ctx }: { section: SiteSectionOf<"plans">; ctx: SiteKitContext }) {
  const [currency, setCurrency] = useState<"USD" | "KHR">("USD");
  const labels = ctx.plans;
  if (!labels) return null;

  return (
    <section className="bg-bg py-12 sm:py-16">
      <SiteContainer className="flex flex-col gap-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className="text-2xl font-bold leading-normal sm:text-3xl sm:leading-normal">{pick(section.title, ctx.locale)}</h2>
          <SegmentedControl
            value={currency}
            onChange={(value) => setCurrency(value === "KHR" ? "KHR" : "USD")}
            options={[
              { value: "USD", label: labels.usd },
              { value: "KHR", label: labels.khr },
            ]}
          />
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const highlighted = id === section.highlight;
            const price = currency === "USD" ? formatUsd(plan.monthlyPrice.usdCents) : formatKhr(plan.monthlyPrice.khr);
            return (
              <li
                key={id}
                className={cn("flex flex-col gap-4 rounded-2xl border bg-bg p-5 shadow-card", highlighted ? "border-2 border-brand" : "border-border")}
              >
                <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold">{labels.names[id]}</h3>
                  {highlighted && <span className="whitespace-nowrap rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-on-brand">{labels.highlight}</span>}
                </div>
                <p className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">{price}</span>
                  <span className="text-sm text-muted">{labels.perMonth}</span>
                </p>
                <ul className="flex flex-1 flex-col gap-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {plan.maxProducts === null ? labels.unlimitedProducts : labels.productLimit(plan.maxProducts)}
                  </li>
                  {plan.trialDays !== null && (
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      {labels.trial(plan.trialDays)}
                    </li>
                  )}
                  {PLAN_FEATURES.map((feature) => {
                    const has = plan.features[feature];
                    return (
                      <li key={feature} className={cn("flex items-start gap-2", !has && "text-muted")}>
                        {has ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        ) : (
                          <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {labels.features[feature]}
                          <span className="sr-only">: {has ? labels.included : labels.notIncluded}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <a href={ctx.href("/start")} className={buttonVariants({ variant: highlighted ? "primary" : "secondary", fullWidth: true })}>
                  {ctx.labels.startFree}
                </a>
              </li>
            );
          })}
        </ul>
        {section.compare && (
          // Cards on a phone; the cards and this table from tablet width. Same numbers, from plans.ts.
          <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{labels.compareTitle}</caption>
              <thead className="bg-canvas">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {labels.compareFeature}
                  </th>
                  {PLAN_ORDER.map((id) => (
                    <th key={id} scope="col" className={cn("px-4 py-3 font-semibold", id === section.highlight && "text-brand")}>
                      {labels.names[id]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium">
                    {labels.comparePrice}
                  </th>
                  {PLAN_ORDER.map((id) => (
                    <td key={id} className="px-4 py-3 tabular-nums">
                      {currency === "USD" ? formatUsd(PLANS[id].monthlyPrice.usdCents) : formatKhr(PLANS[id].monthlyPrice.khr)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium">
                    {labels.compareProducts}
                  </th>
                  {PLAN_ORDER.map((id) => (
                    <td key={id} className="px-4 py-3 tabular-nums">
                      {PLANS[id].maxProducts === null ? labels.unlimited : PLANS[id].maxProducts}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium">
                    {labels.compareTrial}
                  </th>
                  {PLAN_ORDER.map((id) => {
                    const days = PLANS[id].trialDays;
                    return (
                      <td key={id} className="px-4 py-3">
                        {days === null ? <span className="text-muted">{labels.none}</span> : labels.days(days)}
                      </td>
                    );
                  })}
                </tr>
                {PLAN_FEATURES.map((feature) => (
                  <tr key={feature}>
                    <th scope="row" className="px-4 py-3 font-medium">
                      {labels.features[feature]}
                    </th>
                    {PLAN_ORDER.map((id) => (
                      <td key={id} className="px-4 py-3">
                        {PLANS[id].features[feature] ? (
                          <Check className="h-4 w-4 text-success" role="img" aria-label={labels.included} />
                        ) : (
                          <Minus className="h-4 w-4 text-muted" role="img" aria-label={labels.notIncluded} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {section.link && (
          <a href={resolveSiteHref(section.link.href, ctx)} className="flex min-h-touch items-center justify-center font-semibold text-brand underline underline-offset-4">
            {pick(section.link.label, ctx.locale)}
          </a>
        )}
      </SiteContainer>
    </section>
  );
}
