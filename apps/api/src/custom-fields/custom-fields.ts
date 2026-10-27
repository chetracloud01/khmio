import { merchantActor, writeAudit, type Prisma, type Tx } from "@khmio/db";
import {
  customValuesSchema,
  hasModule,
  rawCustomValuesSchema,
  toFieldErrors,
  type CustomFieldDefinition,
  type CustomFieldsSave,
  type CustomFieldTarget,
  type CustomValue,
} from "@khmio/shared";
import { z } from "zod";
import { InvalidInputException } from "../errors";
import type { MerchantStore } from "../merchant/store.guard";

// The shop's own fields (Features › "customFields"; packages/shared
// custom-fields.ts): their definitions, and checking the values a product or
// an order line holds against them. Inside withContext (the seller) or
// withPublicStore (the shop page, which sees only the public product fields).

export const customFieldSelect = {
  id: true,
  target: true,
  type: true,
  labelKm: true,
  labelEn: true,
  options: true,
  required: true,
  public: true,
} satisfies Prisma.CustomFieldDefinitionSelect;
type CustomFieldRow = Prisma.CustomFieldDefinitionGetPayload<{ select: typeof customFieldSelect }>;

const pickOptionsSchema = z.array(z.object({ id: z.string(), labelKm: z.string(), labelEn: z.string() }));

/** A definition as it leaves the API, its pick-list read back through its schema. */
export function toCustomField(row: CustomFieldRow): CustomFieldDefinition {
  const options = pickOptionsSchema.safeParse(row.options);
  return { ...row, options: options.success ? options.data : [] };
}

/** Stored values read back as field id → value; anything unreadable is left out. */
export function readCustomValues(stored: Prisma.JsonValue): Record<string, CustomValue> {
  const parsed = rawCustomValuesSchema.safeParse(stored);
  return parsed.success ? parsed.data : {};
}

export async function readCustomFields(tx: Tx, target?: CustomFieldTarget): Promise<CustomFieldDefinition[]> {
  const rows = await tx.customFieldDefinition.findMany({ where: target ? { target } : {}, select: customFieldSelect, orderBy: [{ target: "asc" }, { sortOrder: "asc" }] });
  return rows.map(toCustomField);
}

/** Saves all of the shop's fields as the page sent them: known ids are kept (values point at them), new ones added, the rest removed. */
export async function saveCustomFields(tx: Tx, context: MerchantStore, input: CustomFieldsSave): Promise<CustomFieldDefinition[]> {
  const existing = new Set((await tx.customFieldDefinition.findMany({ select: { id: true } })).map((row) => row.id));
  const kept: string[] = [];
  for (const [sortOrder, field] of input.fields.entries()) {
    const data = {
      target: field.target,
      type: field.type,
      labelKm: field.labelKm || field.labelEn,
      labelEn: field.labelEn || field.labelKm,
      options: field.type === "pick" ? field.options : [],
      required: field.required,
      public: field.target === "product" && field.public,
      sortOrder,
    };
    const id = existing.has(field.id)
      ? (await tx.customFieldDefinition.update({ where: { id: field.id }, data, select: { id: true } })).id
      : (await tx.customFieldDefinition.create({ data: { storeId: context.storeId, ...data }, select: { id: true } })).id;
    kept.push(id);
  }
  await tx.customFieldDefinition.deleteMany({ where: { id: { notIn: kept } } });
  await writeAudit(tx, merchantActor(context), { action: "store.custom_fields_saved", entity: "store", entityId: context.storeId });
  return readCustomFields(tx);
}

/**
 * Checks values against the shop's fields for one target. Problems come back
 * under `customValues.<field id>`. Fields since removed are dropped.
 */
export function checkCustomValues(fields: CustomFieldDefinition[], values: Record<string, CustomValue>): Record<string, CustomValue> {
  const result = customValuesSchema(fields).safeParse(values);
  // Fields not filled in are left out, never saved as empty.
  if (result.success) return Object.fromEntries(Object.entries(result.data).flatMap(([id, value]) => (value === undefined ? [] : [[id, value]])));
  const errors = Object.fromEntries(Object.entries(toFieldErrors(result.error)).map(([key, code]) => [`customValues.${key}`, code]));
  throw new InvalidInputException(errors);
}

/** Whether the shop uses its own fields now (switched off, values are kept as they are). */
export async function customFieldsOn(tx: Tx, storeId: string): Promise<boolean> {
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { modules: true } });
  return hasModule(store.modules, "customFields");
}
