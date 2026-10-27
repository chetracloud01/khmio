"use client";

import type { CustomValue, FormErrorCode } from "@khmio/shared";
import { Button, Notice } from "@khmio/ui";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CustomFieldInput, CustomValuesList, valuesForSave } from "@/components/custom-fields/custom-field-input";
import { useFormErrorText } from "@/components/form-ui";
import { api, ApiError, type CustomField, type SellerOrderDetail, sellerOrderDetailSchema } from "@/lib/api";

/**
 * One item's own fields on the seller's order (Features › customFields,
 * target "orderLine"): the IMEI handed over, a car's plate. Shown filled in,
 * with Edit to change them; saved for that line only, checked by the API.
 */
export function LineFields({
  orderId,
  itemId,
  values,
  fields,
  onSaved,
}: {
  orderId: string;
  itemId: string;
  values: Record<string, CustomValue>;
  fields: CustomField[];
  onSaved: (order: SellerOrderDetail) => void;
}) {
  const t = useTranslations("CustomFields");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, CustomValue>>(values);
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      onSaved(await api(`/orders/${orderId}/items/${itemId}/fields`, sellerOrderDetailSchema, { method: "PUT", body: { values: valuesForSave(fields, draft) } }));
      setErrors({});
      setEditing(false);
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) setErrors(failure.fields);
      else setProblem(tApp("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <CustomValuesList fields={fields} values={values} className="flex flex-col gap-0.5 text-xs" />
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {t("editLineFields")}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
      {fields.map((field) => (
        <CustomFieldInput
          key={field.id}
          field={field}
          value={draft[field.id]}
          onChange={(value) =>
            setDraft((current) => {
              const next = { ...current };
              if (value === undefined) delete next[field.id];
              else next[field.id] = value;
              return next;
            })
          }
          error={errorText(errors[`customValues.${field.id}`])}
        />
      ))}
      {problem && (
        <Notice tone="danger" role="alert">
          {problem}
        </Notice>
      )}
      <div className="flex gap-2">
        <Button variant="primary" loading={saving} onClick={() => void save()}>
          {t("save")}
        </Button>
        <Button
          variant="secondary"
          disabled={saving}
          onClick={() => {
            setDraft(values);
            setErrors({});
            setEditing(false);
          }}
        >
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
