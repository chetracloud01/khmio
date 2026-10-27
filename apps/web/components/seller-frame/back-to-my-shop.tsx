"use client";

import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

/** "← <page>" over a page reached from another (a menu, a list), on a laptop and a phone alike. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="-ml-2 flex min-h-touch w-fit items-center gap-2 rounded-full px-2 text-sm font-medium text-brand hover:bg-brand/5">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

/** Where "← My shop" goes: the My shop menu. */
export function useMyShopBack(): { href: string; label: string } {
  const t = useTranslations("App");
  const locale = useLocale();
  return { href: `/${locale}/m/settings`, label: t("navShop") };
}

/** "← My shop" over pages reached from the My shop menu (Delivery, Store settings …). */
export function BackToMyShop() {
  return <BackLink {...useMyShopBack()} />;
}
