import { SITE_PAGE_INFO, type SitePageKey } from "./pages";

/**
 * The website's public address, for link previews, the sitemap and search
 * engines (NEXT_PUBLIC_SITE_URL, e.g. https://khmio.com). Pages themselves
 * use relative links, so the site also works on any other address.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** A page's address in one language: "/km", "/en/pricing". */
export function sitePagePath(pageKey: SitePageKey, locale: string): string {
  const path = SITE_PAGE_INFO[pageKey].path;
  return `/${locale}${path === "/" ? "" : path}`;
}
