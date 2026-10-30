import { notFound } from "next/navigation";
import { siteMetadata } from "@/site/metadata";
import { LiveSitePage } from "@/site/live-site-page";
import { sitePageForTop, TOP_PAGES } from "@/site/pages";

// The website's top-level pages — pricing, help, the terms and the privacy
// policy (site/pages.ts TOP_PAGES): one route for all of them. Any other
// address here is not found; the app's own folders (/m, /admin, /s…) always
// win over this route. Prices come from packages/shared/plans.ts, never from content.

type Params = Promise<{ locale: string; page: string }>;

export function generateStaticParams() {
  return TOP_PAGES.map((page) => ({ page }));
}

/** Only the pages listed: anything else is a 404, never rendered on demand. */
export const dynamicParams = false;

// Built ahead of time, refreshed every hour: a promotion appears and ends on time without a deploy.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, page } = await params;
  const pageKey = sitePageForTop(page);
  return pageKey ? siteMetadata(pageKey, locale) : {};
}

export default async function TopSitePage({ params }: { params: Params }) {
  const pageKey = sitePageForTop((await params).page);
  if (!pageKey) notFound();
  return <LiveSitePage pageKey={pageKey} />;
}
