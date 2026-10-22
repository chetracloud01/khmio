"use client";

import { formatKhr, MAX_VAT_PERCENT, storeSettingsSchema, toFieldErrors, type FormErrorCode } from "@khmio/shared";
import { Card, Input, Notice, SegmentedControl, Switch } from "@khmio/ui";
import { ChevronRight, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormActions, FormSection, focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import { SELLER_FORM_BAR } from "@/components/seller-frame/seller-frame";
import { api, ApiError, type StoreSettingsResponse } from "@/lib/api";
import { useMerchant } from "../merchant-context";
import { PageLoading, PageOffline } from "../page-states";
import { SubPage } from "@/components/seller-frame/sub-page";

type Field = "defaultCurrency" | "usdToKhrRate" | "allowCod" | "vatPercent";

interface Draft {
  defaultCurrency: "USD" | "KHR";
  usdToKhrRate: string;
  allowCod: boolean;
  vatPercent: string;
}

function toDraft(settings: StoreSettingsResponse): Draft {
  return { defaultCurrency: settings.defaultCurrency, usdToKhrRate: String(settings.usdToKhrRate), allowCod: settings.allowCod, vatPercent: String(settings.vatPercent) };
}

/** Whole number typed in a box; blank or anything else → NaN for the schema to reject. */
function parseWholeNumber(text: string): number {
  const value = text.trim().replace(/,/g, "");
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

function toInput(draft: Draft) {
  return { defaultCurrency: draft.defaultCurrency, usdToKhrRate: parseWholeNumber(draft.usdToKhrRate), allowCod: draft.allowCod, vatPercent: parseWholeNumber(draft.vatPercent) };
}

export default function StoreSettingsPage() {
  const [settings, setSettings] = useState<StoreSettingsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    api<StoreSettingsResponse>("/store/settings").then(setSettings, () => setFailed(true));
  }, []);
  useEffect(load, [load]);
  if (failed) return <PageOffline onRetry={load} />;
  if (!settings) return <PageLoading />;
  return <SettingsForm initial={settings} />;
}

// The standard form over storeSettingsSchema — the same check PUT /store/settings
// runs, with the band the platform allows today. Everything here feeds the buyer's total.
function SettingsForm({ initial }: { initial: StoreSettingsResponse }) {
  const t = useTranslations("StoreSettings");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const locale = useLocale();
  const { refreshStore } = useMerchant();
  const formRef = useRef<HTMLDivElement>(null);
  const band = initial.rateBand;
  const schema = storeSettingsSchema(band).omit({ onlineStockLocation: true });

  const [saved, setSaved] = useState<Draft>(() => toDraft(initial));
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Partial<Record<Field, FormErrorCode>>>({});
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setJustSaved(false);
    setSaveError(null);
  }

  function checkField(field: Field) {
    const result = schema.safeParse(toInput(draft));
    setErrors((previous) => ({ ...previous, [field]: result.success ? undefined : toFieldErrors(result.error)[field] }));
  }

  async function handleSave() {
    const result = schema.safeParse(toInput(draft));
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(formRef.current);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const next = toDraft(await api<StoreSettingsResponse>("/store/settings", { method: "PUT", body: result.data }));
      setSaved(next);
      setDraft(next);
      setErrors({});
      setJustSaved(true);
      await refreshStore().catch(() => undefined);
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) {
        setErrors(failure.fields);
        focusFirstInvalidField(formRef.current);
      } else {
        setSaveError(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  const status = dirty ? t("unsavedChanges") : justSaved ? t("saved") : undefined;

  return (
    <SubPage ref={formRef} title={t("title")} description={t("description")}>

      <Card className="flex flex-col p-4">
        <FormSection stacked title={t("sectionCurrency")} description={t("sectionCurrencyHelp")}>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t("defaultCurrencyLabel")}</span>
            <SegmentedControl
              value={draft.defaultCurrency}
              onChange={(next) => update("defaultCurrency", next === "KHR" ? "KHR" : "USD")}
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
              onChange={(e) => update("usdToKhrRate", e.target.value)}
              onBlur={() => checkField("usdToKhrRate")}
              error={errorText(errors.usdToKhrRate)}
            />
            <p className="text-xs text-muted">{t("rateHint", { min: formatKhr(band.min), max: formatKhr(band.max) })}</p>
          </div>
        </FormSection>

        {/* Fees depend on where the buyer is, so they have their own page. */}
        <FormSection stacked title={t("sectionDelivery")} description={t("sectionDeliveryHelp")}>
          <Link href={`/${locale}/m/delivery`} className="flex min-h-touch items-center gap-3 rounded-DEFAULT border border-border p-3 hover:bg-border/10">
            <Truck className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm font-medium">{t("openDelivery")}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          </Link>
        </FormSection>

        <FormSection stacked title={t("sectionPayments")} description={t("sectionPaymentsHelp")}>
          <Switch checked={draft.allowCod} onChange={(allowCod) => update("allowCod", allowCod)} label={t("codLabel")} description={t("codHint")} />
          {!draft.allowCod && <Notice tone="warning">{tApp("codOffWarning")}</Notice>}
        </FormSection>

        <FormSection stacked title={t("sectionTax")} description={t("sectionTaxHelp")}>
          <Input
            label={t("vatLabel")}
            inputMode="numeric"
            value={draft.vatPercent}
            onChange={(e) => update("vatPercent", e.target.value)}
            onBlur={() => checkField("vatPercent")}
            error={errorText(errors.vatPercent)}
          />
          <p className="text-xs text-muted">{t("vatHint", { max: MAX_VAT_PERCENT })}</p>
        </FormSection>

        {saveError && (
          <Notice tone="danger" role="alert" className="mb-3">
            {saveError}
          </Notice>
        )}

        <FormActions
          dirty={dirty && !saving}
          onCancel={() => {
            setDraft(saved);
            setErrors({});
            setSaveError(null);
          }}
          onSave={() => void handleSave()}
          saveLabel={saving ? tApp("saving") : t("save")}
          cancelLabel={t("cancel")}
          status={status}
          className={SELLER_FORM_BAR}
        />
      </Card>
    </SubPage>
  );
}
