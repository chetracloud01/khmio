"use client";

import { adminCan, platformSettingsSaveSchema, toFieldErrors, type FormErrorCode } from "@khmio/shared";
import { Card, Input, Notice, Switch } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormActions, FormSection, focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import { adminSettingsSchema, type AdminSettings } from "@/lib/admin-api";
import { api, ApiError } from "@/lib/api";
import { useAdminMe } from "../admin-context";
import { LoadState, PageHeader } from "../admin-ui";

interface Draft {
  platformName: string;
  supportTelegram: string;
  usdToKhrMin: string;
  usdToKhrMax: string;
  alertChatId: string;
  betaAllBasic: boolean;
}

const toDraft = (settings: AdminSettings): Draft => ({ ...settings, usdToKhrMin: String(settings.usdToKhrMin), usdToKhrMax: String(settings.usdToKhrMax) });
const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : Number.NaN);
const toInput = (draft: Draft) => ({ ...draft, usdToKhrMin: whole(draft.usdToKhrMin), usdToKhrMax: whole(draft.usdToKhrMax) });

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    api("/admin/settings", adminSettingsSchema).then(setSettings, () => setFailed(true));
  }, []);
  useEffect(load, [load]);
  if (!settings) return <LoadState failed={failed} onRetry={load} />;
  return <SettingsForm initial={settings} />;
}

// Platform-wide settings (design/screens.md A6), the standard form over
// platformSettingsSaveSchema — the same check PUT /admin/settings runs.
// Only an owner may save (admin-roles.ts settings_manage); others read.
function SettingsForm({ initial }: { initial: AdminSettings }) {
  const t = useTranslations("AdminApp");
  const tAdmin = useTranslations("Admin");
  const errorText = useFormErrorText();
  const me = useAdminMe();
  const canSave = adminCan(me.role, "settings_manage");
  const formRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState<Draft>(() => toDraft(initial));
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, FormErrorCode>>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setStatus("idle");
  }

  async function save() {
    const result = platformSettingsSaveSchema.safeParse(toInput(draft));
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(formRef.current);
      return;
    }
    setStatus("saving");
    try {
      const next = toDraft(await api("/admin/settings", adminSettingsSchema, { method: "PUT", body: result.data }));
      setSaved(next);
      setDraft(next);
      setStatus("saved");
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) setErrors(failure.fields);
      setStatus("failed");
    }
  }

  return (
    <div ref={formRef} className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={t("settingsTitle")} description={tAdmin("settingsDescription")} />
      {!canSave && <p className="rounded-DEFAULT border border-border bg-border/10 p-3 text-sm text-muted">{t("settingsReadOnly")}</p>}
      {status === "failed" && (
        <Notice tone="danger" role="alert">
          {t("saveFailed")}
        </Notice>
      )}
      <Card className="flex flex-col p-4 md:p-6">
        <fieldset disabled={!canSave} className="contents">
          <FormSection title={tAdmin("settingsGeneral")} description={tAdmin("settingsGeneralHelp")}>
            <Input label={tAdmin("settingsPlatformName")} value={draft.platformName} onChange={(e) => update("platformName", e.target.value)} error={errorText(errors.platformName)} />
            <Input label={tAdmin("settingsSupportTelegram")} value={draft.supportTelegram} onChange={(e) => update("supportTelegram", e.target.value)} error={errorText(errors.supportTelegram)} />
          </FormSection>
          <FormSection title={tAdmin("settingsCurrency")} description={tAdmin("settingsCurrencyHelp")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label={tAdmin("settingsRateMin")} inputMode="numeric" value={draft.usdToKhrMin} onChange={(e) => update("usdToKhrMin", e.target.value)} error={errorText(errors.usdToKhrMin)} />
              <Input label={tAdmin("settingsRateMax")} inputMode="numeric" value={draft.usdToKhrMax} onChange={(e) => update("usdToKhrMax", e.target.value)} error={errorText(errors.usdToKhrMax)} />
            </div>
          </FormSection>
          <FormSection title={tAdmin("settingsNotifications")} description={t("alertsHelp")}>
            <Input label={tAdmin("settingsAlertChatId")} inputMode="numeric" value={draft.alertChatId} onChange={(e) => update("alertChatId", e.target.value)} error={errorText(errors.alertChatId)} />
          </FormSection>
          <FormSection title={t("betaTitle")} description={t("betaHelp")}>
            <Switch checked={draft.betaAllBasic} onChange={(value) => update("betaAllBasic", value)} label={t("betaLabel")} description={draft.betaAllBasic ? t("betaOn") : t("betaOff")} />
          </FormSection>
        </fieldset>
        {canSave && (
          <FormActions
            dirty={dirty && status !== "saving"}
            onCancel={() => {
              setDraft(saved);
              setErrors({});
            }}
            onSave={() => void save()}
            saveLabel={tAdmin("save")}
            cancelLabel={tAdmin("cancel")}
            status={dirty ? tAdmin("unsavedChanges") : status === "saved" ? tAdmin("savedChanges") : undefined}
          />
        )}
      </Card>
    </div>
  );
}
