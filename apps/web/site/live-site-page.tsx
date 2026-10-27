"use client";

import type { WaitlistSignup } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { BotCheck, TURNSTILE_SITE_KEY } from "@/components/bot-check";
import { ApiError, apiSend } from "@/lib/api";
import { SITE_PAGES } from "./content";
import { liveSiteHref, liveSiteImage } from "./links";
import { SITE_PAGE_INFO, type SitePageKey } from "./pages";
import { SiteView } from "./site-view";

class BotCheckNotReady extends Error {}

/** A page of the live platform website (khmio.com). */
export function LiveSitePage({ pageKey }: { pageKey: SitePageKey }) {
  const locale = useLocale();
  const t = useTranslations("Site");
  // Each Turnstile token works once: a fresh one is asked for after every try.
  const botToken = useRef<string | null>(null);
  const [botReset, setBotReset] = useState(0);

  async function submit(signup: WaitlistSignup) {
    if (TURNSTILE_SITE_KEY && !botToken.current) throw new BotCheckNotReady();
    try {
      await apiSend("/public/waitlist", { method: "POST", body: { ...signup, ...(botToken.current ? { botCheck: botToken.current } : {}) } });
    } finally {
      setBotReset((count) => count + 1);
    }
  }

  function submitError(error: unknown): string {
    if (error instanceof BotCheckNotReady) return t("waitlistBotCheckWait");
    if (error instanceof ApiError) {
      if (error.status === 0) return t("waitlistOffline");
      if (error.status === 429) return t("waitlistTooMany");
      if (error.code === "bot_check_failed") return t("waitlistBotCheckFailed");
    }
    return t("waitlistFailed");
  }

  return (
    <SiteView
      page={SITE_PAGES[pageKey]}
      product={SITE_PAGE_INFO[pageKey].product}
      href={(path) => liveSiteHref(locale, path)}
      image={liveSiteImage}
      waitlist={{
        submit,
        botCheck: <BotCheck onToken={(token) => (botToken.current = token)} resetKey={botReset} />,
      }}
      submitError={submitError}
      live
    />
  );
}
