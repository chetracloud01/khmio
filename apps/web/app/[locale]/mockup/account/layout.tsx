"use client";

import { cn, KhmioLogo, ThemeSwitcher } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { AppSwitcher } from "../app-switcher";
import { useThemeLabels } from "@/components/use-theme-labels";

// My Khmio (design/screens.md "Account hub"): after login, the one place a
// customer sees and controls every Khmio product — apps, subscriptions and
// the account — with the same app switcher as every product.
export default function AccountLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("Account");
  const locale = useLocale();
  const pathname = usePathname();
  const themeLabels = useThemeLabels();
  const base = `/${locale}/mockup/account`;
  const tabs = [
    { href: base, label: t("navApps") },
    { href: `${base}/subscriptions`, label: t("navSubscriptions") },
    { href: `${base}/profile`, label: t("navAccount") },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-2 px-4">
          <Link href={base} className="mr-auto flex min-h-touch items-center gap-2" aria-label={t("title")}>
            <KhmioLogo />
            <span className="hidden text-sm font-medium text-muted sm:inline">{t("title")}</span>
          </Link>
          <div className="hidden sm:block">
            <LanguageSwitch />
          </div>
          <ThemeSwitcher labels={themeLabels} direction="down" />
          <AppSwitcher current="hub" align="right" />
        </div>
        <nav className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-4 no-scrollbar" aria-label={t("title")}>
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-touch shrink-0 items-center border-b-2 px-3 text-sm font-medium",
                  active ? "border-brand text-brand" : "border-transparent text-muted hover:text-fg",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">{children}</main>
      <p className="px-4 pb-4 text-center text-xs text-muted">{t("mockNote")}</p>
    </div>
  );
}
