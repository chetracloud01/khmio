import { PLATFORM_PRODUCT_IDS } from "@khmio/shared";
import { notFound } from "next/navigation";
import { siteMetadata } from "@/site/metadata";
import { LiveSitePage } from "@/site/live-site-page";
import { sitePageForProduct } from "@/site/pages";

// P2 (Khmio Shop) and P3 (coming soon, with the waitlist): one page per platform product.

type Params = Promise<{ locale: string; product: string }>;

export function generateStaticParams() {
  return PLATFORM_PRODUCT_IDS.map((product) => ({ product }));
}

// Built ahead of time, refreshed every hour: a promotion appears and ends on time without a deploy.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, product } = await params;
  const pageKey = sitePageForProduct(product);
  return pageKey ? siteMetadata(pageKey, locale) : {};
}

export default async function ProductPage({ params }: { params: Params }) {
  const pageKey = sitePageForProduct((await params).product);
  if (!pageKey) notFound();
  return <LiveSitePage pageKey={pageKey} />;
}
