"use client";

import { getMissingForSharing } from "@khmio/shared";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { ShareShopCard } from "@/components/seller-cards";
import { api } from "@/lib/api";
import { useMerchant } from "./merchant-context";

/**
 * "Share your shop" on the live home page: the shared card
 * (components/seller-cards ShareShopCard) with this shop's link. Sharing, copying or
 * downloading the QR marks the link as shared — the setup checklist's last
 * step. Shown once the shop is ready for buyers (packages/shared
 * getMissingForSharing): before that, the link would lead them to a shop
 * they can't buy from.
 */
export function ShareShop() {
  const locale = useLocale();
  const { store, refreshStore } = useMerchant();
  const ready = getMissingForSharing({ businessType: store.businessType, shopPhone: store.phone, ...store.readiness }).length === 0;
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/${locale}/s/${store.slug}`);
  }, [locale, store.slug]);

  if (!ready) return null;

  async function markShared() {
    if (store.linkShared) return;
    await api("/store/link-shared", { method: "POST" }).catch(() => undefined);
    await refreshStore().catch(() => undefined);
  }

  return <ShareShopCard url={url} shopName={store.name} qrFileName={`${store.slug}-qr.png`} shared={store.linkShared} onShared={() => void markShared()} />;
}
