"use client";

import { Button } from "@khmio/ui";
import { CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LanguageSwitch } from "@/components/language-switch";

/** The narrow, phone-first column every real merchant page sits in, with the language switch. */
export function AppFrame({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas text-fg">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 bg-bg p-4 pb-10 md:border-x md:border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">{aside}</div>
          <LanguageSwitch />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Grey blocks while the first answer from the API is on its way. */
export function AppLoading() {
  const t = useTranslations("App");
  return (
    <AppFrame>
      <div className="flex flex-col gap-3" aria-busy="true">
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <div className="h-7 w-48 animate-pulse rounded-DEFAULT bg-border/40 motion-reduce:animate-none" />
        <div className="h-32 animate-pulse rounded-2xl bg-border/40 motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-2xl bg-border/40 motion-reduce:animate-none" />
      </div>
    </AppFrame>
  );
}

/** The API can't be reached: say so plainly and offer to try again. */
export function AppOffline({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("App");
  return (
    <AppFrame>
      <div className="flex flex-col items-center gap-3 py-16 text-center" role="alert">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-border/30">
          <CloudOff className="h-7 w-7 text-muted" aria-hidden="true" />
        </span>
        <p className="font-semibold">{t("offlineTitle")}</p>
        <p className="max-w-[32ch] text-sm text-muted">{t("offlineBody")}</p>
        <Button variant="primary" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    </AppFrame>
  );
}
