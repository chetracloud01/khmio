"use client";

import { ACCENT_SWATCHES, Button, PageHeader, readStoredTheme, type Accent, type ThemeMode } from "@khmio/ui";
import { Languages, LogOut, Palette, ReceiptText, Send, SlidersHorizontal, Store, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuList } from "@/components/menu-list";
import { SELLER_FORM } from "@/components/seller-frame/seller-frame";
import { useThemeLabels } from "@/components/use-theme-labels";
import { api } from "@/lib/api";

// "My shop": the shop's settings in two groups, on a laptop and a phone alike.
// "Your shop" (shop details, delivery, store settings, invoices, Telegram
// alerts) and "Language & display" (this device's language and theme, with
// the current choice shown), each row opening its own page. Sign out at the bottom.
export default function MyShopPage() {
  const t = useTranslations("DashboardProfile");
  const tApp = useTranslations("App");
  const tInvoiceSettings = useTranslations("InvoiceSettings");
  const themeLabels = useThemeLabels();
  const locale = useLocale();
  const router = useRouter();
  const base = `/${locale}/m`;
  // Saved on this device, so read after the page loads (the server can't know it).
  const [theme, setTheme] = useState<{ mode: ThemeMode; accent: Accent } | null>(null);
  useEffect(() => setTheme(readStoredTheme()), []);

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace(`/${locale}/m/login`);
  }

  return (
    <div className={`${SELLER_FORM} gap-5`}>
      <PageHeader title={tApp("navShop")} />

      <MenuList
        title={t("sectionShop")}
        rows={[
          { key: "shop-details", href: `${base}/shop-details`, icon: Store, tone: "brand", title: tApp("shopDetailsTitle"), detail: t("shopDetailsDetail") },
          { key: "delivery", href: `${base}/delivery`, icon: Truck, tone: "info", title: t("delivery"), detail: t("deliveryDetail") },
          { key: "store-settings", href: `${base}/store-settings`, icon: SlidersHorizontal, tone: "brand", title: t("storeSettings"), detail: t("storeSettingsDetail") },
          { key: "invoice-settings", href: `${base}/invoice-settings`, icon: ReceiptText, tone: "success", title: tInvoiceSettings("title"), detail: t("invoiceSettingsDetail") },
          { key: "telegram-alerts", href: `${base}/telegram-alerts`, icon: Send, tone: "warning", title: t("telegramAlerts"), detail: t("telegramAlertsDetail") },
        ]}
      />

      <MenuList
        title={t("languageAndDisplay")}
        rows={[
          { key: "language", href: `${base}/display`, icon: Languages, tone: "brand", title: t("language"), detail: t("languageDetail"), value: locale === "km" ? "ខ្មែរ" : "English" },
          {
            key: "theme",
            href: `${base}/display`,
            icon: Palette,
            tone: "info",
            title: t("display"),
            detail: t("displayDetail"),
            value: theme && (
              <>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: ACCENT_SWATCHES[theme.accent] }} aria-hidden="true" />
                {themeLabels[theme.mode]}
              </>
            ),
          },
        ]}
      />

      <Button variant="secondary" className="self-start" onClick={() => void signOut()}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {tApp("signOut")}
      </Button>
    </div>
  );
}
