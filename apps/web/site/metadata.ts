import type { Metadata } from "next";
import { SITE_PAGES } from "./content";
import { liveSiteImage } from "./links";
import type { SitePageKey } from "./pages";
import { sitePagePath } from "./url";

/**
 * A website page's title, description and link preview (Facebook, Telegram,
 * search), in the page's language, with the address of the other language.
 * The preview picture is the page's own, or the Khmio card next to the page.
 */
export function siteMetadata(pageKey: SitePageKey, requested: string): Metadata {
  const locale = requested === "en" ? "en" : "km";
  const { seo } = SITE_PAGES[pageKey];
  const title = seo.title[locale];
  const description = seo.description[locale];
  const image = seo.image ? { url: liveSiteImage(seo.image.src), alt: seo.image.alt[locale] } : undefined;
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: sitePagePath(pageKey, locale),
      languages: { km: sitePagePath(pageKey, "km"), en: sitePagePath(pageKey, "en"), "x-default": sitePagePath(pageKey, "km") },
    },
    openGraph: {
      type: "website",
      siteName: "Khmio",
      title,
      description,
      url: sitePagePath(pageKey, locale),
      locale: locale === "km" ? "km_KH" : "en_US",
      ...(image ? { images: [image] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
