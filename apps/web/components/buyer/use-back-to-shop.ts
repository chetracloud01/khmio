"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { backToShopHref, shopFromSearch } from "@/lib/buyer-back";
import { readMyOrders } from "@/lib/my-orders";

/**
 * My orders and Track my order's back arrow (lib/buyer-back.ts): the shop the
 * buyer came from, read once the page is open — the address and this phone's
 * orders are only known in the browser. `shop` is passed on to the other page.
 */
export function useBackToShop(): { href: string; label: string; shop: string | null } {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const [found, setFound] = useState<{ shop: string | null; latest: string | null }>({ shop: null, latest: null });
  useEffect(() => setFound({ shop: shopFromSearch(window.location.search), latest: readMyOrders()[0]?.shopSlug ?? null }), []);
  return { href: backToShopHref(locale, found.shop, found.latest), label: t("backToShop"), shop: found.shop };
}
