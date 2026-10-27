"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { OfflineScreen } from "@/components/seller-app";

// What the installed app shows with no internet (2026-10-22 seller review),
// instead of the browser's own error page.
export default function OfflineMockupPage() {
  const t = useTranslations("SellerApp");
  const locale = useLocale();
  return (
    <OfflineScreen
      onRetry={() => window.location.reload()}
      extra={
        <Link href={`/${locale}/mockup/dashboard`} className="flex min-h-touch items-center text-sm font-medium text-brand">
          {t("close")}
        </Link>
      }
    />
  );
}
