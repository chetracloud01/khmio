"use client";

import { IconBadge, ThemePicker } from "@khmio/ui";
import { Languages, Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitch } from "@/components/language-switch";
import { SubPage } from "@/components/seller-frame/sub-page";
import { useThemeLabels } from "@/components/use-theme-labels";

// "Language & display", reached from the My shop menu: this device's language
// and theme (light, dark or the phone's, and the accent colour). Both apply at
// once and stay on this device.
export default function DisplayPage() {
  const t = useTranslations("DashboardProfile");
  const themeLabels = useThemeLabels();
  return (
    <SubPage title={t("languageAndDisplay")}>
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-bg p-4 shadow-card">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <IconBadge icon={Languages} tone="brand" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t("language")}</p>
              <p className="text-xs text-muted">{t("languageDetail")}</p>
            </div>
          </div>
          <LanguageSwitch size="long" className="w-full [&>*]:flex-1" />
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-3">
            <IconBadge icon={Palette} tone="info" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t("display")}</p>
              <p className="text-xs text-muted">{t("displayDetail")}</p>
            </div>
          </div>
          <ThemePicker labels={themeLabels} />
        </div>
      </div>
    </SubPage>
  );
}
