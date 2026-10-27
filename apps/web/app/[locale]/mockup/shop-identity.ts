"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { mockInvoiceDetails, mockStore } from "@/mock/mock-data";
import { useDeliverySettings } from "./delivery-settings-context";
import { useMerchantProfile } from "./merchant-profile-context";

/**
 * Who the shop is, as buyers see it: the seller's own profile once they've
 * onboarded, the sample shop before that. Every buyer screen reads this, so
 * the name on the shop page, the cart, the KHQR card and the invoice always
 * agree. Address, map link and "On your invoices" (VAT TIN, Telegram,
 * Facebook, note) come from Shop details (design/screens.md S10); the
 * address is the pickup address, as on the live shop.
 */
export function useShopIdentity() {
  const locale = useLocale();
  const profile = useMerchantProfile();
  const { settings: delivery } = useDeliverySettings();
  // One object per change, so screens can list it as a memo dependency.
  return useMemo(() => {
    const name = profile.hasProfile ? profile.shopName : locale === "km" ? mockStore.nameKm : mockStore.nameEn;
    const invoice = profile.hasProfile ? profile.invoiceDetails : mockInvoiceDetails;
    return {
      hydrated: profile.hydrated,
      name,
      initial: name.charAt(0),
      logoDataUrl: profile.hasProfile ? profile.logoDataUrl : null,
      /** 855XXXXXXXX, or "" when the seller hasn't given one. */
      phone: profile.hasProfile ? profile.phone : mockStore.phone,
      address: delivery.pickup.address,
      // The sample shop has no map link: its Map button searches for the address.
      mapUrl: profile.hasProfile ? profile.mapUrl : "",
      taxNumber: invoice.taxNumber,
      telegram: invoice.telegramLink,
      facebook: invoice.facebookLink,
      invoiceNote: invoice.invoiceNote,
    };
  }, [locale, profile, delivery.pickup.address]);
}
