"use client";

import { Button, buttonVariants, Mio } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect } from "react";

// Shown when a page can't be drawn — most often the API is unreachable for a
// moment (a deploy, a short outage) while the shop or order page loads.
// Instead of a bare server error, the buyer gets a calm message and a retry.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("ErrorPage");
  const tMascot = useTranslations("Mascot");
  const locale = useLocale();

  useEffect(() => {
    // The digest links this to the server's own log line; never the error's details on screen.
    console.error("page error", error.digest ?? "");
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center text-fg">
      <Mio size={112} label={tMascot("label")} />
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="max-w-sm text-sm text-muted">{t("body")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>{t("retry")}</Button>
        <Link href={`/${locale}`} className={buttonVariants({ variant: "secondary" })}>
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
