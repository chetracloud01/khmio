"use client";

import {
  CUSTOM_FIELD_PRESETS,
  customFieldsSaveSchema,
  customFieldTargetSchema,
  customFieldTypeSchema,
  hasModule,
  MAX_CUSTOM_FIELDS,
  toFieldErrors,
  type CustomFieldTarget,
  type FormErrorCode,
} from "@khmio/shared";
import { Button, IconButton, Input, Notice, Select, Switch } from "@khmio/ui";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FormActions, focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import { nextDraftId } from "@/components/product-form/option-groups";
import { SubPage } from "@/components/seller-frame/sub-page";
import { api, ApiError, type CustomField, customFieldsAnswerSchema } from "@/lib/api";
import { useMerchant } from "../merchant-context";
import { PageLoading, PageOffline } from "../page-states";

// "My own fields" (Features › customFields): the details the shop's products
// need (warranty, material) and those of each item sold (an IMEI, a plate
// number). Saved all at once; values already filled in keep pointing at
// their field.
export default function CustomFieldsPage() {
  const t = useTranslations("CustomFields");
  const tFeatures = useTranslations("Features");
  const locale = useLocale();
  const { store } = useMerchant();
  const [saved, setSaved] = useState<CustomField[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    api("/custom-fields", customFieldsAnswerSchema).then((answer) => setSaved(answer.fields), () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (!hasModule(store.modules, "customFields")) {
    return (
      <SubPage title={t("title")}>
        <Notice tone="info">{t("moduleOff")}</Notice>
        <Link href={`/${locale}/m/features`} className="block self-start">
          <Button variant="secondary">{tFeatures("title")}</Button>
        </Link>
      </SubPage>
    );
  }
  if (failed) return <PageOffline onRetry={load} />;
  if (!saved) return <PageLoading />;
  return <FieldsEditor initial={saved} onSaved={setSaved} />;
}

function FieldsEditor({ initial, onSaved }: { initial: CustomField[]; onSaved: (fields: CustomField[]) => void }) {
  const t = useTranslations("CustomFields");
  const tApp = useTranslations("App");
  const tType = useTranslations("BusinessType");
  const errorText = useFormErrorText();
  const { store } = useMerchant();
  const [fields, setFields] = useState<CustomField[]>(initial);
  const [savedFields, setSavedFields] = useState<CustomField[]>(initial);
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(fields) !== JSON.stringify(savedFields);
  const update = (id: string, patch: Partial<CustomField>) => setFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  const presets = CUSTOM_FIELD_PRESETS[store.businessType].filter((preset) => !fields.some((field) => field.labelEn === preset.labelEn && field.target === preset.target));

  function add(target: CustomFieldTarget) {
    setFields((current) => [...current, { id: nextDraftId(), target, type: "text", labelKm: "", labelEn: "", options: [], required: false, public: target === "product" }]);
  }

  async function save() {
    setProblem(null);
    const body = { fields };
    const result = customFieldsSaveSchema.safeParse(body);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(document.body);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const answer = await api("/custom-fields", customFieldsAnswerSchema, { method: "PUT", body: result.data });
      setFields(answer.fields);
      setSavedFields(answer.fields);
      onSaved(answer.fields);
    } catch (failure) {
      setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SubPage title={t("title")} description={t("description")}>
      {presets.length > 0 && (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => setFields((current) => [...current, ...presets.map((preset) => ({ ...preset, id: nextDraftId() }))])}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {t("addUsual", { type: tType(store.businessType) })}
        </Button>
      )}

      {customFieldTargetSchema.options.map((target) => {
        const inTarget = fields.filter((field) => field.target === target);
        return (
          <section key={target} className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4 shadow-card">
            <div>
              <h2 className="font-semibold">{t(`${target}Title`)}</h2>
              <p className="text-sm text-muted">{t(`${target}Hint`)}</p>
            </div>
            {inTarget.map((field) => {
              const index = fields.indexOf(field);
              const key = (rest: string) => errorText(errors[`fields.${index}.${rest}`]);
              return (
                <div key={field.id} className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input label={t("labelKm")} value={field.labelKm} onChange={(event) => update(field.id, { labelKm: event.target.value })} error={key("label")} />
                    <Input label={t("labelEn")} value={field.labelEn} onChange={(event) => update(field.id, { labelEn: event.target.value })} />
                  </div>
                  <Select
                    label={t("typeLabel")}
                    value={field.type}
                    onChange={(event) => {
                      const parsed = customFieldTypeSchema.safeParse(event.target.value);
                      if (parsed.success) update(field.id, { type: parsed.data, options: parsed.data === "pick" && field.options.length === 0 ? [{ id: nextDraftId(), labelKm: "", labelEn: "" }] : field.options });
                    }}
                    options={customFieldTypeSchema.options.map((type) => ({ value: type, label: t(`type_${type}`) }))}
                  />
                  {field.type === "pick" && (
                    <div className="flex flex-col gap-2">
                      {field.options.map((option, optionIndex) => (
                        <div key={option.id} className="flex items-start gap-2">
                          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                            <Input
                              label={t("choiceKm")}
                              value={option.labelKm}
                              onChange={(event) => update(field.id, { options: field.options.map((entry) => (entry.id === option.id ? { ...entry, labelKm: event.target.value } : entry)) })}
                              error={key(`options.${optionIndex}.label`)}
                            />
                            <Input
                              label={t("choiceEn")}
                              value={option.labelEn}
                              onChange={(event) => update(field.id, { options: field.options.map((entry) => (entry.id === option.id ? { ...entry, labelEn: event.target.value } : entry)) })}
                            />
                          </div>
                          <IconButton icon={X} label={t("removeChoice")} disabled={field.options.length === 1} onClick={() => update(field.id, { options: field.options.filter((entry) => entry.id !== option.id) })} className="mt-6" />
                        </div>
                      ))}
                      <Button variant="ghost" className="self-start" onClick={() => update(field.id, { options: [...field.options, { id: nextDraftId(), labelKm: "", labelEn: "" }] })}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {t("addChoice")}
                      </Button>
                    </div>
                  )}
                  <Switch checked={field.required} onChange={(required) => update(field.id, { required })} label={t("requiredLabel")} />
                  {target === "product" && <Switch checked={field.public} onChange={(on) => update(field.id, { public: on })} label={t("publicLabel")} description={t("publicHint")} />}
                  <Button variant="ghost" tone="danger" className="self-start" onClick={() => setFields((current) => current.filter((entry) => entry.id !== field.id))}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {t("removeField")}
                  </Button>
                </div>
              );
            })}
            {inTarget.length < MAX_CUSTOM_FIELDS && (
              <Button variant="secondary" className="self-start" onClick={() => add(target)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("addField")}
              </Button>
            )}
          </section>
        );
      })}

      {problem && (
        <Notice tone="danger" role="alert">
          {problem}
        </Notice>
      )}
      <FormActions
        dirty={dirty && !saving}
        canCancel={!saving}
        onCancel={() => {
          setFields(savedFields);
          setErrors({});
        }}
        onSave={() => void save()}
        saveLabel={saving ? tApp("saving") : t("save")}
        cancelLabel={t("cancel")}
      />
    </SubPage>
  );
}
