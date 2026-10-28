import { SITE_SOLUTION_IDS, solutionPath, type SiteSolutionId } from "@khmio/shared";

// The platform website's pages — fixed facts, not content. A plain module
// (no "use client"), so server pages (the live site, the admin's Preview)
// can read it. Garage first: one page per business solution
// (docs/blueprint.md "Business roadmap"), the home page and pricing.

export const SITE_PAGE_KEYS = ["home", "pricing", ...SITE_SOLUTION_IDS] as const;
export type SitePageKey = (typeof SITE_PAGE_KEYS)[number];

/** Where a page is served, and the solution it's about (its waitlist is for that solution). */
export function sitePageInfo(key: SitePageKey): { path: string; solution?: SiteSolutionId } {
  if (key === "home") return { path: "/" };
  if (key === "pricing") return { path: "/pricing" };
  return { path: solutionPath(key), solution: key };
}

/**
 * Site paths that aren't website pages but lead into the app. "/start" is
 * every "Start free" and "Log in": the Telegram login, then shop set-up.
 */
export const SITE_APP_PATHS = ["/start"] as const;

/** Is there something at this site path today? Links to pages not built yet (Help, Terms…) stay hidden. */
export function siteHasPath(path: string): boolean {
  return (SITE_APP_PATHS as readonly string[]).includes(path) || SITE_PAGE_KEYS.some((key) => sitePageInfo(key).path === path);
}

/** The page at a solution's address ("/solutions/<slug>"), if the website has one. */
export function sitePageForSolution(slug: string): SitePageKey | null {
  return SITE_PAGE_KEYS.find((key) => sitePageInfo(key).path === `/solutions/${slug}`) ?? null;
}
