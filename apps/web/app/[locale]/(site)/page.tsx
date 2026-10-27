import { siteMetadata } from "@/site/metadata";
import { LiveSitePage } from "@/site/live-site-page";

// P1. Home (design/screens.md "Platform website"): khmio.com. The content is
// in site/content.ts until the admin can edit it (A10).

// Built ahead of time, refreshed every hour: a promotion appears and ends on time without a deploy.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return siteMetadata("home", (await params).locale);
}

export default function HomePage() {
  return <LiveSitePage pageKey="home" />;
}
