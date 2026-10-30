"use client";

import { buttonVariants, EmptyState } from "@khmio/ui";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

/** A bill that isn't this shop's (or a mistyped address): its page and its printouts. */
export function PurchaseNotFound() {
  const t = useTranslations("Purchases");
  const locale = useLocale();
  return (
    <EmptyState
      title={t("notFound")}
      action={
        <Link href={`/${locale}/m/purchases`} className={buttonVariants({ variant: "secondary" })}>
          {t("title")}
        </Link>
      }
    />
  );
}
