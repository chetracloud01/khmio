import type { MetadataRoute } from "next";
import { SITE_PAGE_KEYS } from "@/site/pages";
import { SITE_URL, sitePagePath } from "@/site/url";

// The website's pages, in both languages, for search engines (/sitemap.xml).
// Shops, orders, the app and the admin are not listed.
export default function sitemap(): MetadataRoute.Sitemap {
  return SITE_PAGE_KEYS.flatMap((key) =>
    (["km", "en"] as const).map((locale) => ({
      url: `${SITE_URL}${sitePagePath(key, locale)}`,
      alternates: { languages: { km: `${SITE_URL}${sitePagePath(key, "km")}`, en: `${SITE_URL}${sitePagePath(key, "en")}` } },
      changeFrequency: "weekly" as const,
      priority: key === "home" ? 1 : 0.7,
    })),
  );
}
