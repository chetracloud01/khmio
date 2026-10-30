"use client";

import { cn, ThemeSwitcher } from "@khmio/ui";
import { Lock, Store, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LANGUAGE_NAMES, LanguageSwitch, useLocaleSwitch } from "@/components/language-switch";
import { routing } from "@/i18n/routing";
import { useThemeLabels } from "@/components/use-theme-labels";

export interface SellerNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** In the phone's bottom tabs (at most five fit a 360 px bar); the rest live in the sidebar only. */
  mobile: boolean;
  /** Pages reached from this tab on a phone: the tab stays lit there (e.g. "My shop" while in Delivery). */
  alsoActiveOn?: string[];
  /** Shown with a lock: not in the shop's plan. */
  locked?: boolean;
  lockedLabel?: string;
  /** A count beside the item (orders waiting); hidden at 0. */
  badge?: number;
}

/**
 * "light": a white sidebar (today's live dashboard). "teal": the Deep Khmio
 * Teal sidebar the admin uses (nav-* tokens), with language and theme in a
 * slim top bar beside it — one professional look across Khmio.
 */
export type SellerFrameLook = "light" | "teal";

const STATUS_DOT = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" } as const;

/**
 * The phone header's main button (Share): a teal pill with its name on a
 * phone 400px or wider, a round teal icon on a smaller one (the shop's name
 * keeps its room) and once the page scrolls (the header turns slim). Put the
 * name in a span with HEADER_PILL_TEXT.
 */
export const HEADER_PILL =
  "flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-brand text-sm font-semibold text-on-brand shadow-card transition-all min-[400px]:group-data-[compact=false]:px-3.5 motion-reduce:transition-none";
export const HEADER_PILL_TEXT = "sr-only min-[400px]:group-data-[compact=false]:not-sr-only";

/**
 * The seller dashboard's frame (/m; design/design-standard.md §2): on a phone the shop at the top and up to
 * five bottom tabs; from 768 px a sidebar with every section and no bottom
 * tabs. Pages put their own width inside (lists up to 1100 px, forms 720 px —
 * see SELLER_PAGE and SELLER_FORM). Header, tabs and sidebar don't print, so
 * an order slip prints clean.
 */
