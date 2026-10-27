"use client";

import { shopMapLink, socialLinkUrl } from "@khmio/shared";
import type { ActionTile } from "@khmio/ui";
import { Facebook, MapPin, Phone, Send } from "lucide-react";
import { useTranslations } from "next-intl";

export interface ShopContactDetails {
  /** 855XXXXXXXX, or "". */
  phone: string;
  address: string;
  /** Copied from Google Maps on Shop details; "" = search for the address instead. */
  mapUrl: string;
  /** As the seller typed them under "On your invoices" (design/screens.md S10). */
  telegram: string;
  facebook: string;
}

/**
 * The Shop info sheet's round buttons — Call, Map, Telegram, Facebook, each
 * opening the phone's own app — the same on the live shop and its mockup.
 * Anything the seller left empty is left out.
 */
export function useShopContacts(shop: ShopContactDetails): ActionTile[] {
  const t = useTranslations("Storefront");
  const mapUrl = shopMapLink(shop.mapUrl, shop.address);
  const telegramUrl = socialLinkUrl("telegram", shop.telegram);
  const facebookUrl = socialLinkUrl("facebook", shop.facebook);
  return [
    ...(shop.phone ? [{ key: "call", icon: Phone, label: t("actionCall"), href: `tel:+${shop.phone}` }] : []),
    ...(mapUrl ? [{ key: "map", icon: MapPin, label: t("actionMap"), href: mapUrl, external: true }] : []),
    ...(telegramUrl ? [{ key: "telegram", icon: Send, label: t("actionTelegram"), look: "telegram" as const, href: telegramUrl, external: true }] : []),
    ...(facebookUrl ? [{ key: "facebook", icon: Facebook, label: t("actionFacebook"), href: facebookUrl, external: true }] : []),
  ];
}
