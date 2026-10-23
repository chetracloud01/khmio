"use client";

import { SegmentedControl } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SITE_PAGES } from "@/site/content";
import { liveSiteImage } from "@/site/links";
import { SITE_PAGE_INFO } from "@/site/pages";
import { SiteView } from "@/site/site-view";
import { Demo, Section } from "./styleguide-ui";

/** The website parts in packages/ui/src/site, and which page shows each one. */
const PAGE_PARTS = {
  home: ["AnnouncementBar", "HeroSection", "PromotionSection", "StepsSection", "ProductCardsSection", "FeaturesSection", "SellerStorySection", "ClosingSection"],
  shop: ["HeroSection", "FeaturesSection", "PlansSection", "QuestionsSection", "ClosingSection"],
  class: ["HeroSection", "FeaturesSection", "WaitlistSection"],
  pricing: ["HeroSection", "PlansSection", "FeaturesSection", "ProductCardsSection", "ClosingSection"],
} as const;
type ShownPage = keyof typeof PAGE_PARTS;
/** On every page: the frame around the sections. */
const FRAME_PARTS = ["SiteHeader", "SiteSections", "SiteContainer", "SiteFooter"];

/** Styleguide only: a sign-up is not kept anywhere. */
async function pretendToSave() {
  await new Promise((resolve) => setTimeout(resolve, 600));
}

/** The platform website, drawn by the same SiteView as khmio.com and the website mockups. */
export function WebsiteTab() {
  const t = useTranslations("Styleguide");
  const tSite = useTranslations("Site");
  const [page, setPage] = useState<ShownPage>("home");

  return (
    <Section title={t("websiteTitle")} description={t("websiteHint")}>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <SegmentedControl
          value={page}
          onChange={(next) => setPage(next as ShownPage)}
          options={[
            { value: "home", label: t("websiteHome") },
            { value: "shop", label: t("websiteShop") },
            { value: "class", label: t("websiteComingSoon") },
            { value: "pricing", label: t("websitePricing") },
          ]}
        />
      </div>
      <Demo name={[...FRAME_PARTS, ...PAGE_PARTS[page]]}>
        <div className="overflow-hidden rounded-DEFAULT border border-border">
          <SiteView
            page={SITE_PAGES[page]}
            product={SITE_PAGE_INFO[page].product}
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
