import { shopSlugSchema } from "@khmio/shared";

// My orders and Track my order serve every Khmio shop, so they learn which
// shop the buyer came from through the address (?shop=<link>) — and send the
// back arrow there (design/screens.md B8).

export const SHOP_PARAM = "shop";

/** A shared buyer page's address, remembering the shop it was opened from. */
export function withShop(href: string, shopSlug: string | null): string {
  return shopSlug ? `${href}?${SHOP_PARAM}=${encodeURIComponent(shopSlug)}` : href;
}

/** The shop link from the address, only when it reads like one — never a path or a full address. */
export function shopFromSearch(search: string): string | null {
  const parsed = shopSlugSchema.safeParse(new URLSearchParams(search).get(SHOP_PARAM) ?? "");
  return parsed.success ? parsed.data : null;
}

/**
 * Where the back arrow goes: the shop in the address; else the shop of this
 * phone's latest order; else Khmio's home page.
 */
export function backToShopHref(locale: string, fromAddress: string | null, latestOrderShop: string | null): string {
  const slug = fromAddress ?? latestOrderShop;
  return slug ? `/${locale}/s/${encodeURIComponent(slug)}` : `/${locale}`;
}
