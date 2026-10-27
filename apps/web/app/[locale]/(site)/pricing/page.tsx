import { siteMetadata } from "@/site/metadata";
import { LiveSitePage } from "@/site/live-site-page";

// P4. Pricing: the plans and prices come from packages/shared/plans.ts, never from content.

// Built ahead of time, refreshed every hour: a promotion appears and ends on time without a deploy.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return siteMetadata("pricing", (await params).locale);
}

export default function PricingPage() {
  return <LiveSitePage pageKey="pricing" />;
}
