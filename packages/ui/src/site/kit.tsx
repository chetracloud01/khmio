import type { LocalizedText, PlatformProduct } from "@khmio/shared";
import type { ReactNode } from "react";
import { cn } from "../cn";
import type { SitePlansLabels } from "./PlansSection";
import type { SiteWaitlistContext } from "./WaitlistSection";

// What every site kit section shares: the page's language, its links, the
// fixed words from the translation files, and the same container.

export type SiteLocale = "km" | "en";

/** The site's fixed words, from the translation files — never content. */
export interface SiteKitLabels {
  comingSoon: string;
  learnMore: string;
  joinWaitlist: string;
  startFree: string;
  sample: string;
  mio: string;
}

export interface SiteKitContext {
  locale: SiteLocale;
  /** Turns a site path ("/pricing", "/start") into a real link — the mockup and the live site differ. */
  href: (path: string) => string;
  labels: SiteKitLabels;
  products: PlatformProduct[];
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
  return <div className={cn("mx-auto w-full max-w-[1100px] px-4 sm:px-6", className)}>{children}</div>;
}
