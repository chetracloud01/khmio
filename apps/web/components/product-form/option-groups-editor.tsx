"use client";

import { MAX_VALUES_PER_GROUP, type ChoicePick } from "@khmio/shared";
import { Button, IconButton, Input, MoneyInput, SegmentedControl, Switch } from "@khmio/ui";
import { Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { emptyGroup, emptyValue, type OptionGroupDraft, type OptionValueDraft } from "./option-groups";

/**
 * The product form's option groups (Features › options or choices), one
 * editor for both kinds: "variant" groups (Size, Colour) are names and
 * values; "choice" groups (Sugar, Add-ons) add "pick one / pick any",
 * "must choose" and an extra price per value. Messages come keyed as the
 * shared schema names them: `${field}.0.name`, `${field}.0.values.1.label`.
 */
export function OptionGroupsEditor({
  kind,
  field,
  groups,
  onChange,
  max,
  error,
  usdToKhrRate,
}: {
  kind: "variant" | "choice";
  /** The schema's field: "variantGroups" or "choiceGroups". */
  field: string;
  groups: OptionGroupDraft[];
  onChange: (groups: OptionGroupDraft[]) => void;
  max: number;
  error: (key: string) => string | undefined;
  usdToKhrRate: number;
}) {
  const t = useTranslations("ProductForm");
  const choice = kind === "choice";
  const updateGroup = (id: string, patch: Partial<OptionGroupDraft>) => onChange(groups.map((group) => (group.id === id ? { ...group, ...patch } : group)));
  const updateValue = (group: OptionGroupDraft, valueId: string, patch: Partial<OptionValueDraft>) =>
    updateGroup(group.id, { values: group.values.map((value) => (value.id === valueId ? { ...value, ...patch } : value)) });

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, groupIndex) => {
        const key = (rest: string) => `${field}.${groupIndex}.${rest}`;
        return (
          <div key={group.id} className="flex flex-col gap-3 rounded-DEFAULT border border-border p-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                label={t("groupNameKm")}
                placeholder={t(choice ? "choiceGroupPlaceholder" : "variantGroupPlaceholder")}
                value={group.nameKm}
                onChange={(event) => updateGroup(group.id, { nameKm: event.target.value })}
                error={error(key("name"))}
              />
              <Input label={t("groupNameEn")} value={group.nameEn} onChange={(event) => updateGroup(group.id, { nameEn: event.target.value })} />
            </div>
            {choice && (
              <div className="flex flex-col gap-2">
                <SegmentedControl<ChoicePick>
                  mode="choice"
                  label={t("pickLabel")}
                  value={group.pick}
                  onChange={(pick) => updateGroup(group.id, { pick })}
                  options={[
                    { value: "one", label: t("pickOne") },
                    { value: "many", label: t("pickMany") },
                  ]}
                />
                <Switch checked={group.required} onChange={(required) => updateGroup(group.id, { required })} label={t("requiredLabel")} description={t("requiredHint")} />
              </div>
            )}
            <ul className="flex flex-col gap-2">
              {group.values.map((value, valueIndex) => (
                <li key={value.id} className="flex flex-col gap-2 rounded-DEFAULT bg-border/10 p-2">
                  <div className="flex items-start gap-2">
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                      <Input
                        label={t("valueKm")}
                        value={value.labelKm}
                        onChange={(event) => updateValue(group, value.id, { labelKm: event.target.value })}
                        error={error(key(`values.${valueIndex}.label`))}
                      />
                      <Input label={t("valueEn")} value={value.labelEn} onChange={(event) => updateValue(group, value.id, { labelEn: event.target.value })} />
                    </div>
                    <IconButton
                      icon={X}
                      label={t("removeValue")}
                      disabled={group.values.length === 1}
                      onClick={() => updateGroup(group.id, { values: group.values.filter((entry) => entry.id !== value.id) })}
                      className="mt-6"
                    />
                  </div>
                  {choice && (
                    <MoneyInput
                      className="gap-2"
                      usd={value.extraUsd}
                      khr={value.extraKhr}
                      usdLabel={t("extraUsd")}
                      khrLabel={t("extraKhr")}
                      usdPlaceholder="0.00"
                      khrPlaceholder="0"
                      autoFillRate={usdToKhrRate}
                      onUsdChange={(text) => updateValue(group, value.id, { extraUsd: text })}
                      onKhrChange={(text) => updateValue(group, value.id, { extraKhr: text })}
                      usdError={error(key(`values.${valueIndex}.extraUsdCents`))}
                      khrError={error(key(`values.${valueIndex}.extraKhr`))}
                    />
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={group.values.length >= MAX_VALUES_PER_GROUP} onClick={() => updateGroup(group.id, { values: [...group.values, emptyValue()] })}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("addValue")}
              </Button>
              <Button variant="ghost" tone="danger" onClick={() => onChange(groups.filter((entry) => entry.id !== group.id))}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t("removeGroup")}
              </Button>
            </div>
          </div>
        );
      })}
      {groups.length < max && (
        <Button variant="secondary" className="self-start" onClick={() => onChange([...groups, emptyGroup()])}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t(choice ? "addChoiceGroup" : "addVariantGroup")}
        </Button>
      )}
    </div>
  );
}
