"use client";

import { visibleSections, type PlatformProductId, type SitePage, type SiteSection } from "@khmio/shared";
import { AnnouncementBar, SiteFooter, SiteHeader, SiteSections, type SiteKitContext, type SiteWaitlistContext } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitch } from "@/components/language-switch";
import { useFormErrorText } from "@/components/form-ui";
import { SITE_PRODUCTS } from "./content";
import { siteHasPath } from "./pages";

export interface SiteViewProps {
  page: SitePage;
  /** The product a coming-soon page collects waitlist sign-ups for. */
  product?: PlatformProductId;
  /** Turns a site path ("/pricing", "/start") into a link: the live site and the mockup differ. */
  href: (path: string) => string;
  /** Turns a picture's src ("library:<id>") into an address. */
  image: (src: string) => string;
  /** How a waitlist sign-up is saved, and the bot check shown with the form. */
  waitlist?: Pick<SiteWaitlistContext, "submit" | "note" | "botCheck">;
  /** What went wrong when a sign-up couldn't be saved. */
  submitError: (error: unknown) => string;
  /**
   * The live site: links to pages not built yet (Help, Terms…) stay hidden,
   * and so does a seller story marked as a sample. The mockup shows both.
   */
  live: boolean;
  /** A line under the footer (the mockup's note). */
  note?: string;
}

/** A seller story is shown on the live site only when it's a real seller's, given with their permission. */
function showsOnLiveSite(section: SiteSection): boolean {
  return section.type !== "sellerStory" || !section.sample;
}

/**
 * One platform website page: the announcement bar, header, the page's
 * sections and the footer. The live site (khmio.com) and the website
 * mockups both draw pages with this, so they always look the same.
 */
export function SiteView({ page, product, href, image, waitlist, submitError, live, note }: SiteViewProps) {
  const t = useTranslations("Site");
  const errorText = useFormErrorText();
  const tMascot = useTranslations("Mascot");
  const tPlans = useTranslations("Plans");
  const tBilling = useTranslations("Billing");
  const locale = useLocale() === "en" ? "en" : "km";
  const shown = (path: string) => !live || siteHasPath(path);

  const sections = visibleSections(page, new Date()).filter((section) => !live || showsOnLiveSite(section));
  const announcement = sections.find((section) => section.type === "announcement");

  const ctx: SiteKitContext = {
    locale,
    href,
    products: SITE_PRODUCTS,
    image,
    labels: {
      comingSoon: t("comingSoon"),
      learnMore: t("learnMore"),
      joinWaitlist: t("joinWaitlist"),
      startFree: t("startFree"),
      sample: t("sample"),
      mio: tMascot("label"),
    },
    // The app's own plan wording, so the site and the billing screen always match.
    plans: {
      names: { free: tPlans("free"), basic: tPlans("basic"), pro: tPlans("pro"), advance: tPlans("advance") },
      perMonth: tBilling("perMonth"),
      usd: t("currencyUsd"),
      khr: t("currencyKhr"),
      productLimit: (count) => tBilling("featureProductLimit", { count }),
      unlimitedProducts: tBilling("featureUnlimitedProducts"),
      trial: (count) => tBilling("trialLength", { count }),
      features: { stock: tBilling("featureStock"), wholesalePrice: tBilling("featureWholesale"), warehouses: tBilling("featureWarehouses") },
      highlight: t("mostShops"),
      included: t("included"),
      notIncluded: t("notIncluded"),
      compareTitle: t("compareTitle"),
      compareFeature: t("compareFeature"),
      comparePrice: t("comparePrice"),
      compareProducts: t("compareProducts"),
      compareTrial: t("compareTrial"),
      unlimited: t("compareUnlimited"),
      none: t("compareNone"),
      days: (count) => t("compareDays", { count }),
    },
    waitlist: product &&
      waitlist && {
        product,
        ...waitlist,
        labels: {
          name: t("waitlistName"),
          phone: t("waitlistPhone"),
          businessType: t("waitlistBusiness"),
          choose: t("waitlistChoose"),
          businessTypes: { teacher: t("waitlistTeacher"), school: t("waitlistSchool"), landlord: t("waitlistLandlord"), other: t("waitlistOther") },
          submit: t("waitlistSubmit"),
          privacy: t("waitlistPrivacy"),
          errorText: (code) => errorText(code) ?? "",
          submitError,
        },
      },
  };

  const languageSwitch = (
    <LanguageSwitch />
  );
  const link = (label: string, path: string) => ({ label, href: href(path), path });
  const onlyShown = <T extends { path: string }>(links: T[]) => links.filter((entry) => shown(entry.path)).map(({ path: _path, ...rest }) => rest);
  const footerGroups = [
    { title: t("footerProducts"), links: onlyShown(SITE_PRODUCTS.map((entry) => link(entry.name, `/products/${entry.id}`))) },
    {
      title: t("footerKhmio"),
      links: [...onlyShown([link(t("pricing"), "/pricing"), link(t("help"), "/help")]), { label: t("contact"), href: "https://t.me/khmio_support" }],
    },
    { title: t("footerLegal"), links: onlyShown([link(t("terms"), "/terms"), link(t("privacy"), "/privacy")]) },
  ].filter((group) => group.links.length > 0);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      {announcement?.type === "announcement" && <AnnouncementBar section={announcement} ctx={ctx} />}
      <SiteHeader
        homeHref={href("/")}
        links={onlyShown([link(t("products"), "/products/shop"), link(t("pricing"), "/pricing"), link(t("help"), "/help")])}
        login={{ label: t("logIn"), href: href("/start") }}
        start={{ label: t("startFree"), href: href("/start") }}
        languageSwitch={languageSwitch}
        labels={{ openMenu: t("openMenu"), closeMenu: t("closeMenu"), home: t("home"), nav: t("nav") }}
      />
      <main className="flex-1">
        <SiteSections sections={sections} ctx={ctx} />
      </main>
      <SiteFooter homeHref={href("/")} tagline={t("tagline")} copyright={t("copyright")} groups={footerGroups} />
      {note && <p className="bg-canvas px-4 pb-4 text-center text-xs text-muted">{note}</p>}
    </div>
  );
}
