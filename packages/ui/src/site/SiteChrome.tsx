"use client";

import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { buttonVariants } from "../Button";
import { cn } from "../cn";
import { KhmioLogo } from "./KhmioMark";
import { SiteContainer } from "./kit";

export interface SiteNavLink {
  label: string;
  href: string;
}

export interface SiteHeaderProps {
  homeHref: string;
  links: SiteNavLink[];
  login: SiteNavLink;
  start: SiteNavLink;
  /** The ខ្មែរ / EN switch, built by the page (it knows the router). */
  languageSwitch: ReactNode;
  labels: { openMenu: string; closeMenu: string; home: string; nav: string };
}

/**
 * The site's header: logo, links, language, "Log in", and "Start free" — the
 * one main button, visible at every width. On a phone the links fold into a menu.
 */
export function SiteHeader({ homeHref, links, login, start, languageSwitch, labels }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
      <SiteContainer className="flex h-16 items-center gap-3">
        <a href={homeHref} className="flex min-h-touch items-center" aria-label={labels.home}>
          <KhmioLogo />
        </a>
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label={labels.nav}>
          {links.map((link) => (
            <a key={link.href} href={link.href} className="flex min-h-touch items-center rounded-DEFAULT px-3 text-sm font-medium text-fg hover:bg-border/30">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">{languageSwitch}</div>
          <a href={login.href} className="hidden min-h-touch items-center px-3 text-sm font-medium text-fg hover:text-brand md:flex">
            {login.label}
          </a>
          <a href={start.href} className={cn(buttonVariants({ variant: "primary" }), "px-4 text-sm sm:px-6")}>
            {start.label}
          </a>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? labels.closeMenu : labels.openMenu}
            className="flex h-11 w-11 items-center justify-center rounded-DEFAULT hover:bg-border/30 md:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </SiteContainer>
      {open && (
        <div id="site-menu" className="border-t border-border bg-bg md:hidden">
          <SiteContainer className="flex flex-col gap-1 py-3">
            {[...links, login].map((link) => (
              <a key={link.href} href={link.href} className="flex min-h-touch items-center rounded-DEFAULT px-3 font-medium hover:bg-border/30">
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
      <SiteContainer className="grid gap-8 py-10 sm:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-2">
          <a href={homeHref} className="flex min-h-touch items-center self-start">
            <KhmioLogo />
          </a>
          <p className="text-sm text-muted">{tagline}</p>
        </div>
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <p className="text-sm font-semibold">{group.title}</p>
            {group.links.map((link) => (
              <a key={link.href + link.label} href={link.href} className="flex min-h-touch items-center text-sm text-muted hover:text-brand sm:min-h-0 sm:py-1">
                {link.label}
              </a>
            ))}
          </div>
        ))}
      </SiteContainer>
      <SiteContainer className="border-t border-border py-4 text-xs text-muted">{copyright}</SiteContainer>
    </footer>
  );
}
