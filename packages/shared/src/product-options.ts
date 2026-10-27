import { z } from "zod";

// Structured options (Features › "options" and "choices",
// business-modules.ts). Two kinds of group on a product:
// - variant groups (Size, Colour): every combination of one value per group
//   is a variant, with its own price, SKU and stock;
// - choice groups (Sugar, Add-ons): picked when ordering, "pick one" or
//   "pick any", each value with an optional extra price per unit.
// The product form, the shop page, the cart and the API all use these.

/** Size × Colour × Material at most: more makes a list nobody can scroll. */
export const MAX_VARIANT_GROUPS = 3;
export const MAX_CHOICE_GROUPS = 3;
export const MAX_VALUES_PER_GROUP = 20;
/** Longest note a buyer can add to one item ("no onions, extra spicy"). */
export const MAX_ITEM_NOTE_LENGTH = 120;

/** Cents or riel added to one unit. */
const extraAmount = z.number({ invalid_type_error: "price_invalid" }).int("price_invalid").min(0, "price_invalid").max(100_000_000, "price_invalid").optional();
const label = z.string().trim().max(40, "too_long");

/** A value either way needs a name in one language. */
function needsName(value: { labelKm: string; labelEn: string }, ctx: z.RefinementCtx) {
  if (!value.labelKm && !value.labelEn) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "option_label_required", path: ["label"] });
}

export const variantValueInputSchema = z.object({ id: z.string().min(1), labelKm: label, labelEn: label }).superRefine(needsName);
export const variantGroupInputSchema = z
  .object({
    id: z.string().min(1),
    nameKm: label,
    nameEn: label,
    values: z.array(variantValueInputSchema).min(1, "required").max(MAX_VALUES_PER_GROUP, "too_long"),
  })
  .superRefine((group, ctx) => {
    if (!group.nameKm && !group.nameEn) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required", path: ["name"] });
  });
export type VariantGroupInput = z.infer<typeof variantGroupInputSchema>;

export const choicePickSchema = z.enum(["one", "many"]);
export type ChoicePick = z.infer<typeof choicePickSchema>;

export const choiceValueInputSchema = z
  .object({ id: z.string().min(1), labelKm: label, labelEn: label, extraUsdCents: extraAmount, extraKhr: extraAmount })
  .superRefine(needsName);
export const choiceGroupInputSchema = z
  .object({
    id: z.string().min(1),
    nameKm: label,
    nameEn: label,
    pick: choicePickSchema,
    required: z.boolean(),
    values: z.array(choiceValueInputSchema).min(1, "required").max(MAX_VALUES_PER_GROUP, "too_long"),
  })
  .superRefine((group, ctx) => {
    if (!group.nameKm && !group.nameEn) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "required", path: ["name"] });
  });
export type ChoiceGroupInput = z.infer<typeof choiceGroupInputSchema>;

/** Every combination of one value per group, in the groups' order: [["s","red"],["s","blue"],["m","red"]…]. */
export function combinations(groups: readonly { values: readonly { id: string }[] }[]): string[][] {
  return groups.reduce<string[][]>((rows, group) => rows.flatMap((row) => group.values.map((value) => [...row, value.id])), [[]]).filter((row) => row.length > 0);
}

/** A variant's name from its values: "M · Red" (one language; the other when blank). */
export function variantLabel(groups: readonly { values: readonly { id: string; labelKm: string; labelEn: string }[] }[], valueIds: readonly string[], language: "km" | "en"): string {
  return groups
    .map((group) => group.values.find((value) => valueIds.includes(value.id)))
    .flatMap((value) => (value ? [language === "km" ? value.labelKm || value.labelEn : value.labelEn || value.labelKm] : []))
    .join(" · ");
}

/** One choice frozen on an order line: what the buyer picked and what it added to one unit, in the order's currency. */
export const orderLineChoiceSchema = z.object({
  groupKm: z.string(),
  groupEn: z.string(),
  labelKm: z.string(),
  labelEn: z.string(),
  extraMinor: z.number().int().min(0),
});
export type OrderLineChoice = z.infer<typeof orderLineChoiceSchema>;
export const orderLineChoicesSchema = z.array(orderLineChoiceSchema);

/** A product's choice groups as the API reads them, for checking a buyer's picks. */
export interface ChoiceGroupFacts {
  id: string;
  nameKm: string;
  nameEn: string;
  pick: ChoicePick;
  required: boolean;
  values: { id: string; labelKm: string; labelEn: string; extraUsdCents: number | null; extraKhr: number | null }[];
}

export type PickedChoices = { ok: true; picked: { group: ChoiceGroupFacts; value: ChoiceGroupFacts["values"][number] }[] } | { ok: false; problem: "choice_required" | "choice_invalid" };

/**
 * Checks a buyer's picks against the product's choice groups: every id is one
 * of its values, a "pick one" group has at most one, a required group has at
 * least one. Returns the picks in the groups' and values' own order.
 */
export function pickChoices(groups: readonly ChoiceGroupFacts[], choiceIds: readonly string[]): PickedChoices {
  const known = new Set(groups.flatMap((group) => group.values.map((value) => value.id)));
  if (choiceIds.some((id) => !known.has(id)) || new Set(choiceIds).size !== choiceIds.length) return { ok: false, problem: "choice_invalid" };
  const picked: { group: ChoiceGroupFacts; value: ChoiceGroupFacts["values"][number] }[] = [];
  for (const group of groups) {
    const inGroup = group.values.filter((value) => choiceIds.includes(value.id));
    if (group.pick === "one" && inGroup.length > 1) return { ok: false, problem: "choice_invalid" };
    if (group.required && inGroup.length === 0) return { ok: false, problem: "choice_required" };
    picked.push(...inGroup.map((value) => ({ group, value })));
  }
  return { ok: true, picked };
}

/**
 * A cart line's key: the variant alone, or with its picked choices
 * ("variant|a,b", ids sorted) — the same coffee with and without a shot is two lines.
 */
export function cartLineKey(variantId: string, choiceIds: readonly string[] = []): string {
  return choiceIds.length ? `${variantId}|${[...choiceIds].sort().join(",")}` : variantId;
}

export function parseCartLineKey(key: string): { variantId: string; choiceIds: string[] } {
  const [variantId = "", choices = ""] = key.split("|");
  return { variantId, choiceIds: choices ? choices.split(",") : [] };
}
