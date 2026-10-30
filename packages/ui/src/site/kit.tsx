import type { LocalizedText, SiteApp, SiteSolution, SiteStatus } from "@khmio/shared";
import type { ReactNode } from "react";
import { cn } from "../cn";
import type { SitePlansLabels } from "./PlansSection";
import type { SiteWaitlistContext } from "./WaitlistSection";

// What every site kit section shares: the page's language, its links, the
// fixed words from the translation files, and the same container.

export type SiteLocale = "km" | "en";

/** The site's fixed words, from the translation files — never content. */
export interface SiteKitLabels {
  /** The status badges. */
  available: string;
  beta: string;
  comingSoon: string;
  learnMore: string;
  joinWaitlist: string;
  startFree: string;
  sample: string;
  mio: string;
  /** A document not checked by an advisor yet. */
  draft: string;
  /** "Last updated 28 Oct 2026", from a YYYY-MM-DD day. */
  lastUpdated: (day: string) => string;
}

export interface SiteKitContext {
  locale: SiteLocale;
  /** Turns a site path ("/pricing", "/start") into a real link — the live site and the styleguide differ. */
  href: (path: string) => string;
  labels: SiteKitLabels;
  /** Khmio for each kind of business, as the industries grid and menu list them. */
  solutions: SiteSolution[];
  /** Khmio's apps, as the app grid and the hero's app tiles show them. */
  apps: SiteApp[];
  /** Needed only on pages with a Plans section. */
  plans?: SitePlansLabels;
  /** Needed only on pages with a Waitlist section. */
  waitlist?: SiteWaitlistContext;
  /** Turns a picture's src into an address: "library:<id>" points into the picture library (A12). */
  image?: (src: string) => string;
}

export const pick = (text: LocalizedText, locale: SiteLocale) => text[locale];

/** A content link as the browser needs it: https and same-page links as they are, site paths through ctx.href. */
export function resolveSiteHref(href: string, ctx: Pick<SiteKitContext, "href">): string {
  return href.startsWith("https://") || href.startsWith("#") ? href : ctx.href(href);
}

/** Same width and side padding for every section. */
export function SiteContainer({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1160px] px-4 sm:px-6", className)}>{children}</div>;
}

/** Each status's look and word: green "Available", blue "Beta", a quiet "Coming soon". */
const STATUS_STYLE: Record<SiteStatus, { pill: string; dot: string; label: keyof Pick<SiteKitLabels, "available" | "beta" | "comingSoon"> }> = {
  live: { pill: "bg-success/10 text-success", dot: "bg-success", label: "available" },
  beta: { pill: "bg-info/10 text-info", dot: "bg-info", label: "beta" },
  coming_soon: { pill: "bg-border/50 text-muted", dot: "bg-muted", label: "comingSoon" },
};

/** A status as a small pill with a dot. */
export function SiteStatusBadge({ status, labels, className }: { status: SiteStatus; labels: Pick<SiteKitLabels, "available" | "beta" | "comingSoon">; className?: string }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", style.pill, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden="true" />
      {labels[style.label]}
    </span>
  );
}
