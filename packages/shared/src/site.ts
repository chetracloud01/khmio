import { z } from "zod";
import { khmerPhoneSchema } from "./phone";

// The platform website's content (design/screens.md "Platform website"):
// every page is a list of sections from one fixed site kit. The admin edits
// the content of these sections (A10–A12); the code always decides how they
// look. Each schema checks what the admin types and, later, builds its form.
// Problems are form error codes, like every other form.

/** Text the admin types, always in both languages. */
export const localizedTextSchema = (max: number) =>
  z.object({
    km: z.string().trim().min(1, "required").max(max, "too_long"),
    en: z.string().trim().min(1, "required").max(max, "too_long"),
  });
export type LocalizedText = z.infer<ReturnType<typeof localizedTextSchema>>;

/** A site page ("/pricing"), a place on the same page ("#waitlist") or an https address; nothing else (no javascript:, no http). */
export const siteLinkHrefSchema = z
  .string()
  .trim()
  .refine((href) => /^\/[a-z0-9\-/]*$/.test(href) || /^#[a-z0-9-]+$/.test(href) || /^https:\/\/[^\s]+$/.test(href), "link_invalid");

export const siteLinkSchema = z.object({
  label: localizedTextSchema(40),
  href: siteLinkHrefSchema,
});
export type SiteLink = z.infer<typeof siteLinkSchema>;

/** A picture: where it is, and what it shows for screen readers and search, in both languages. */
export const siteImageSchema = z.object({
  src: z.string().trim().min(1, "required"),
  alt: localizedTextSchema(160),
});
export type SiteImage = z.infer<typeof siteImageSchema>;

export const MIO_POSES = ["face", "coin"] as const;

/** Icons a section may show; the code maps each name to one drawing. */
export const SITE_ICONS = [
  "store", "share", "qr", "bell", "truck", "boxes", "building", "shield", "clock", "language", "list", "heart",
  "wrench", "car", "smartphone", "coffee", "scissors", "shirt", "receipt", "chart", "users",
  "percent", "calendar", "utensils", "layers",
] as const;
export type SiteIcon = (typeof SITE_ICONS)[number];

// ---------------------------------------------------------- business solutions

/**
 * Where something on the website stands. "live": ready and well tested;
 * "beta": anyone can start free, still being tested with real sellers;
 * "coming_soon": not built yet (never a date) — a solution then collects
 * waitlist sign-ups.
 */
export const SITE_STATUSES = ["live", "beta", "coming_soon"] as const;
export const siteStatusSchema = z.enum(SITE_STATUSES);
export type SiteStatus = z.infer<typeof siteStatusSchema>;

/** A tile's colour: one of the theme's tones, never a raw colour. */
export const SITE_TONES = ["brand", "info", "success", "warning", "danger"] as const;

/**
 * Khmio for each kind of business (docs/blueprint.md "Business roadmap"), as
 * the website lists them (its Industries).
 */
export const SITE_SOLUTION_IDS = ["garage", "auto_parts", "phone", "cafe", "salon", "retail"] as const;
export const siteSolutionIdSchema = z.enum(SITE_SOLUTION_IDS);
export type SiteSolutionId = z.infer<typeof siteSolutionIdSchema>;

export const siteSolutionSchema = z.object({
  id: siteSolutionIdSchema,
  name: localizedTextSchema(40),
  line: localizedTextSchema(200),
  /** The kinds of shop it covers ("Car wash", "Tyre & oil"), shown as small tags. */
  covers: z.array(localizedTextSchema(32)).max(6),
  status: siteStatusSchema,
  icon: z.enum(SITE_ICONS),
});
export type SiteSolution = z.infer<typeof siteSolutionSchema>;

/**
 * Khmio's apps — the parts of the one app a business switches on (online
 * shop, counter sales, stock, job cards…), as the website's app grid lists
 * them. What each does and whether it's ready; they have no pages of their own.
 */
export const siteAppSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]+$/, "slug_invalid").max(40, "too_long"),
  name: localizedTextSchema(32),
  line: localizedTextSchema(120),
  status: z.enum(["live", "coming_soon"]),
  icon: z.enum(SITE_ICONS),
  tone: z.enum(SITE_TONES),
  /** A plan it needs beyond the free one ("Pro"), shown as a small mark. */
  plan: z.enum(["basic", "pro", "advance"]).optional(),
});
export type SiteApp = z.infer<typeof siteAppSchema>;

/** A solution's page address: "/solutions/auto-parts". */
export function solutionPath(id: SiteSolutionId): string {
  return `/solutions/${id.replace(/_/g, "-")}`;
}

const sectionBase = {
  id: z.string().trim().min(1, "required").max(40, "too_long"),
  visible: z.boolean(),
};

export const announcementSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("announcement"),
  text: localizedTextSchema(120),
  link: siteLinkSchema.optional(),
});

