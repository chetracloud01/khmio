import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { apiBaseUrl, publicShopSchema, type PublicShop } from "@/lib/api";
import { ShopView } from "./shop-view";

// The buyer's shop page (roadmap step 3: read-only — ordering comes with step
// 4). Read on the server, so a link shared on Facebook or Telegram shows the
// shop's name, and a buyer on slow data sees the products in the first page.
async function loadShop(slug: string): Promise<PublicShop | null> {
  const response = await fetch(`${apiBaseUrl()}/public/stores/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`shop page: API answered ${response.status}`);
  return publicShopSchema.parse(await response.json());
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await loadShop(slug).catch(() => null);
  if (!shop) return {};
  const image = shop.store.logoUrl ?? shop.products.find((product) => product.photos[0])?.photos[0]?.url;
  return {
    title: shop.store.name,
    description: shop.store.description || undefined,
    openGraph: { title: shop.store.name, description: shop.store.description || undefined, images: image ? [image] : undefined },
  };
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await loadShop(slug);
  if (!shop) notFound();
  // The open product is read from ?product= in the browser, which needs a Suspense boundary.
  return (
    <Suspense>
      <ShopView shop={shop} />
    </Suspense>
  );
}
