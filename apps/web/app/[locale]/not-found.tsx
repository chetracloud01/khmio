"use client";

import { buttonVariants, Mio } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

// Shown for any notFound() under a language — a shop link that no longer
// works, an unknown order, a mistyped address. Without it Next.js drew its own
// page with a second <html> inside this layout's, and buyers saw a blank screen.
export default function NotFoundPage() {
  const t = useTranslations("NotFound");
  const tMascot = useTranslations("Mascot");
  const locale = useLocale();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center text-fg">
      <Mio size={112} label={tMascot("label")} />
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="max-w-sm text-sm text-muted">{t("body")}</p>
      <Link href={`/${locale}`} className={buttonVariants({ variant: "primary" })}>
        {t("home")}
      </Link>
    </main>
  );
}
