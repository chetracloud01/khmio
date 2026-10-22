import { Mio } from "@khmio/ui";
import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// What the installed app shows with no internet (2026-10-22 seller review),
// instead of the browser's own error. The service worker (public/sw.js) keeps
// a copy, so it must work as plain HTML: "Try again" is a link, not a script.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SellerApp" });
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center text-fg">
      <span className="relative">
        <Mio pose="face" size={96} />
        <span className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-canvas bg-warning text-bg">
          <WifiOff className="h-5 w-5" aria-hidden="true" />
        </span>
      </span>
      <h1 className="text-xl font-bold leading-normal">{t("offlineTitle")}</h1>
      <p className="max-w-[34ch] text-sm text-muted">{t("offlineBody")}</p>
      <a href={`/${locale}/m`} className="flex min-h-touch items-center rounded-DEFAULT bg-brand px-5 font-semibold text-on-brand">
        {t("offlineRetry")}
      </a>
    </main>
  );
}