export const heroSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("hero"),
  eyebrow: localizedTextSchema(60).optional(),
  headline: localizedTextSchema(80),
  sentence: localizedTextSchema(200),
  /** A picture, Mio in one of the poses, or Mio among the app tiles (from the app list). */
  art: z.union([
    z.object({ kind: z.literal("mio"), pose: z.enum(MIO_POSES) }),
    z.object({ kind: z.literal("image"), image: siteImageSchema }),
    z.object({ kind: z.literal("apps") }),
  ]),
  primary: siteLinkSchema,
  secondary: siteLinkSchema.optional(),
  /** Short facts floating beside the art ("Job card · Toyota Camry"), at most three. */
  highlights: z.array(localizedTextSchema(48)).max(3).optional(),
  /** Small trust points under the buttons ("KHQR", "Telegram alerts"). */
  trust: z.array(z.object({ icon: z.enum(SITE_ICONS), text: localizedTextSchema(40) })).max(4).optional(),
});

export const stepsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("steps"),
  title: localizedTextSchema(80),
  steps: z
    .array(z.object({ icon: z.enum(SITE_ICONS), title: localizedTextSchema(60), line: localizedTextSchema(160) }))
    .min(3, "too_short")
    .max(4, "too_long"),
});

/** Every app as a tile, from the app list (never typed here). */
export const appsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("apps"),
  title: localizedTextSchema(80),
  intro: localizedTextSchema(200).optional(),
});

/** Side by side: "big business software" and Khmio, row by row. Never names a company. */
export const comparisonSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("comparison"),
  title: localizedTextSchema(80),
  intro: localizedTextSchema(200).optional(),
  /** The two columns' headings: theirs, then ours. */
  them: localizedTextSchema(40),
  us: localizedTextSchema(40),
  rows: z
    .array(z.object({ label: localizedTextSchema(40), them: localizedTextSchema(80), us: localizedTextSchema(80) }))
    .min(2, "too_short")
    .max(8, "too_long"),
});

export const solutionsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("solutions"),
  title: localizedTextSchema(80),
  intro: localizedTextSchema(200).optional(),
});

export const featuresSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("features"),
  title: localizedTextSchema(80),
  features: z
    .array(z.object({ icon: z.enum(SITE_ICONS), title: localizedTextSchema(60), line: localizedTextSchema(200), image: siteImageSchema.optional() }))
    .min(2, "too_short")
    .max(8, "too_long"),
  /** "bento": the first feature large, the rest in tiles around it. Plain cards when left out. */
  layout: z.enum(["cards", "bento"]).optional(),
});

export const promotionSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("promotion"),
    title: localizedTextSchema(80),
    line: localizedTextSchema(160),
    image: siteImageSchema.optional(),
    button: siteLinkSchema.optional(),
    /** ISO date-times; the promotion shows only between them, by itself. */
    startsAt: z.string().datetime({ offset: true, message: "required" }),
    endsAt: z.string().datetime({ offset: true, message: "required" }),
  })
  .refine((promo) => Date.parse(promo.endsAt) > Date.parse(promo.startsAt), { message: "ends_before_start", path: ["endsAt"] });

export const plansSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("plans"),
  title: localizedTextSchema(80),
  /** Which plan wears the "Most shops start here" mark. Prices are never content: they come from plans.ts. */
  highlight: z.enum(["free", "basic", "pro", "advance"]),
  /** Optional link under the cards, e.g. "Compare all plans" on a product page. */
  link: siteLinkSchema.optional(),
  /** Adds the side-by-side comparison table under the cards (from tablet width). */
  compare: z.boolean().optional(),
});

export const questionsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("questions"),
  title: localizedTextSchema(80),
  items: z
    .array(z.object({ question: localizedTextSchema(120), answer: localizedTextSchema(600) }))
    .min(1, "too_short")
    .max(12, "too_long"),
});

export const sellerStorySectionSchema = z.object({
  ...sectionBase,
  type: z.literal("sellerStory"),
  name: localizedTextSchema(60),
  shop: localizedTextSchema(60),
  quote: localizedTextSchema(280),
  photo: siteImageSchema.optional(),
  /** Never shown without the seller's permission (design/brand-guide.md). */
  permission: z.literal(true, { errorMap: () => ({ message: "required" }) }),
  /** A made-up story: shown with a "Sample" mark, never on the live site. */
  sample: z.boolean(),
});

export const closingSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("closing"),
  headline: localizedTextSchema(80),
  line: localizedTextSchema(160),
  button: siteLinkSchema,
});

export const waitlistSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("waitlist"),
  title: localizedTextSchema(80),
  thanks: localizedTextSchema(200),
  /** The coming-soon solution the sign-ups are for. */
  solution: siteSolutionIdSchema,
});

export const siteSectionSchema = z.union([
  announcementSectionSchema,
  heroSectionSchema,
  stepsSectionSchema,
  appsSectionSchema,
  comparisonSectionSchema,
  solutionsSectionSchema,
  featuresSectionSchema,
  promotionSectionSchema,
  plansSectionSchema,
  questionsSectionSchema,
  sellerStorySectionSchema,
  closingSectionSchema,
  waitlistSectionSchema,
]);
export type SiteSection = z.infer<typeof siteSectionSchema>;

