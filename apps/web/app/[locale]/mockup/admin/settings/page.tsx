"use client";

import {
  adminSettingsSchema,
  BILLING_PERIOD_DAYS,
  GRACE_PERIOD_DAYS,
  INVOICE_LEAD_DAYS,
  PLANS,
  type AdminSettings,
} from "@khmio/shared";
import { Card, Input } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "../../admin-context";
import { FormActions, FormSection, ReadOnlyField } from "@/components/form-ui";
import { PageHeader } from "../admin-ui";

type Field = keyof AdminSettings;
type Draft = Record<Field, string>;

function toDraft(settings: AdminSettings): Draft {
  return {
    platformName: settings.platformName,
    supportTelegram: settings.supportTelegram,
    usdToKhrMin: String(settings.usdToKhrMin),
    usdToKhrMax: String(settings.usdToKhrMax),
    alertChatId: settings.alertChatId,
  };
}

// The standard admin form: sections of fields, validated by the same Zod
// schema the API will use, saved from a sticky bar that's only active once
// something changed. Copy this shape for every new admin form.
export default function AdminSettingsPage() {
  const t = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const { settings, saveSettings } = useAdmin();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [justSaved, setJustSaved] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(settings));

  function update(field: Field, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setJustSaved(false);
  }

  function handleSave() {
    const result = adminSettingsSchema.safeParse({
      ...draft,
      usdToKhrMin: Number(draft.usdToKhrMin),
      usdToKhrMax: Number(draft.usdToKhrMax),
    });
    if (!result.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as Field;
        next[field] ??= t(`settingsError_${field}`);
      }
      setErrors(next);
      return;
    }
    saveSettings(result.data);
    setErrors({});
    setJustSaved(true);
  }

  function handleCancel() {
    setDraft(toDraft(settings));
    setErrors({});
  }

  const status = dirty ? t("unsavedChanges") : justSaved ? t("savedChanges") : undefined;

  return (
    <>
      <PageHeader title={tNav("settings")} description={t("settingsDescription")} />

      <Card className="flex flex-col p-4 md:p-6">
        <FormSection title={t("settingsGeneral")} description={t("settingsGeneralHelp")}>
          <Input
            label={t("settingsPlatformName")}
            value={draft.platformName}
            onChange={(e) => update("platformName", e.target.value)}
            error={errors.platformName}
          />
          <Input
            label={t("settingsSupportTelegram")}
            placeholder="@khmio_support"
            value={draft.supportTelegram}
            onChange={(e) => update("supportTelegram", e.target.value)}
            error={errors.supportTelegram}
          />
        </FormSection>

        <FormSection title={t("settingsCurrency")} description={t("settingsCurrencyHelp")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t("settingsRateMin")}
              inputMode="numeric"
              value={draft.usdToKhrMin}
              onChange={(e) => update("usdToKhrMin", e.target.value)}
              error={errors.usdToKhrMin}
            />
            <Input
              label={t("settingsRateMax")}
              inputMode="numeric"
              value={draft.usdToKhrMax}
              onChange={(e) => update("usdToKhrMax", e.target.value)}
              error={errors.usdToKhrMax}
            />
          </div>
        </FormSection>

        <FormSection title={t("settingsNotifications")} description={t("settingsNotificationsHelp")}>
          <Input
            label={t("settingsAlertChatId")}
            placeholder="-1001234567890"
            inputMode="numeric"
            value={draft.alertChatId}
            onChange={(e) => update("alertChatId", e.target.value)}
            error={errors.alertChatId}
          />
        </FormSection>

        <FormSection title={t("settingsBillingRules")} description={t("settingsBillingRulesHelp")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label={t("ruleTrialLength")} value={t("daysValue", { count: PLANS.free.trialDays ?? 0 })} />
            <ReadOnlyField label={t("ruleBillingPeriod")} value={t("daysValue", { count: BILLING_PERIOD_DAYS })} />
            <ReadOnlyField label={t("ruleGracePeriod")} value={t("daysValue", { count: GRACE_PERIOD_DAYS })} />
            <ReadOnlyField label={t("ruleInvoiceLead")} value={t("daysValue", { count: INVOICE_LEAD_DAYS })} />
          </div>
        </FormSection>

        <FormActions
          dirty={dirty}
          onCancel={handleCancel}
          onSave={handleSave}
          saveLabel={t("save")}
          cancelLabel={t("cancel")}
          status={status}
        />
      </Card>
    </>
  );
}