export function SellerFrame({
  shop,
  nav,
  homeHref,
  banner,
  headerExtra,
  topBarExtra,
  sidebarFooter,
  look = "light",
  hideMobileNav = false,
  shopHref,
  showSettings = true,
  children,
}: {
  /** `belowOnTeal`: the line under the name in the dark sidebar ("teal" look), in nav colours; the phone header keeps `below`. */
  shop: {
    name: string;
    logoUrl: string | null;
    below?: ReactNode;
    belowOnTeal?: ReactNode;
    /** The shop's state as a dot on its logo: green open, amber payment due, red paused. */
    status?: { tone: "success" | "warning" | "danger"; label: string };
  };
  nav: SellerNavItem[];
  homeHref: string;
  /** A notice across the top of the content (shop paused, plan ending …). */
  banner?: ReactNode;
  /** At the right of the phone header. */
  headerExtra?: ReactNode;
  /** "teal" look: at the right of the laptop's top bar, before language and theme (e.g. "View my shop"). */
  topBarExtra?: ReactNode;
  /** At the bottom of the sidebar, under the menu. */
  sidebarFooter?: ReactNode;
  look?: SellerFrameLook;
  /** A full-screen form on a phone (e.g. the product form): no bottom tabs, so its save bar sits at the bottom. */
  hideMobileNav?: boolean;
  /** The buyer's view of the shop: a round "View shop" button in the phone header (a laptop has it in its top bar). */
  shopHref?: string;
  /** Language and theme in the frame. Off when a page has them instead (the live dashboard's My shop). */
  showSettings?: boolean;
  children: ReactNode;
}) {
  const { locale, switchTo } = useLocaleSwitch();
  const pathname = usePathname();
  const themeLabels = useThemeLabels();
  const tFrame = useTranslations("SellerApp");
  const otherLocale = routing.locales.find((value) => value !== locale) ?? routing.defaultLocale;

  const isActive = (href: string) => (href === homeHref ? pathname === href : pathname.startsWith(href));
  /** The item's own page, or one of the pages reached from it (e.g. Delivery from "My shop"). */
  const isActiveItem = (item: SellerNavItem) => isActive(item.href) || (item.alsoActiveOn ?? []).some((page) => pathname.startsWith(page));

  const settings = (direction: "up" | "down") => (
    <div className="flex shrink-0 items-center gap-1">
      <LanguageSwitch />
      <ThemeSwitcher labels={themeLabels} direction={direction} />
    </div>
  );

  const teal = look === "teal";

  // The phone header turns slim once the page scrolls a little.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const identity = (onTeal: boolean) => (
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative shrink-0">
        {shop.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the shop's own logo (uploaded)
          <img src={shop.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-full text-base font-bold", onTeal ? "bg-nav-accent text-nav-bg" : "bg-brand text-on-brand")}>
            {shop.name.charAt(0).toUpperCase()}
          </span>
        )}
        {shop.status && (
          <span
            title={shop.status.label}
            className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2", onTeal ? "ring-nav-bg" : "ring-bg", STATUS_DOT[shop.status.tone])}
          >
            <span className="sr-only">{shop.status.label}</span>
          </span>
        )}
      </span>
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-semibold", onTeal ? "text-nav-fg" : "text-fg")}>{shop.name}</p>
        {/* On a phone the line under the name folds away once the page scrolls: the header turns slim. */}
        {onTeal ? (shop.belowOnTeal ?? shop.below) : <div className="group-data-[compact=true]:hidden">{shop.below}</div>}
      </div>
    </div>
  );

  return (
    <div className={cn("flex min-h-dvh flex-col bg-canvas text-fg md:flex-row", hideMobileNav && "nav-hidden")}>
      {/* Tablet and up: every section in a sidebar. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r p-4 md:flex print:hidden",
          teal ? "border-nav-border bg-nav-bg" : "border-border bg-bg",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          {identity(teal)}
        </div>
        <nav className={cn("flex flex-1 flex-col gap-1 overflow-y-auto", teal && "nav-scroll")}>
          {nav.map((item) => {
            const active = isActiveItem(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-touch shrink-0 items-center gap-3 rounded-DEFAULT px-3 text-sm font-medium transition-colors",
                  teal
                    ? active
                      ? "bg-nav-fg/10 text-nav-fg before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-nav-accent"
                      : "text-nav-muted hover:bg-nav-fg/5 hover:text-nav-fg"
                    : active
                      ? "bg-brand/10 text-brand"
                      : "text-muted hover:bg-border/10 hover:text-fg",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{item.label}</span>
                {!!item.badge && (
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", teal ? "bg-nav-badge/15 text-nav-badge" : "bg-brand/10 text-brand")}>
                    {item.badge}
                  </span>
                )}
                {item.locked && <Lock className={cn("h-4 w-4", teal ? "text-nav-muted" : "text-muted")} aria-label={item.lockedLabel} />}
              </Link>
            );
          })}
        </nav>
        {sidebarFooter}
        {!teal && showSettings && settings("up")}
      </aside>

      {/* Phone: pinned while the page scrolls, so the shop's name and the language and theme stay in reach; the
          top padding clears the notch when Khmio runs as an installed app (full screen). */}
      <header
        data-compact={compact}
        className="group sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur transition-[padding] data-[compact=true]:pb-2 data-[compact=true]:pt-[max(0.5rem,env(safe-area-inset-top))] data-[compact=true]:shadow-card md:hidden print:hidden motion-reduce:transition-none"
      >
        {identity(false)}
        {/* Compact on a phone, so the shop's name keeps its room: the page's extras (Share), View shop last; language and theme when shown. */}
        <div className="flex shrink-0 items-center gap-1">
          {showSettings && (
            <>
              <button
                type="button"
                onClick={() => switchTo(otherLocale)}
                lang={otherLocale}
                aria-label={tFrame("switchLanguage")}
                className="flex h-11 min-w-11 items-center justify-center rounded-full border border-border bg-bg px-3 text-sm font-semibold"
              >
                {LANGUAGE_NAMES[otherLocale].short}
              </button>
              <ThemeSwitcher labels={themeLabels} direction="down" />
            </>
          )}
          {headerExtra}
          {shopHref && (
            <Link
              href={shopHref}
              target="_blank"
              aria-label={tFrame("viewShop")}
              title={tFrame("viewShop")}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg text-brand shadow-card"
            >
              <Store className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </header>

      {/* A plain block, not a flex column: a wide table inside a page must scroll in its own box, never push the page wider. */}
      {/* --grid-sticky-top: the pinned header's height (slim phone header, laptop top bar), so a data grid's toolbar pins just under it. */}
      <main className={cn("min-w-0 flex-1 [--grid-sticky-top:calc(3.3125rem+max(0.5rem,env(safe-area-inset-top)))] md:pb-0 md:[--grid-sticky-top:3.8125rem]", hideMobileNav ? "pb-[env(safe-area-inset-bottom)]" : "pb-[calc(5rem+env(safe-area-inset-bottom))]")}>
        {/* Teal look, tablet and up: language, theme and extras in a slim bar, as in the admin. */}
        {teal && (
          <div className="sticky top-0 z-30 hidden items-center justify-end gap-2 border-b border-border bg-bg/85 px-4 py-2 backdrop-blur md:flex print:hidden">
            {topBarExtra}
            {showSettings && settings("down")}
          </div>
        )}
        {banner}
        {children}
      </main>

      {/* 64px of tabs plus the phone's home-bar gap; .bottom-above-nav (globals.css) keeps form bars on top of it. */}
      <nav className={cn("fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden print:hidden", hideMobileNav && "hidden")}>
        <div className="flex h-16">
          {nav
            .filter((item) => item.mobile)
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActiveItem(item) ? "page" : undefined}
                className={cn(
                  "flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  isActiveItem(item) ? "text-brand" : "text-muted",
                )}
              >
                <span className="relative">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  {!!item.badge && (
                    <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[18px] text-on-brand">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            ))}
        </div>
      </nav>
    </div>
  );
}

/** A dashboard list or overview page: full width on a phone, up to 1100 px on a laptop. */
export const SELLER_PAGE = "mx-auto flex w-full max-w-[1100px] flex-col p-4 md:p-6";
/** A dashboard form: a readable 720 px column on a laptop. */
export const SELLER_FORM = "mx-auto flex w-full max-w-[720px] flex-col p-4 md:p-6";
/** A form's sticky Save bar: on top of the phone tabs, at the bottom of the screen from 768 px. */
export const SELLER_FORM_BAR = "bottom-above-nav -mb-4 rounded-b-DEFAULT md:bottom-0 md:-mb-6";
