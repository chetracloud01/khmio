"use client";

import { cn, ThemeSwitcher } from "@khmio/ui";
import { ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldHalf, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { useThemeLabels } from "@/components/use-theme-labels";
import { adminBase, findActiveNav, type AdminBadge } from "./admin-nav";
import { AdminNavMenu } from "./admin-nav-menu";

/** "Sokha Chan" → "SC"; one word → its first two letters. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]![0], words[1]![0]] : [...(words[0] ?? "?")].slice(0, 2);
  return letters.join("").toUpperCase();
}

/**
 * The admin frame (docs/blueprint.md "Admin area standards"): a dark sidebar
 * that shrinks to icons on a laptop, the same menu in a drawer on phones and
 * tablets, and a header with where you are, language, theme and the account
 * menu. Rendered in the browser only (the admin waits for data first), so
 * reading saved choices while rendering is safe.
 */
export function AdminFrame({
  badgeCount,
  account,
  onSignOut,
  children,
}: {
  badgeCount: Partial<Record<AdminBadge, number>>;
  account: { name: string; role: string };
  onSignOut: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("AdminNav");
  const locale = useLocale();
  const pathname = usePathname();
  const themeLabels = useThemeLabels();
  const base = adminBase(locale);
  const active = findActiveNav(pathname, base);
  // The name it was saved under when there was also a mockup admin, so the choice is kept.
  const collapsedKey = "khmio:live-admin-sidebar-collapsed";

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(collapsedKey) === "1";
    } catch {
      return false;
    }
  });
  // Animate only when the user toggles, never on page load.
  const [animateWidth, setAnimateWidth] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen && !accountOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen, accountOpen]);

  function toggleCollapsed() {
    setAnimateWidth(true);
    setCollapsed((prev) => {
      try {
        window.localStorage.setItem(collapsedKey, prev ? "0" : "1");
      } catch {
        // Storage unavailable — the choice just won't be remembered.
      }
      return !prev;
    });
  }

  const navList = (compact: boolean) => (
    <AdminNavMenu
      compact={compact}
      base={base}
      activeKey={active?.item.key}
      badgeCount={badgeCount}
    />
  );

  const brand = (compact: boolean) => (
    <Link href={base} className="flex min-h-touch items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-DEFAULT bg-nav-accent text-nav-bg">
        <ShieldHalf className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-nav-fg">{t("brand")}</span>
          <span className="block text-xs text-nav-muted">{t("area")}</span>
        </span>
      )}
    </Link>
  );

  return (
    <div className="flex min-h-dvh bg-canvas text-fg">
      {/* Laptop and up: a fixed dark sidebar that can shrink to icons. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col gap-4 border-r border-nav-border bg-nav-bg p-3 lg:flex",
          animateWidth && "transition-[width] duration-300 ease-out motion-reduce:transition-none",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className={cn(collapsed && "flex justify-center")}>{brand(collapsed)}</div>
        {/* Only the menu scrolls; the logo and the collapse button stay put. */}
        <div className="nav-scroll -mx-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3">{navList(collapsed)}</div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t("expandMenu") : t("collapseMenu")}
          className={cn(
            "flex min-h-touch items-center gap-3 rounded-DEFAULT px-3 text-sm text-nav-muted hover:bg-nav-fg/5 hover:text-nav-fg",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
              {t("collapseMenu")}
            </>
          )}
        </button>
      </aside>

      {/* Phones and tablets: the same menu in a drawer. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div aria-hidden="true" onClick={() => setDrawerOpen(false)} className="absolute inset-0 animate-fade-in bg-fg/40 motion-reduce:animate-none" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("menuLabel")}
            className="nav-scroll relative flex h-full w-72 max-w-[85vw] animate-drawer-in flex-col gap-4 overflow-y-auto bg-nav-bg p-3 shadow-xl motion-reduce:animate-none"
          >
            <div className="flex items-center justify-between gap-2">
              {brand(false)}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t("closeMenu")}
                className="flex h-11 w-11 items-center justify-center rounded-DEFAULT text-nav-muted hover:bg-nav-fg/5 hover:text-nav-fg"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {navList(false)}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-1 border-b border-border bg-bg/85 px-2 py-2 backdrop-blur md:gap-2 md:px-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t("openMenu")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-DEFAULT text-muted hover:bg-border/20 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <nav aria-label={t("breadcrumbLabel")} className="flex min-w-0 flex-1 items-center gap-1 text-sm">
            {active && (
              <>
                <span className="hidden truncate text-muted sm:inline">{t(active.group.key)}</span>
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted sm:inline" aria-hidden="true" />
                <span className="truncate font-medium text-fg">{t(active.item.key)}</span>
              </>
            )}
          </nav>

          <LanguageSwitch className="shrink-0" />

          <ThemeSwitcher labels={themeLabels} className="shrink-0" />

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-label={t("accountMenu")}
              aria-expanded={accountOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-xs font-semibold text-bg">{initials(account.name)}</span>
            </button>
            {accountOpen && (
              <>
                <div aria-hidden="true" onClick={() => setAccountOpen(false)} className="fixed inset-0 z-10" />
                <div className="absolute right-0 top-12 z-20 w-60 rounded-DEFAULT border border-border bg-bg p-2 shadow-raised">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold">{account.name}</p>
                    <p className="text-xs text-muted">{account.role}</p>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="flex min-h-touch w-full items-center gap-2 rounded-DEFAULT px-3 text-sm text-muted hover:bg-border/10 hover:text-fg"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    {t("signOut")}
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Keyed on the URL so each page fades in when you move between them. */}
        <main key={pathname} className="mx-auto flex w-full max-w-[1200px] flex-1 animate-page-in flex-col gap-6 p-4 [--grid-sticky-top:3.8125rem] motion-reduce:animate-none md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
