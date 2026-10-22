"use client";

import {
  formatKhr,
  MAX_VAT_PERCENT,
  planHasFeature,
  storeSettingsSchema,
  toFieldErrors,
  type FormErrorCode,
  type StoreSettings,
} from "@khmio/shared";
import { Card, Input, SegmentedControl, Select, Switch } from "@khmio/ui";
import { ChevronRight, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRef, useState } from "react";
import { FormActions, FormSection, focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import { useMerchantInventory } from "../../merchant-inventory-context";
import { useMerchantSubscription } from "../../merchant-subscription-context";
import { useStoreSettings } from "../../store-settings-context";

type Field = keyof StoreSettings;

interface Draft {
  defaultCurrency: "USD" | "KHR";
  usdToKhrRate: string;
  allowCod: boolean;
  vatPercent: string;
  /** "type::id", or "" for the default (main branch). */
  onlineStockKey: string;
}

const locationKey = (location: { type: string; id: string }) => `${location.type}::${location.id}`;

function toDraft(settings: StoreSettings): Draft {
  return {
    defaultCurrency: settings.defaultCurrency,
    usdToKhrRate: String(settings.usdToKhrRate),
    allowCod: settings.allowCod,
    vatPercent: String(settings.vatPercent),
    onlineStockKey: settings.onlineStockLocation ? locationKey(settings.onlineStockLocation) : "",
  };
}

function parseLocationKey(key: string) {
  const [type, id] = key.split("::");
  return type && id ? { type, id } : undefined;
}

/** Whole number typed in a box; blank or anything else → NaN for the schema to reject. */
function parseWholeNumber(text: string): number {
  const value = text.trim().replace(/,/g, "");
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

function toInput(draft: Draft) {
  return {
    defaultCurrency: draft.defaultCurrency,
    usdToKhrRate: parseWholeNumber(draft.usdToKhrRate),
    allowCod: draft.allowCod,
    vatPercent: parseWholeNumber(draft.vatPercent),
    onlineStockLocation: parseLocationKey(draft.onlineStockKey),
  };
}

export default function DashboardSettingsPage() {
  const { hydrated } = useStoreSettings();
  const { hydrated: subscriptionReady } = useMerchantSubscription();
  const { hydrated: inventoryReady } = useMerchantInventory();
  return hydrated && subscriptionReady && inventoryReady ? <SettingsForm /> : null;
}

// The standard form (../../form-ui.tsx) over storeSettingsSchema — the same
// check the API will run. Everything here feeds the buyer's total at checkout.
function SettingsForm() {
  const t = useTranslations("StoreSettings");
  const errorText = useFormErrorText();
  const tStock = useTranslations("Stock");
  const locale = useLocale();
  const { settings, saveSettings, band } = useStoreSettings();
  const { subscription } = useMerchantSubscription();
  const { warehouses, branches } = useMerchantInventory();
  // Choosing where online orders ship from only matters with several locations (Advance).
  const choosesStockLocation = planHasFeature(subscription.plan, "warehouses");
  const locationOptions = [
    ...branches.map((branch) => ({
      value: locationKey({ type: "branch", id: branch.id }),
      label: `${tStock("branchTag")}: ${locale === "km" ? branch.nameKm : branch.nameEn}`,
    })),
    ...warehouses.map((warehouse) => ({
      value: locationKey({ type: "warehouse", id: warehouse.id }),
      label: `${tStock("warehouseTag")}: ${locale === "km" ? warehouse.nameKm : warehouse.nameEn}`,
    })),
  ];
  const schema = storeSettingsSchema(band);
  const formRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [errors, setErrors] = useState<Partial<Record<Field, FormErrorCode>>>({});
  const [justSaved, setJustSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(settings));

  function update<K extends keyof Draft>(field: K, value: Draft[K], clears: Field) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [clears]: undefined }));
    setJustSaved(false);
  }

  function checkField(field: Field) {
    const result = schema.safeParse(toInput(draft));
    setErrors((prev) => ({ ...prev, [field]: result.success ? undefined : toFieldErrors(result.error)[field] }));
  }

  function handleSave() {
    const result = schema.safeParse(toInput(draft));
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(formRef.current);
      return;
    }
    saveSettings(result.data);
    setDraft(toDraft(result.data));
    setErrors({});
    setJustSaved(true);
  }

  const status = dirty ? t("unsavedChanges") : justSaved ? t("saved") : undefined;

  return (
    <div ref={formRef} className="mx-auto flex max-w-[720px] flex-col gap-5 p-4 text-fg md:p-6">
      <div>
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("description")}</p>
      </div>

      <Card className="flex flex-col p-4 md:p-6">
        <FormSection stacked title={t("sectionCurrency")} description={t("sectionCurrencyHelp")}>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t("defaultCurrencyLabel")}</span>
            <SegmentedControl
              value={draft.defaultCurrency}
              onChange={(next) => update("defaultCurrency", next === "KHR" ? "KHR" : "USD", "defaultCurrency")}
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
              value={draft.usdToKhrRate}
              onChange={(e) => update("usdToKhrRate", e.target.value, "usdToKhrRate")}
              onBlur={() => checkField("usdToKhrRate")}
              error={errorText(errors.usdToKhrRate)}
            />
            <p className="text-xs text-muted">{t("rateHint", { min: formatKhr(band.min), max: formatKhr(band.max) })}</p>
          </div>
        </FormSection>

        {/* Fees depend on where the buyer is, so they have their own page. */}
        <FormSection stacked title={t("sectionDelivery")} description={t("sectionDeliveryHelp")}>
          <Link
            href={`/${locale}/mockup/dashboard/delivery`}
            className="flex min-h-touch items-center gap-3 rounded-DEFAULT border border-border p-3 hover:bg-border/10"
          >
            <Truck className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm font-medium">{t("openDelivery")}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          </Link>
        </FormSection>

        <FormSection stacked title={t("sectionPayments")} description={t("sectionPaymentsHelp")}>
          <Switch checked={draft.allowCod} onChange={(allowCod) => update("allowCod", allowCod, "allowCod")} label={t("codLabel")} description={t("codHint")} />
        </FormSection>

        {choosesStockLocation && (
          <FormSection stacked title={t("sectionOnlineStock")} description={t("sectionOnlineStockHelp")}>
            <Select
              label={t("onlineStockLabel")}
              value={draft.onlineStockKey}
              onChange={(e) => update("onlineStockKey", e.target.value, "onlineStockLocation")}
              placeholder={t("onlineStockDefault")}
              options={locationOptions}
              error={errorText(errors.onlineStockLocation)}
            />
          </FormSection>
        )}

        <FormSection stacked title={t("sectionTax")} description={t("sectionTaxHelp")}>
          <Input
            label={t("vatLabel")}
            inputMode="numeric"
            value={draft.vatPercent}
            onChange={(e) => update("vatPercent", e.target.value, "vatPercent")}
            onBlur={() => checkField("vatPercent")}
            error={errorText(errors.vatPercent)}
          />
          <p className="text-xs text-muted">{t("vatHint", { max: MAX_VAT_PERCENT })}</p>
        </FormSection>

        <FormActions
          dirty={dirty}
          onCancel={() => {
            setDraft(toDraft(settings));
            setErrors({});
          }}
          onSave={handleSave}
          saveLabel={t("save")}
          cancelLabel={t("cancel")}
          status={status}
          className="bottom-above-nav -mb-4 rounded-b-DEFAULT md:bottom-0 md:-mb-6"
        />
      </Card>
    </div>
  );
}
