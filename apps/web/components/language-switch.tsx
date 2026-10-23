"use client";

import { SegmentedControl } from "@khmio/ui";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { isValidLocale, routing } from "@/i18n/routing";
import { pathInLocale, type Locale } from "@/lib/locale-path";

/**
 * Each language by its own name. Like a brand name, it reads the same on
 * every page whatever language is showing, so it lives here, not in messages.
 */
export const LANGUAGE_NAMES: Record<Locale, { short: string; long: string }> = {
  km: { short: "ខ្មែរ", long: "ភាសាខ្មែរ" },
  en: { short: "EN", long: "English" },
};

/** The page's language, and a way to show the same page (and its query) in another one. */
export function useLocaleSwitch() {
  const router = useRouter();
  const current = useLocale();
  const locale = isValidLocale(current) ? current : routing.defaultLocale;
  const switchTo = useCallback(
    // Read at the tap, so the address's query (a list's tab, a search) comes along.
    (next: Locale) => router.replace(pathInLocale(window.location.pathname + window.location.search, next)),
    [router],
  );
  return { locale, switchTo };
}

/**
 * ខ្មែរ | EN, for every page header and the Display settings. "short" fits a
 * header; "long" (ភាសាខ្មែរ | English) is for a settings row.
 */
export function LanguageSwitch({ size = "short", className }: { size?: "short" | "long"; className?: string }) {
  const { locale, switchTo } = useLocaleSwitch();
  return (
    <SegmentedControl
      value={locale}
      onChange={switchTo}
      className={className}
      options={routing.locales.map((value) => ({
        value,
        label: <span lang={value}>{LANGUAGE_NAMES[value][size]}</span>,
      }))}
    />
  );
}
