import { SITE_SOLUTION_IDS, solutionPath } from "@khmio/shared";
import { notFound } from "next/navigation";
import { siteMetadata } from "@/site/metadata";
import { LiveSitePage } from "@/site/live-site-page";
import { sitePageForSolution } from "@/site/pages";

// One page per business solution (docs/blueprint.md "Business roadmap"): the
// garage's, which is live, and the coming-soon ones with their waitlist.

type Params = Promise<{ locale: string; solution: string }>;

export function generateStaticParams() {
  return SITE_SOLUTION_IDS.map((id) => ({ solution: solutionPath(id).split("/").pop() ?? id }));
}

// Built ahead of time, refreshed every hour: a promotion appears and ends on time without a deploy.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, solution } = await params;
  const pageKey = sitePageForSolution(solution);
  return pageKey ? siteMetadata(pageKey, locale) : {};
}

export default async function SolutionPage({ params }: { params: Params }) {
  const pageKey = sitePageForSolution((await params).solution);
  if (!pageKey) notFound();
  return <LiveSitePage pageKey={pageKey} />;
}
