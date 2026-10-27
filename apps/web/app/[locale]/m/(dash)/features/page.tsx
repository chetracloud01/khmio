"use client";

import { BUSINESS_MODULES, BUSINESS_TYPE_MODULES, type BusinessModule } from "@khmio/shared";
import { Button, Notice, Switch } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { SubPage } from "@/components/seller-frame/sub-page";
import { api, ApiError, storeModulesSchema } from "@/lib/api";
import { useMerchant } from "../merchant-context";

// "Features for my business" (My shop): the shop's modules, each switched on
// or off at once. Switching one off hides it and stops new use; what it holds
// stays, and comes back when it's switched on again.
export default function FeaturesPage() {
  const t = useTranslations("Features");
  const tApp = useTranslations("App");
  const tType = useTranslations("BusinessType");
  const locale = useLocale();
  const { store, refreshStore } = useMerchant();
  const [modules, setModules] = useState<BusinessModule[]>(store.modules);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const preset = BUSINESS_TYPE_MODULES[store.businessType];
  const onPreset = preset.length === modules.length && preset.every((module) => modules.includes(module));

  async function save(next: BusinessModule[]) {
    const before = modules;
    setModules(next);
    setSaving(true);
    setProblem(null);
    try {
      setModules((await api("/store/modules", storeModulesSchema, { method: "PUT", body: { modules: next } })).modules);
      await refreshStore();
    } catch (failure) {
      setModules(before);
      setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SubPage title={t("title")} description={t("description")}>
      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-bg px-4 shadow-card">
        {BUSINESS_MODULES.map((module) => (
          <Switch
            key={module}
            className="py-3"
            label={t(`${module}Title`)}
            description={t(`${module}Detail`)}
            checked={modules.includes(module)}
            onChange={(on) => void save(on ? [...modules, module] : modules.filter((entry) => entry !== module))}
          />
        ))}
      </div>
      {modules.includes("customFields") && (
        <Link href={`/${locale}/m/custom-fields`} className="block self-start">
          <Button variant="secondary">{t("setUpFields")}</Button>
        </Link>
      )}
      {!onPreset && (
        <Button variant="ghost" className="self-start" disabled={saving} onClick={() => void save([...preset])}>
          {t("usePreset", { type: tType(store.businessType) })}
        </Button>
      )}
      {problem && (
        <Notice tone="danger" role="alert">
          {problem}
        </Notice>
      )}
    </SubPage>
  );
}
