import { combinations, parseKhrInput, parseUsdInput, usdInputText, khrInputText, type ChoiceGroupInput, type ChoicePick, type VariantGroupInput } from "@khmio/shared";
import type { ChoiceGroup, VariantGroup } from "@/lib/api";

// The product form's option groups as typed (text boxes), and the step to the
// shared schema's shape (packages/shared product-options.ts). One draft shape
// for both kinds: a variant group just never uses pick, required or extras.

export interface OptionValueDraft {
  id: string;
  labelKm: string;
  labelEn: string;
  /** Choice values only: the extra price as typed. */
  extraUsd: string;
  extraKhr: string;
}

export interface OptionGroupDraft {
  id: string;
  nameKm: string;
  nameEn: string;
  pick: ChoicePick;
  required: boolean;
  values: OptionValueDraft[];
}

let counter = 0;
/** Unique across page loads too: a kept draft keeps the ids it was saved with. */
export function nextDraftId(): string {
  counter += 1;
  return `draft-${Date.now()}-${counter}`;
}

export function emptyValue(): OptionValueDraft {
  return { id: nextDraftId(), labelKm: "", labelEn: "", extraUsd: "", extraKhr: "" };
}

export function emptyGroup(): OptionGroupDraft {
  return { id: nextDraftId(), nameKm: "", nameEn: "", pick: "one", required: false, values: [emptyValue()] };
}

export function variantGroupDrafts(groups: VariantGroup[]): OptionGroupDraft[] {
  return groups.map((group) => ({ ...group, pick: "one", required: false, values: group.values.map((value) => ({ ...value, extraUsd: "", extraKhr: "" })) }));
}

export function choiceGroupDrafts(groups: ChoiceGroup[]): OptionGroupDraft[] {
  return groups.map((group) => ({
    ...group,
    values: group.values.map((value) => ({ id: value.id, labelKm: value.labelKm, labelEn: value.labelEn, extraUsd: usdInputText(value.extraUsdCents), extraKhr: khrInputText(value.extraKhr) })),
  }));
}

export function toVariantGroupInput(groups: OptionGroupDraft[]): VariantGroupInput[] {
  return groups.map((group) => ({ id: group.id, nameKm: group.nameKm, nameEn: group.nameEn, values: group.values.map(({ id, labelKm, labelEn }) => ({ id, labelKm, labelEn })) }));
}

export function toChoiceGroupInput(groups: OptionGroupDraft[]): ChoiceGroupInput[] {
  return groups.map((group) => ({
    id: group.id,
    nameKm: group.nameKm,
    nameEn: group.nameEn,
    pick: group.pick,
    required: group.required,
    values: group.values.map((value) => ({ id: value.id, labelKm: value.labelKm, labelEn: value.labelEn, extraUsdCents: parseUsdInput(value.extraUsd), extraKhr: parseKhrInput(value.extraKhr) })),
  }));
}

/**
 * "Make all combinations": one option row per combination of the groups'
 * values. Rows already there keep their prices and SKU; a new one starts
 * from the first row's prices; rows whose combination is gone are dropped.
 */
export function rowsForCombinations<Row extends { valueIds: string[] }>(groups: OptionGroupDraft[], rows: Row[], newRow: (valueIds: string[], copyFrom: Row | undefined) => Row): Row[] {
  return combinations(groups).map((valueIds) => rows.find((row) => row.valueIds.join("|") === valueIds.join("|")) ?? newRow(valueIds, rows[0]));
}