/** Each section type's rules, by type: the admin builds its edit form from these (A10). */
export const SITE_SECTION_SCHEMAS = {
  announcement: announcementSectionSchema,
  hero: heroSectionSchema,
  steps: stepsSectionSchema,
  apps: appsSectionSchema,
  comparison: comparisonSectionSchema,
  solutions: solutionsSectionSchema,
  features: featuresSectionSchema,
  promotion: promotionSectionSchema,
  plans: plansSectionSchema,
  questions: questionsSectionSchema,
  sellerStory: sellerStorySectionSchema,
  closing: closingSectionSchema,
  waitlist: waitlistSectionSchema,
} as const;
export const SITE_SECTION_TYPES = Object.keys(SITE_SECTION_SCHEMAS) as (keyof typeof SITE_SECTION_SCHEMAS)[];

/** The link preview's rules, edited with the same form. */
export const siteSeoSchema = z.object({ title: localizedTextSchema(70), description: localizedTextSchema(160), image: siteImageSchema.optional() });
export type SiteSectionType = SiteSection["type"];
export type SiteSectionOf<T extends SiteSectionType> = Extract<SiteSection, { type: T }>;

export const sitePageSchema = z.object({
  /** "" is the home page; otherwise the path without a leading slash ("pricing", "solutions/garage"). */
  slug: z.string().regex(/^[a-z0-9\-/]*$/, "slug_invalid"),
  /** The link preview on Facebook and Telegram. */
  seo: siteSeoSchema,
  sections: z.array(siteSectionSchema),
});
export type SitePage = z.infer<typeof sitePageSchema>;

// ----------------------------------------------------------- platform products

/** The platform's products. Only Khmio Shop is on the website now; Class and Rent sign-ups made before stay valid. */
export const PLATFORM_PRODUCT_IDS = ["shop", "class", "rent"] as const;
export const platformProductIdSchema = z.enum(PLATFORM_PRODUCT_IDS);
export type PlatformProductId = z.infer<typeof platformProductIdSchema>;

/** Is a promotion showing at this moment? Start inclusive, end exclusive. */
export function isPromotionLive(promo: Pick<SiteSectionOf<"promotion">, "startsAt" | "endsAt">, now: Date): boolean {
  const time = now.getTime();
  return time >= Date.parse(promo.startsAt) && time < Date.parse(promo.endsAt);
}

/** Where a promotion is in its time window: not started, running, or over. */
export function promotionTiming(promo: Pick<SiteSectionOf<"promotion">, "startsAt" | "endsAt">, now: Date): "scheduled" | "showing" | "ended" {
  if (now.getTime() < Date.parse(promo.startsAt)) return "scheduled";
  return isPromotionLive(promo, now) ? "showing" : "ended";
}

/** The sections a visitor sees right now: switched on, and promotions only while they run. */
export function visibleSections(page: Pick<SitePage, "sections">, now: Date): SiteSection[] {
  return page.sections.filter((section) => section.visible && (section.type !== "promotion" || isPromotionLive(section, now)));
}

// ----------------------------------------------------------------- waitlist

/** The business a sign-up is for: a solution (set by its page), or the older Class and Rent types (sign-ups made before). */
export const WAITLIST_BUSINESS_TYPES = [...SITE_SOLUTION_IDS, "teacher", "school", "landlord", "other"] as const;
export type WaitlistBusinessType = (typeof WAITLIST_BUSINESS_TYPES)[number];

/** The "Tell me when it's ready" form on a coming-soon product page. */
export const waitlistSignupSchema = z.object({
  product: platformProductIdSchema,
  name: z.string().trim().min(2, "too_short").max(60, "too_long"),
  phone: khmerPhoneSchema,
  businessType: z.enum(WAITLIST_BUSINESS_TYPES, { errorMap: () => ({ message: "required" }) }),
});
export type WaitlistSignup = z.infer<typeof waitlistSignupSchema>;

/** What the website sends: the sign-up and the bot check token (Turnstile; absent when the check is off). */
export const waitlistRequestSchema = waitlistSignupSchema.extend({ botCheck: z.string().max(4096).optional() });
export type WaitlistRequest = z.infer<typeof waitlistRequestSchema>;

/** The schema type, for code that reads a schema to build a form (the admin's site editor). */
export type { ZodTypeAny as SiteSchema } from "zod";

// ------------------------------------------------------------ picture library

/** A content picture's src that points into the picture library (A12): "library:<id>". */
export const LIBRARY_SRC_PREFIX = "library:";

/** What the admin gives every picture: a description in both languages (screen readers, search). */
export const sitePictureDetailsSchema = z.object({ alt: localizedTextSchema(160) });

/** The library picture a content src points to, or null for an ordinary address. */
export function libraryPictureId(src: string): string | null {
  return src.startsWith(LIBRARY_SRC_PREFIX) ? src.slice(LIBRARY_SRC_PREFIX.length) : null;
}

/** Every library picture a page uses, in its sections and its link preview. */
export function picturesUsedIn(page: Pick<SitePage, "sections" | "seo">): Set<string> {
  const used = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    if ("src" in value && typeof value.src === "string") {
      const id = libraryPictureId(value.src);
      if (id) used.add(id);
    }
    Object.values(value).forEach(visit);
  };
  visit(page.sections);
  visit(page.seo);
  return used;
}
