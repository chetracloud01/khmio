"use client";

import { customValueText, type CustomValue } from "@khmio/shared";
import { Input, Select, Switch } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import type { CustomField } from "@/lib/api";

/** A field's name in the reader's language. */
export function useFieldLabel() {
  const locale = useLocale();
  return (field: Pick<CustomField, "labelKm" | "labelEn">) => (locale === "km" ? field.labelKm || field.labelEn : field.labelEn || field.labelKm);
}

/**
 * One of the shop's own fields, as the right box for its type: text, a
 * number, a date, yes/no or a pick-list. The value comes and goes as the API
 * keeps it (undefined = not filled in).
 */
export function CustomFieldInput({ field, value, onChange, error }: { field: CustomField; value: CustomValue | undefined; onChange: (value: CustomValue | undefined) => void; error?: string }) {
  const t = useTranslations("CustomFields");
  const labelOf = useFieldLabel();
  const locale = useLocale();
  const label = field.required ? labelOf(field) : `${labelOf(field)} ${t("optional")}`;
  switch (field.type) {
    case "yesNo":
      return <Switch checked={value === true} onChange={(on) => onChange(on)} label={labelOf(field)} />;
    case "pick":
      return (
        <Select
          label={label}
          value={typeof value === "string" ? value : ""}
          placeholder={t("pickPlaceholder")}
          onChange={(event) => onChange(event.target.value || undefined)}
          options={field.options.map((option) => ({ value: option.id, label: locale === "km" ? option.labelKm || option.labelEn : option.labelEn || option.labelKm }))}
          error={error}
        />
      );
    case "number":
      return (
        <Input
          label={label}
          inputMode="decimal"
          value={value === undefined ? "" : String(value)}
          // Kept as typed ("1." on the way to "1.5"); valuesForSave turns it into a number.
          onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
          error={error}
        />
      );
    case "date":
      return <Input label={label} type="date" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || undefined)} error={error} />;
    case "text":
      return <Input label={label} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || undefined)} error={error} />;
  }
}

/** The values as the API takes them: a number field's text becomes a number (anything else is sent as typed and refused there). */
export function valuesForSave(fields: CustomField[], values: Record<string, CustomValue>): Record<string, CustomValue> {
  return Object.fromEntries(
    Object.entries(values).map(([id, value]) => {
      const field = fields.find((entry) => entry.id === id);
      const number = typeof value === "string" ? Number(value.trim()) : Number.NaN;
      return [id, field?.type === "number" && typeof value === "string" && value.trim() !== "" && Number.isFinite(number) ? number : value];
    }),
  );
}

/** The filled-in fields as "Name: value" lines (shop page, order page). Nothing when none are filled in. */
export function CustomValuesList({ fields, values, className }: { fields: CustomField[]; values: Record<string, CustomValue>; className?: string }) {
  const t = useTranslations("CustomFields");
  const labelOf = useFieldLabel();
  const locale = useLocale();
  const filled = fields.filter((field) => values[field.id] !== undefined && values[field.id] !== "");
  if (filled.length === 0) return null;
  return (
    <dl className={className ?? "flex flex-col gap-1 text-sm"}>
      {filled.map((field) => (
        <div key={field.id} className="flex flex-wrap gap-x-2">
          <dt className="text-muted">{labelOf(field)}:</dt>
          <dd className="font-medium">{customValueText(field, values[field.id] ?? "", { yes: t("yes"), no: t("no"), language: locale === "km" ? "km" : "en" })}</dd>
        </div>
      ))}
    </dl>
  );
}
