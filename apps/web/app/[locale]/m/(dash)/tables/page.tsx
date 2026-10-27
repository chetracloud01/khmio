"use client";

import { dineTablesSaveSchema, MAX_DINE_TABLES, toFieldErrors, type FormErrorCode } from "@khmio/shared";
import { Button, IconButton, Input, Notice } from "@khmio/ui";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { FormActions, useFormErrorText } from "@/components/form-ui";
import { nextDraftId } from "@/components/product-form/option-groups";
import { SubPage } from "@/components/seller-frame/sub-page";
import { api, ApiError, type DineTable, dineTablesSchema } from "@/lib/api";
import { PageLoading, PageOffline } from "../page-states";

// "Tables" (Features › tables): the restaurant's tables, by name. A sale at
// the counter can be for one, and the Kitchen screen shows it. Orders keep
// the name they were made with.
export default function TablesPage() {
  const [saved, setSaved] = useState<DineTable[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    api("/tables", dineTablesSchema).then((answer) => setSaved(answer.tables), () => setFailed(true));
  }, []);
  useEffect(load, [load]);
  if (failed) return <PageOffline onRetry={load} />;
  if (!saved) return <PageLoading />;
  return <TablesEditor initial={saved} />;
}

function TablesEditor({ initial }: { initial: DineTable[] }) {
  const t = useTranslations("Tables");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const [tables, setTables] = useState(initial);
  const [savedTables, setSavedTables] = useState(initial);
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(tables) !== JSON.stringify(savedTables);

  async function save() {
    setProblem(null);
    const result = dineTablesSaveSchema.safeParse({ tables });
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const answer = await api("/tables", dineTablesSchema, { method: "PUT", body: result.data });
      setTables(answer.tables);
      setSavedTables(answer.tables);
    } catch (failure) {
      setProblem(failure instanceof ApiError && failure.code === "module_off" ? t("moduleOff") : failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SubPage title={t("title")} description={t("description")}>
      <ul className="flex flex-col gap-2">
        {tables.map((table, index) => (
          <li key={table.id} className="flex items-start gap-2">
            <Input
              className="flex-1"
              label={t("nameLabel", { number: index + 1 })}
              placeholder={t("namePlaceholder")}
              value={table.name}
              onChange={(event) => setTables((current) => current.map((entry) => (entry.id === table.id ? { ...entry, name: event.target.value } : entry)))}
              error={errorText(errors[`tables.${index}.name`])}
            />
            <IconButton icon={X} label={t("remove", { name: table.name || index + 1 })} onClick={() => setTables((current) => current.filter((entry) => entry.id !== table.id))} className="mt-6" />
          </li>
        ))}
      </ul>
      {tables.length < MAX_DINE_TABLES && (
        <Button variant="secondary" className="self-start" onClick={() => setTables((current) => [...current, { id: nextDraftId(), name: "" }])}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("add")}
        </Button>
      )}
      {problem && (
        <Notice tone="danger" role="alert">
          {problem}
        </Notice>
      )}
      <FormActions
        dirty={dirty && !saving}
        canCancel={!saving}
        onCancel={() => {
          setTables(savedTables);
          setErrors({});
        }}
        onSave={() => void save()}
        saveLabel={saving ? tApp("saving") : t("save")}
        cancelLabel={t("cancel")}
      />
    </SubPage>
  );
}
