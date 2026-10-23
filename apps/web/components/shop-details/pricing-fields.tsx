"use client";

import { formatKhr, MAX_VAT_PERCENT, parseKhrInput, type Currency, type ExchangeRateBand, type FormErrorCode } from "@khmio/shared";
import { Input, SegmentedControl } from "@khmio/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { FormSection, useFormErrorText } from "@/components/form-ui";

/** The "Prices & tax" boxes as typed: numbers stay text until Save checks them. */
export interface PricingDraft {
  defaultCurrency: Currency;
  usdToKhrRate: string;
  vatPercent: string;
}

export function toPricingDraft(saved: { defaultCurrency: Currency; usdToKhrRate: number; vatPercent: number }): PricingDraft {
  return { defaultCurrency: saved.defaultCurrency, usdToKhrRate: String(saved.usdToKhrRate), vatPercent: String(saved.vatPercent) };
}

/** Whole numbers for storeSettingsSchema; blank or anything else → NaN for it to refuse. */
export function toPricingInput(draft: PricingDraft) {
  return {
    defaultCurrency: draft.defaultCurrency,
    usdToKhrRate: parseKhrInput(draft.usdToKhrRate) ?? Number.NaN,
    vatPercent: parseKhrInput(draft.vatPercent) ?? Number.NaN,
  };
}

/**
 * Shop details' "Prices & tax" group (design/screens.md S10): the currency
 * buyers see first, the USD to KHR rate inside the band the platform allows,
 * and VAT. Everything here feeds the buyer's total at checkout. `children`
 * adds plan-only fields (online stock on Advance).
 */
export function PricingFields({
  values,
  band,
  errors,
  onChange,
  onCheck,
  children,
}: {
  values: PricingDraft;
  band: ExchangeRateBand;
  errors: Partial<Record<keyof PricingDraft, FormErrorCode>>;
  onChange: (patch: Partial<PricingDraft>) => void;
  onCheck: (field: keyof PricingDraft) => void;
  children?: ReactNode;
}) {
  const t = useTranslations("StoreSettings");
  const tProfile = useTranslations("DashboardProfile");
  const errorText = useFormErrorText();

  return (
    <FormSection id="prices" stacked title={tProfile("sectionPrices")} description={t("sectionCurrencyHelp")}>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg">{t("defaultCurrencyLabel")}</span>
        <SegmentedControl
          value={values.defaultCurrency}
          onChange={(next) => onChange({ defaultCurrency: next === "KHR" ? "KHR" : "USD" })}
          options={[
            { value: "USD", label: t("currencyUsd") },
            { value: "KHR", label: t("currencyKhr") },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Input
          label={t("rateLabel")}
          prefix="$1 ="
          inputMode="numeric"
          value={values.usdToKhrRate}
          onChange={(e) => onChange({ usdToKhrRate: e.target.value })}
          onBlur={() => onCheck("usdToKhrRate")}
          error={errorText(errors.usdToKhrRate)}
        />
        <p className="text-xs text-muted">{t("rateHint", { min: formatKhr(band.min), max: formatKhr(band.max) })}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Input
          label={t("vatLabel")}
          inputMode="numeric"
          value={values.vatPercent}
          onChange={(e) => onChange({ vatPercent: e.target.value })}
          onBlur={() => onCheck("vatPercent")}
          error={errorText(errors.vatPercent)}
        />
        <p className="text-xs text-muted">{t("vatHint", { max: MAX_VAT_PERCENT })}</p>
      </div>
      {children}
    </FormSection>
  );
}
