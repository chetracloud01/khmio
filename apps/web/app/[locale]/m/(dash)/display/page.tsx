"use client";

import { IconBadge, SegmentedControl, ThemePicker } from "@khmio/ui";
import { Languages, Palette } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { SubPage } from "@/components/seller-frame/sub-page";
import { useThemeLabels } from "@/components/use-theme-labels";

// "Language & display", reached from the My shop menu: this device's language
// and theme (light, dark or the phone's, and the accent colour). Both apply at
// once and stay on this device.
export default function DisplayPage() {
  const t = useTranslations("DashboardProfile");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
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
          <SegmentedControl
            value={locale}
            onChange={(next) => router.replace(pathname.replace(/^\/(km|en)(?=\/|$)/, `/${next}`))}
            options={[
              { value: "km", label: "ភាសាខ្មែរ" },
              { value: "en", label: "English" },
            ]}
            className="w-full [&>*]:flex-1"
          />
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
