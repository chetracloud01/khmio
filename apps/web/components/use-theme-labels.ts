"use client";

import type { ThemeSwitcherLabels } from "@khmio/ui";
import { useTranslations } from "next-intl";

/** Translated labels for the shared ThemeSwitcher, identical on every screen. */
export function useThemeLabels(): ThemeSwitcherLabels {
  const t = useTranslations("Theme");
  return {
    button: t("button"),
    mode: t("mode"),
    light: t("light"),
    dark: t("dark"),
    system: t("system"),
    accent: t("accent"),
    accents: { teal: t("teal"), indigo: t("indigo"), violet: t("violet"), rose: t("rose"), amber: t("amber") },
  };
}
