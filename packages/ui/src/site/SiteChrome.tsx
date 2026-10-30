"use client";

import { ChevronDown, Menu, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonVariants } from "../Button";
import { cn } from "../cn";
import { KhmioLogo } from "./KhmioMark";
import type { SiteStatus } from "@khmio/shared";
import { SiteContainer, SiteStatusBadge, type SiteKitLabels } from "./kit";

export interface SiteNavLink {
  label: string;
  href: string;
}

/** One entry of a header menu: a business solution with its status. */
export interface SiteMenuItem extends SiteNavLink {
  icon: LucideIcon;
  status: SiteStatus;
}

export interface SiteHeaderProps {
  homeHref: string;
  /** "Industries": a menu that opens under the header (on a phone, a list in the menu). */
  menu?: { label: string; items: SiteMenuItem[] };
  links: SiteNavLink[];
  login: SiteNavLink;
  start: SiteNavLink;
  /** The ខ្មែរ / EN switch, built by the page (it knows the router). */
  languageSwitch: ReactNode;
  labels: { openMenu: string; closeMenu: string; home: string; nav: string } & Pick<SiteKitLabels, "available" | "beta" | "comingSoon">;
}

function MenuEntry({ item, labels, onPick }: { item: SiteMenuItem; labels: SiteHeaderProps["labels"]; onPick: () => void }) {
  const Icon = item.icon;
  return (
    <a href={item.href} onClick={onPick} className="flex min-h-touch items-center gap-3 rounded-xl px-3 py-2 hover:bg-canvas">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
      <SiteStatusBadge status={item.status} labels={labels} />
    </a>
  );
}

/**
 * The site's header: logo, the Industries menu, links, language, "Log in", and
 * "Start free" — the one main button, visible at every width. On a phone
 * everything else folds into a menu.
 */
export function SiteHeader({ homeHref, menu, links, login, start, languageSwitch, labels }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // The Industries menu closes on Escape and on a click anywhere else.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      const outside = !(event.target instanceof Node && menuRef.current?.contains(event.target));
      if (event instanceof KeyboardEvent ? event.key === "Escape" : outside) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-md">
      <SiteContainer className="flex h-16 items-center gap-3">
        <a href={homeHref} className="flex min-h-touch items-center" aria-label={labels.home}>
          <KhmioLogo />
        </a>
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label={labels.nav}>
          {menu && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                aria-expanded={menuOpen}
                aria-controls="site-solutions"
                className="flex min-h-touch items-center gap-1 rounded-full px-3 text-sm font-medium text-fg hover:bg-border/30"
              >
                {menu.label}
                <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", menuOpen && "rotate-180")} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div id="site-solutions" className="absolute left-0 top-full mt-2 w-[360px] rounded-2xl border border-border bg-bg p-2 shadow-raised">
                  {menu.items.map((item) => (
                    <MenuEntry key={item.href} item={item} labels={labels} onPick={() => setMenuOpen(false)} />
                  ))}
                </div>
              )}
            </div>
          )}
          {links.map((link) => (
            <a key={link.href} href={link.href} className="flex min-h-touch items-center rounded-full px-3 text-sm font-medium text-fg hover:bg-border/30">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">{languageSwitch}</div>
          <a href={login.href} className="hidden min-h-touch items-center px-3 text-sm font-medium text-fg hover:text-brand md:flex">
            {login.label}
          </a>
          <a href={start.href} className={cn(buttonVariants({ variant: "primary" }), "rounded-full px-4 text-sm sm:px-6")}>
            {start.label}
          </a>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? labels.closeMenu : labels.openMenu}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-border/30 md:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </SiteContainer>
      {open && (
        <div id="site-menu" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-bg md:hidden">
          <SiteContainer className="flex flex-col gap-1 py-3">
            {menu && (
              <>
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">{menu.label}</p>
                {menu.items.map((item) => (
                  <MenuEntry key={item.href} item={item} labels={labels} onPick={() => setOpen(false)} />
                ))}
                <div className="my-2 h-px bg-border" />
              </>
            )}
            {[...links, login].map((link) => (
              <a key={link.href} href={link.href} className="flex min-h-touch items-center rounded-xl px-3 font-medium hover:bg-canvas">
                {link.label}
              </a>
            ))}
            <div className="px-3 pt-2">{languageSwitch}</div>
          </SiteContainer>
        </div>
      )}
    </header>
  );
}

export interface SiteFooterProps {
  homeHref: string;
  groups: { title: string; links: SiteNavLink[] }[];
  tagline: string;
  copyright: string;
}

export function SiteFooter({ homeHref, groups, tagline, copyright }: SiteFooterProps) {
  return (
    <footer className="border-t border-border bg-canvas">
      <SiteContainer className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <a href={homeHref} className="flex min-h-touch items-center self-start">
            <KhmioLogo />
          </a>
          <p className="max-w-xs text-sm text-muted">{tagline}</p>
        </div>
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <p className="pb-1 text-sm font-semibold">{group.title}</p>
            {group.links.map((link) => (
              <a key={link.href + link.label} href={link.href} className="flex min-h-touch items-center text-sm text-muted hover:text-brand sm:min-h-0 sm:py-1.5">
                {link.label}
              </a>
            ))}
          </div>
        ))}
      </SiteContainer>
      <SiteContainer className="border-t border-border py-5 text-xs text-muted">{copyright}</SiteContainer>
    </footer>
  );
}
