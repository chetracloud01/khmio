"use client";

import type { WaitlistSignup } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { SiteView } from "@/site/site-view";
import { SITE_PAGE_INFO, useWebsite, type SitePageKey } from "../website-context";

/**
 * Site paths in the content ("/pricing", "/products/class", "/start") become
 * mockup links here. The live site (site/live-site-page.tsx) maps them to
 * khmio.com instead — that is the only difference between the two.
 */
function useSiteHref() {
  const locale = useLocale();
  return (path: string) => {
    if (path === "/start") return `/${locale}/mockup/merchant-login`;
    if (path === "/") return `/${locale}/mockup/site`;
    return `/${locale}/mockup/site${path}`;
  };
}

const WAITLIST_KEY = "khmio:mockup-waitlist";

/** Mockup only: keeps a sign-up on this device. The live site sends it to the API instead. */
async function keepSignupOnDevice(signup: WaitlistSignup) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  try {
    const saved = JSON.parse(window.localStorage.getItem(WAITLIST_KEY) ?? "[]") as unknown[];
    window.localStorage.setItem(WAITLIST_KEY, JSON.stringify([...saved, { ...signup, at: new Date().toISOString() }]));
  } catch {
    // Storage blocked (private window): the thank-you still shows; nothing to keep.
  }
}

/** A website page in the mockup: what the admin published (A10), or the draft in the admin's Preview. */
export function SitePageView({ pageKey, mode = "published" }: { pageKey: SitePageKey; mode?: "published" | "draft" }) {
  const website = useWebsite();
  const t = useTranslations("Site");
  const href = useSiteHref();
  return (
    <SiteView
      page={website.pages[pageKey][mode]}
      product={SITE_PAGE_INFO[pageKey].product}
      href={href}
      image={website.resolveImage}
      waitlist={{ submit: keepSignupOnDevice, note: t("waitlistMockNote") }}
      submitError={() => t("waitlistFailed")}
      live={false}
      note={t("mockNote")}
    />
  );
}
