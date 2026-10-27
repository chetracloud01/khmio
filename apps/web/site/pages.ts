import type { PlatformProductId } from "@khmio/shared";

// The platform website's pages — fixed facts, not content. A plain module
// (no "use client"), so server pages (the live site, the admin's Preview)
// can read it.

export const SITE_PAGE_KEYS = ["home", "shop", "class", "rent", "pricing"] as const;
export type SitePageKey = (typeof SITE_PAGE_KEYS)[number];

export const SITE_PAGE_INFO: Record<SitePageKey, { path: string; product?: PlatformProductId }> = {
  home: { path: "/" },
  shop: { path: "/products/shop" },
  class: { path: "/products/class", product: "class" },
  rent: { path: "/products/rent", product: "rent" },
  pricing: { path: "/pricing" },
};

/**
 * Site paths that aren't website pages but lead into the app. "/start" is
 * every "Start free" and "Log in": the Telegram login, then shop set-up.
 */
export const SITE_APP_PATHS = ["/start"] as const;

/** Is there something at this site path today? Links to pages not built yet (Help, Terms…) stay hidden. */
export function siteHasPath(path: string): boolean {
  return (SITE_APP_PATHS as readonly string[]).includes(path) || SITE_PAGE_KEYS.some((key) => SITE_PAGE_INFO[key].path === path);
}

/** The page at a product's address ("/products/<id>"), if the website has one. */
export function sitePageForProduct(product: string): SitePageKey | null {
  return SITE_PAGE_KEYS.find((key) => SITE_PAGE_INFO[key].path === `/products/${product}`) ?? null;
}
