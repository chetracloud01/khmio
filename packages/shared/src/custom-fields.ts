import { z } from "zod";
import type { BusinessType } from "./business";

// The shop's own fields (Features › "customFields", business-modules.ts):
// details its products need (warranty, material) and details of each item
// sold (the IMEI of the phone handed over). The seller defines them; the
// values are checked against those definitions by one schema built here,
// used by the screens and the API alike.

export const customFieldTargetSchema = z.enum([
  /** On the product, filled in on the product form. */
  "product",
  /** On each item sold, filled in on the order (online or at the counter). */
  "orderLine",
]);
export type CustomFieldTarget = z.infer<typeof customFieldTargetSchema>;

export const customFieldTypeSchema = z.enum(["text", "number", "date", "yesNo", "pick"]);
export type CustomFieldType = z.infer<typeof customFieldTypeSchema>;

/** Per target: enough for a phone shop or a pharmacy, few enough to fill in on a phone. */
export const MAX_CUSTOM_FIELDS = 10;
export const MAX_PICK_OPTIONS = 20;
export const MAX_CUSTOM_TEXT_LENGTH = 200;

const label = z.string().trim().max(40, "too_long");

export const customFieldDefinitionSchema = z
  .object({
    id: z.string().min(1),
    target: customFieldTargetSchema,
    type: customFieldTypeSchema,
    labelKm: label,
    labelEn: label,
    /** "pick" only: the choices, each with its own id. */
    options: z.array(z.object({ id: z.string().min(1), labelKm: label, labelEn: label })).max(MAX_PICK_OPTIONS, "too_long").default([]),
    required: z.boolean(),
    /** Product fields only: shown on the shop page. */
    public: z.boolean(),
  })
  .superRefine((field, ctx) => {
    if (!field.labelKm && !field.labelEn) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required", path: ["label"] });
    if (field.type === "pick" && field.options.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required", path: ["options"] });
    field.options.forEach((option, index) => {
      if (!option.labelKm && !option.labelEn) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "option_label_required", path: ["options", index, "label"] });
    });
  });
export type CustomFieldDefinition = z.infer<typeof customFieldDefinitionSchema>;

/** Saving the shop's fields: all of them at once, at most MAX_CUSTOM_FIELDS per target. */
export const customFieldsSaveSchema = z.object({
  fields: z
    .array(customFieldDefinitionSchema)
    .max(MAX_CUSTOM_FIELDS * customFieldTargetSchema.options.length, "too_long")
    .refine((fields) => customFieldTargetSchema.options.every((target) => fields.filter((field) => field.target === target).length <= MAX_CUSTOM_FIELDS), "too_long"),
});
export type CustomFieldsSave = z.infer<typeof customFieldsSaveSchema>;

export type CustomValue = string | number | boolean;
/** Values as a form or a request sends them, field id → value; checked by customValuesSchema. */
export const rawCustomValuesSchema = z.record(z.union([z.string(), z.number(), z.boolean()])).default({});

/** Filling in one item's own fields on an order (the seller). */
export const lineFieldsRequestSchema = z.object({ values: rawCustomValuesSchema });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** What one field accepts. Optional fields may be left out (an empty text is left out too). */
function valueSchema(field: Pick<CustomFieldDefinition, "type" | "options">): z.ZodType<CustomValue> {
  switch (field.type) {
    case "text":
      return z.string().trim().min(1, "required").max(MAX_CUSTOM_TEXT_LENGTH, "too_long");
    case "number":
      return z.number({ invalid_type_error: "number_invalid" }).finite("number_invalid");
    case "date":
      return z.string().regex(ISO_DATE, "date_invalid");
    case "yesNo":
      return z.boolean();
    case "pick":
      return z.string().refine((id) => field.options.some((option) => option.id === id), "choice_invalid");
  }
}

/**
 * The values one product or order line may hold, built from the shop's
 * definitions for that target: each field's own type; required ones must be
 * there; anything else (a field since removed) is dropped.
 */
export function customValuesSchema(fields: readonly Pick<CustomFieldDefinition, "id" | "type" | "options" | "required">[]) {
  const shape = Object.fromEntries(
    fields.map((field) => {
      const one = valueSchema(field);
      // A blank text box means "not filled in", never an empty value.
      const blankless = z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), field.required ? one : one.optional());
      return [field.id, blankless];
    }),
  );
  return z.object(shape).strip();
}

/** A value as a reader sees it: a date, yes/no and a pick turned into words. */
export function customValueText(
  field: Pick<CustomFieldDefinition, "type" | "options">,
  value: CustomValue,
  words: { yes: string; no: string; language: "km" | "en" },
): string {
  if (field.type === "yesNo") return value === true ? words.yes : words.no;
  if (field.type === "pick") {
    const option = field.options.find((entry) => entry.id === value);
    return option ? (words.language === "km" ? option.labelKm || option.labelEn : option.labelEn || option.labelKm) : "";
  }
  return String(value);
}

type Preset = Omit<CustomFieldDefinition, "id">;
const text = (target: CustomFieldTarget, labelKm: string, labelEn: string, publicField = target === "product"): Preset => ({
  target,
  type: "text",
  labelKm,
  labelEn,
  options: [],
  required: false,
  public: publicField,
});
const number = (target: CustomFieldTarget, labelKm: string, labelEn: string): Preset => ({ ...text(target, labelKm, labelEn), type: "number" });
const date = (target: CustomFieldTarget, labelKm: string, labelEn: string): Preset => ({ ...text(target, labelKm, labelEn), type: "date" });

/** "Add the usual fields": what each kind of business tends to need. The seller keeps, edits or removes them. */
export const CUSTOM_FIELD_PRESETS: Record<BusinessType, readonly Preset[]> = {
  shop: [number("product", "ការធានា (ខែ)", "Warranty (months)"), text("product", "សម្ភារៈ", "Material"), text("orderLine", "លេខ IMEI / Serial", "IMEI / serial number", false)],
  restaurant: [text("product", "គ្រឿងផ្សំដែលអាចប្រតិកម្ម", "Allergens")],
  service: [number("product", "រយៈពេល (នាទី)", "Duration (minutes)")],
  garage: [text("product", "លេខកូដគ្រឿងបន្លាស់", "Part number"), text("orderLine", "ស្លាកលេខរថយន្ត", "Plate number", false), number("orderLine", "គីឡូម៉ែត្រ", "Mileage (km)")],
  other: [date("product", "ថ្ងៃផុតកំណត់", "Expiry date")],
};
