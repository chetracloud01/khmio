"use client";

import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

/** "← My shop" over pages reached from the My shop menu (Delivery, Store settings), on a laptop and a phone alike. */
export function BackToMyShop() {
  const t = useTranslations("App");
  const locale = useLocale();
  return (
    <Link href={`/${locale}/m/settings`} className="-ml-2 flex min-h-touch w-fit items-center gap-2 rounded-full px-2 text-sm font-medium text-brand hover:bg-brand/5">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t("navShop")}
    </Link>
  );
}
