"use client";

import { SegmentedControl } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SITE_PAGES } from "@/site/content";
import { liveSiteImage } from "@/site/links";
import { SiteView } from "@/site/site-view";
import { SAMPLE_SITE_PAGE } from "./samples";
import { Demo, Section } from "./styleguide-ui";

/** The website parts in packages/ui/src/site, and which page shows each one. */
const PAGE_PARTS = {
  home: ["HeroSection", "AppsSection", "ComparisonSection", "SolutionsSection", "SiteStatusBadge", "StepsSection", "PlansSection", "QuestionsSection", "ClosingSection"],
  garage: ["HeroSection", "FeaturesSection", "StepsSection", "PlansSection", "QuestionsSection", "ClosingSection"],
  beta: ["HeroSection", "FeaturesSection", "ClosingSection"],
  pricing: ["HeroSection", "PlansSection", "FeaturesSection", "ClosingSection"],
  legal: ["DocumentSection", "ClosingSection"],
  more: ["AnnouncementBar", "PromotionSection", "SellerStorySection", "WaitlistSection"],
} as const;
type ShownPage = keyof typeof PAGE_PARTS;
const SHOWN_PAGES: readonly ShownPage[] = ["home", "garage", "beta", "pricing", "legal", "more"];
/** What each choice draws: the live pages, and the sample page for sections no page uses yet. */
const PAGE_CONTENT = { home: SITE_PAGES.home, garage: SITE_PAGES.garage, beta: SITE_PAGES.auto_parts, pricing: SITE_PAGES.pricing, legal: SITE_PAGES.terms, more: SAMPLE_SITE_PAGE };
/** On every page: the frame around the sections. */
const FRAME_PARTS = ["SiteHeader", "SiteSections", "SiteContainer", "SiteFooter"];

/** Styleguide only: a sign-up is not kept anywhere. */
async function pretendToSave() {
  await new Promise((resolve) => setTimeout(resolve, 600));
}

/** The platform website, drawn by the same SiteView as khmio.com. */
export function WebsiteTab() {
  const t = useTranslations("Styleguide");
  const tSite = useTranslations("Site");
  const [page, setPage] = useState<ShownPage>("home");

  return (
    <Section title={t("websiteTitle")} description={t("websiteHint")}>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <SegmentedControl
          value={page}
          onChange={(next) => {
            const shown = SHOWN_PAGES.find((key) => key === next);
            if (shown) setPage(shown);
          }}
          options={[
            { value: "home", label: t("websiteHome") },
            { value: "garage", label: t("websiteGarage") },
            { value: "beta", label: t("websiteBeta") },
            { value: "pricing", label: t("websitePricing") },
            { value: "legal", label: t("websiteLegal") },
            { value: "more", label: t("websiteMore") },
          ]}
        />
      </div>
      <Demo name={[...FRAME_PARTS, ...PAGE_PARTS[page]]}>
        <div className="overflow-hidden rounded-DEFAULT border border-border">
          <SiteView
            page={PAGE_CONTENT[page]}
            href={() => "#"}
            image={liveSiteImage}
            waitlist={{ submit: pretendToSave, note: tSite("waitlistMockNote") }}
            submitError={() => tSite("waitlistFailed")}
            live={false}
          />
        </div>
      </Demo>
    </Section>
  );
}
