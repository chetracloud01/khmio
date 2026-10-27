import { notFound } from "next/navigation";
import { SITE_PAGE_KEYS, type SitePageKey } from "../../../site-pages";
import { SitePageView } from "../../site-shell";

// The admin's Preview (A10): a page's draft exactly as visitors would see it, before it's published.
export default function SitePreviewMockupPage({ params }: { params: { page: string } }) {
  const key = SITE_PAGE_KEYS.find((candidate) => candidate === params.page);
  if (!key) notFound();
  return <SitePageView pageKey={key satisfies SitePageKey} mode="draft" />;
}
