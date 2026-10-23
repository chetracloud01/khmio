"use client";

import { getMissingForSharing } from "@khmio/shared";
import { BottomSheet, Button } from "@khmio/ui";
import { Lock, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SharedPill, ShareShopPanel } from "@/components/seller-cards";
import { HEADER_PILL, HEADER_PILL_TEXT } from "@/components/seller-frame/seller-frame";
import { api } from "@/lib/api";
import { useMerchant } from "./merchant-context";

/**
 * "Share your shop" on the live dashboard: one sheet (components/seller-cards
 * ShareShopPanel) opened from the header's Share button, Home's "Share shop"
 * quick action and the setup checklist's last step. Sharing, copying or
 * downloading the QR marks the link as shared — that step. Until the shop is
 * ready for buyers (packages/shared getMissingForSharing) the sheet says so
 * instead: the link would lead them to a shop they can't buy from.
 */
const ShareShopContext = createContext<{ open: () => void } | null>(null);

export function useShareShop(): { open: () => void } {
  const context = useContext(ShareShopContext);
  if (!context) throw new Error("useShareShop needs ShareShopProvider");
  return context;
}

export function ShareShopProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const t = useTranslations("Share");
  const tApp = useTranslations("SellerApp");
  const { store, refreshStore } = useMerchant();
  const ready =
    getMissingForSharing({
      businessType: store.businessType,
      shopPhone: store.phone,
      ...store.readiness,
    }).length === 0;
  const [isOpen, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/${locale}/s/${store.slug}`);
  }, [locale, store.slug]);

  async function markShared() {
    if (store.linkShared) return;
    await api("/store/link-shared", { method: "POST" }).catch(() => undefined);
    await refreshStore().catch(() => undefined);
  }

  const open = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <ShareShopContext.Provider value={value}>
      {children}
      <BottomSheet open={isOpen} onClose={() => setOpen(false)} closeLabel={tApp("close")} title={t("title")}>
        <div className="flex flex-col gap-4 pb-2">
          {ready ? (
            <>
              {store.linkShared && <SharedPill />}
              <ShareShopPanel url={url} shopName={store.name} qrFileName={`${store.slug}-qr.png`} onShared={() => void markShared()} />
            </>
          ) : (
            <p className="flex items-center gap-2 rounded-2xl bg-warning/10 px-4 py-3 text-sm text-warning">
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("notReady")}
            </p>
          )}
        </div>
      </BottomSheet>
    </ShareShopContext.Provider>
  );
}

/** The header's Share button: a teal "Share" pill on a phone (a round icon once the header turns slim), a text button in the laptop's top bar. */
export function ShareShopButton({ variant }: { variant: "round" | "bar" }) {
  const t = useTranslations("Share");
  const tApp = useTranslations("SellerApp");
  const { open } = useShareShop();
  if (variant === "round") {
    return (
      // eslint-disable-next-line no-restricted-syntax -- the seller header's pill (HEADER_PILL), which shrinks to a round icon when the header turns slim
      <button type="button" onClick={open} className={HEADER_PILL}>
        <Share2 className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <span className={HEADER_PILL_TEXT}>{tApp("headerShare")}</span>
      </button>
    );
  }
  return (
    <Button variant="ghost" onClick={open}>
      <Share2 className="h-4 w-4" aria-hidden="true" />
      {t("shareShop")}
    </Button>
  );
}
