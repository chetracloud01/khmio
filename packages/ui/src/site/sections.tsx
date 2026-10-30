import { solutionPath, type SiteApp, type SiteIcon, type SiteImage, type SiteLink, type SiteSection, type SiteSectionOf } from "@khmio/shared";
import {
  ArrowRight,
  BellRing,
  Boxes,
  Building2,
  CalendarDays,
  Car,
  Check,
  ChartColumn,
  ChevronDown,
  Clock,
  Coffee,
  Heart,
  Languages,
  Layers,
  ListChecks,
  Minus,
  Percent,
  QrCode,
  ReceiptText,
  Scissors,
  Share2,
  Shirt,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  Users,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "../Button";
import { cn } from "../cn";
import { Mio } from "../Mio";
import { pick, resolveSiteHref, SiteContainer, SiteStatusBadge, type SiteKitContext } from "./kit";
import { PlansSection } from "./PlansSection";
import { WaitlistSection } from "./WaitlistSection";

// The site kit (design/screens.md "Platform website"): one component per
// section type, drawn only from its content. The admin edits the content;
// these components alone decide the layout, so every page keeps the design
// standard. Plain functions, no hooks: they render on the server or client
// (the Plans section, with its currency switch, and the waitlist form are
// client components). Colours come only from the theme's tokens.

const ICONS: Record<SiteIcon, LucideIcon> = {
  store: Store,
  share: Share2,
  qr: QrCode,
  bell: BellRing,
  truck: Truck,
  boxes: Boxes,
  building: Building2,
  shield: ShieldCheck,
  clock: Clock,
  language: Languages,
  list: ListChecks,
  heart: Heart,
  wrench: Wrench,
  car: Car,
  smartphone: Smartphone,
  coffee: Coffee,
  scissors: Scissors,
  shirt: Shirt,
  receipt: ReceiptText,
  chart: ChartColumn,
  users: Users,
  percent: Percent,
  calendar: CalendarDays,
  utensils: UtensilsCrossed,
  layers: Layers,
};

/** An app tile's colour, from the theme's tones. */
const TONE_TILE: Record<SiteApp["tone"], string> = {
  brand: "bg-brand/10 text-brand",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

/** One app's icon on its coloured square, the size of a phone's app icon. */
function AppIcon({ app, size = "md" }: { app: SiteApp; size?: "sm" | "md" }) {
  const Icon = ICONS[app.icon];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-2xl", TONE_TILE[app.tone], size === "sm" ? "h-11 w-11" : "h-14 w-14")}>
      <Icon className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} aria-hidden="true" />
    </span>
  );
}

/** A section's heading: centred, with an optional line under it. */
function SectionHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
      <h2 className="text-2xl font-bold leading-normal tracking-tight sm:text-4xl sm:leading-normal">{title}</h2>
      {intro && <p className="text-base text-muted sm:text-lg">{intro}</p>}
    </div>
  );
}

function IconTile({ icon, tone = "soft" }: { icon: SiteIcon; tone?: "soft" | "solid" }) {
  const Icon = ICONS[icon];
  return (
    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone === "solid" ? "bg-on-brand/15 text-on-brand" : "bg-brand/10 text-brand")}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

/** The site's buttons are pills: the kit's button, rounded fully. */
const pill = "rounded-full px-6";

function LinkButton({ link, ctx, variant = "primary", className }: { link: SiteLink; ctx: SiteKitContext; variant?: "primary" | "secondary"; className?: string }) {
  const external = link.href.startsWith("https://");
  return (
    <a
      href={resolveSiteHref(link.href, ctx)}
      className={cn(buttonVariants({ variant }), pill, className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {pick(link.label, ctx.locale)}
    </a>
  );
}

function SiteImg({ image, ctx, className }: { image: SiteImage; ctx: SiteKitContext; className?: string }) {
  // Plain <img>: the kit is shared by every product's site; pictures are already shrunk at upload.
  return <img src={ctx.image ? ctx.image(image.src) : image.src} alt={pick(image.alt, ctx.locale)} loading="lazy" className={cn("rounded-2xl object-cover", className)} />;
}

/** A soft wash of the brand colour behind a section (theme tokens, so it follows light and dark). */
const BRAND_GLOW =
  "bg-[radial-gradient(60%_60%_at_85%_10%,rgb(var(--color-brand)/0.16),transparent_70%),radial-gradient(50%_50%_at_0%_100%,rgb(var(--color-brand)/0.10),transparent_70%)]";

// ------------------------------------------------------------------ sections

export function AnnouncementBar({ section, ctx }: { section: SiteSectionOf<"announcement">; ctx: SiteKitContext }) {
  return (
    <div className="bg-fg text-bg">
      <SiteContainer className="flex min-h-touch flex-wrap items-center justify-center gap-x-3 py-2 text-center text-sm">
        <span>{pick(section.text, ctx.locale)}</span>
        {section.link && (
          <a href={resolveSiteHref(section.link.href, ctx)} className="inline-flex min-h-touch items-center gap-1 font-semibold underline-offset-4 hover:underline">
            {pick(section.link.label, ctx.locale)}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </SiteContainer>
    </div>
  );
}

export function HeroSection({ section, ctx }: { section: SiteSectionOf<"hero">; ctx: SiteKitContext }) {
  const highlights = section.highlights ?? [];
  return (
    <section className={cn("relative overflow-hidden bg-canvas", BRAND_GLOW)}>
      <SiteContainer className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:py-24">
        <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
          {section.eyebrow && (
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-bg/70 px-3 py-1 text-sm font-semibold text-brand backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
              {pick(section.eyebrow, ctx.locale)}
            </p>
          )}
          <h1 className="text-4xl font-bold leading-normal tracking-tight sm:text-6xl sm:leading-tight">{pick(section.headline, ctx.locale)}</h1>
          <p className="max-w-xl text-base text-muted sm:text-lg">{pick(section.sentence, ctx.locale)}</p>
          <div className="mt-1 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <LinkButton link={section.primary} ctx={ctx} className="sm:min-w-44" />
            {section.secondary && <LinkButton link={section.secondary} ctx={ctx} variant="secondary" className="sm:min-w-44" />}
          </div>
          {section.trust && section.trust.length > 0 && (
            <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted lg:justify-start">
              {section.trust.map((point, index) => {
                const Icon = ICONS[point.icon];
                return (
                  <li key={index} className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-brand" aria-hidden="true" />
                    {pick(point.text, ctx.locale)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="relative mx-auto flex w-full max-w-sm flex-col items-center gap-3 lg:max-w-md">
          <div className="relative flex aspect-square w-64 items-center justify-center rounded-full bg-bg shadow-raised ring-1 ring-border sm:w-80">
            <div className="absolute inset-4 rounded-full bg-brand/10" aria-hidden="true" />
            {section.art.kind === "image" ? (
              <SiteImg image={section.art.image} ctx={ctx} className="relative aspect-square w-4/5 rounded-full" />
            ) : (
              <Mio pose={section.art.kind === "mio" ? section.art.pose : "face"} size={190} label={ctx.labels.mio} className="relative sm:h-56 sm:w-56" />
            )}
            {/* Mio among the apps: the first ready apps on a ring around the circle. */}
            {section.art.kind === "apps" &&
              ctx.apps
                .filter((app) => app.status === "live")
                .slice(0, APP_RING.length)
                .map((app, index) => (
                  <span key={app.id} className={cn("absolute rounded-2xl bg-bg p-1 shadow-raised", APP_RING[index])} title={pick(app.name, ctx.locale)}>
                    <AppIcon app={app} size="sm" />
                  </span>
                ))}
          </div>
          {/* On a laptop the facts float around the art; on a phone they line up under it. */}
          {highlights.map((text, index) => (
            <p
              key={index}
              className={cn(
                "flex items-center gap-2 rounded-2xl border border-border bg-bg/90 px-4 py-2.5 text-sm font-semibold shadow-raised backdrop-blur",
                "lg:absolute",
                index === 0 && "lg:-left-6 lg:top-8",
                index === 1 && "lg:-right-4 lg:top-1/2",
                index === 2 && "lg:bottom-4 lg:left-2",
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
              {pick(text, ctx.locale)}
            </p>
          ))}
        </div>
      </SiteContainer>
    </section>
  );
}

/** Where each app tile sits on the hero's ring (top, then clockwise). */
const APP_RING = [
  "left-1/2 top-0 -translate-x-1/2 -translate-y-1/3",
  "right-2 top-[14%]",
  "-right-3 top-1/2 -translate-y-1/2",
  "bottom-[14%] right-2",
  "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3",
  "bottom-[14%] left-2",
  "-left-3 top-1/2 -translate-y-1/2",
  "left-2 top-[14%]",
];

export function StepsSection({ section, ctx }: { section: SiteSectionOf<"steps">; ctx: SiteKitContext }) {
  return (
    <section className="bg-bg py-16 sm:py-24">
      <SiteContainer className="flex flex-col gap-10">
        <SectionHeading title={pick(section.title, ctx.locale)} />
        <ol className={cn("grid gap-4", section.steps.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3")}>
          {section.steps.map((step, index) => (
            <li key={index} className="relative flex flex-col gap-4 rounded-3xl border border-border bg-canvas p-6">
              <div className="flex items-center justify-between">
                <IconTile icon={step.icon} />
                <span className="text-4xl font-bold tabular-nums text-brand/20" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{pick(step.title, ctx.locale)}</h3>
              <p className="text-sm text-muted">{pick(step.line, ctx.locale)}</p>
            </li>
          ))}
        </ol>
      </SiteContainer>
    </section>
  );
}

/** Every app as a tile: its icon, name, one line, and whether it's ready (a plan mark when it needs one). */
export function AppsSection({ section, ctx }: { section: SiteSectionOf<"apps">; ctx: SiteKitContext }) {
  return (
    <section id={section.id} className="scroll-mt-20 bg-bg py-16 sm:py-24">
      <SiteContainer className="flex flex-col gap-10">
        <SectionHeading title={pick(section.title, ctx.locale)} intro={section.intro && pick(section.intro, ctx.locale)} />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ctx.apps.map((app) => (
            <li key={app.id} className={cn("flex flex-col gap-3 rounded-3xl border border-border p-4 sm:p-5", app.status === "live" ? "bg-canvas" : "bg-bg")}>
              <div className="flex items-start justify-between gap-2">
                <AppIcon app={app} />
                {app.plan && <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted">{app.plan}</span>}
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold leading-normal">{pick(app.name, ctx.locale)}</h3>
                <p className="text-sm text-muted">{pick(app.line, ctx.locale)}</p>
              </div>
              <SiteStatusBadge status={app.status} labels={ctx.labels} className="mt-auto self-start" />
            </li>
          ))}
        </ul>
      </SiteContainer>
    </section>
  );
}

/** Big business software and Khmio side by side: a table from tablet width, one card per row on a phone. */
export function ComparisonSection({ section, ctx }: { section: SiteSectionOf<"comparison">; ctx: SiteKitContext }) {
  const them = pick(section.them, ctx.locale);
  const us = pick(section.us, ctx.locale);
  return (
    <section className="bg-canvas py-16 sm:py-24">
      <SiteContainer className="flex max-w-[960px] flex-col gap-10">
        <SectionHeading title={pick(section.title, ctx.locale)} intro={section.intro && pick(section.intro, ctx.locale)} />
        <div className="hidden overflow-hidden rounded-3xl border border-border bg-bg md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <td className="w-1/4 px-5 py-4" />
                <th scope="col" className="px-5 py-4 font-semibold text-muted">
                  {them}
                </th>
                <th scope="col" className="bg-brand/5 px-5 py-4 font-semibold text-brand">
                  {us}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {section.rows.map((row, index) => (
                <tr key={index}>
                  <th scope="row" className="px-5 py-4 font-semibold">
                    {pick(row.label, ctx.locale)}
                  </th>
                  <td className="px-5 py-4 text-muted">
                    <span className="flex items-start gap-2">
                      <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {pick(row.them, ctx.locale)}
                    </span>
                  </td>
                  <td className="bg-brand/5 px-5 py-4 font-medium">
                    <span className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      {pick(row.us, ctx.locale)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="flex flex-col gap-3 md:hidden">
          {section.rows.map((row, index) => (
            <li key={index} className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4">
              <p className="font-semibold">{pick(row.label, ctx.locale)}</p>
              <p className="flex items-start gap-2 text-sm text-muted">
                <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="sr-only">{them}: </span>
                  {pick(row.them, ctx.locale)}
                </span>
              </p>
              <p className="flex items-start gap-2 text-sm font-medium">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span>
                  <span className="sr-only">{us}: </span>
                  {pick(row.us, ctx.locale)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </SiteContainer>
    </section>
  );
}

/** Long text under headings (terms, privacy): one readable column, the date, and a notice while it's a draft. */
export function DocumentSection({ section, ctx }: { section: SiteSectionOf<"document">; ctx: SiteKitContext }) {
  return (
    <section className="bg-bg py-12 sm:py-16">
      <SiteContainer className="flex max-w-[760px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold leading-normal tracking-tight sm:text-4xl sm:leading-normal">{pick(section.title, ctx.locale)}</h1>
          <p className="text-sm text-muted">{ctx.labels.lastUpdated(section.updatedOn)}</p>
        </div>
        {section.draft && (
          <p role="note" className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm font-medium text-warning">
            {ctx.labels.draft}
          </p>
        )}
        {section.intro && <p className="text-base text-muted sm:text-lg">{pick(section.intro, ctx.locale)}</p>}
        {section.parts.map((part, index) => (
          <div key={index} className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold leading-normal">{pick(part.heading, ctx.locale)}</h2>
            {part.paragraphs.map((paragraph, at) => (
              <p key={at} className="leading-relaxed text-fg/90">
                {pick(paragraph, ctx.locale)}
              </p>
            ))}
          </div>
        ))}
      </SiteContainer>
    </section>
  );
}

/** Khmio for each kind of business: ready, in beta (start free either way), or coming with its waitlist. */
export function SolutionsSection({ section, ctx }: { section: SiteSectionOf<"solutions">; ctx: SiteKitContext }) {
  return (
    <section id={section.id} className="scroll-mt-20 bg-canvas py-16 sm:py-24">
      <SiteContainer className="flex flex-col gap-10">
        <SectionHeading title={pick(section.title, ctx.locale)} intro={section.intro && pick(section.intro, ctx.locale)} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ctx.solutions.map((solution) => {
            const live = solution.status === "live";
            const open = solution.status !== "coming_soon";
            const page = ctx.href(solutionPath(solution.id));
            return (
              <li
                key={solution.id}
                className={cn(
                  "group flex flex-col gap-4 rounded-3xl border bg-bg p-6 transition-shadow hover:shadow-raised motion-reduce:transition-none",
                  live ? "border-brand/40 ring-1 ring-brand/20" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <IconTile icon={solution.icon} />
                  <SiteStatusBadge status={solution.status} labels={ctx.labels} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xl font-bold leading-normal">{pick(solution.name, ctx.locale)}</h3>
                  <p className="text-sm text-muted">{pick(solution.line, ctx.locale)}</p>
                </div>
                {solution.covers.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {solution.covers.map((cover, index) => (
                      <li key={index} className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-muted">
                        {pick(cover, ctx.locale)}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row">
                  {open ? (
                    <>
                      <a href={ctx.href("/start")} className={cn(buttonVariants({ variant: "primary" }), pill, "flex-1")}>
                        {ctx.labels.startFree}
                      </a>
                      <a href={page} className={cn(buttonVariants({ variant: "secondary" }), pill, "flex-1")}>
                        {ctx.labels.learnMore}
                      </a>
                    </>
                  ) : (
                    <a href={`${page}#waitlist`} className={cn(buttonVariants({ variant: "secondary" }), pill, "flex-1 gap-2")}>
                      {ctx.labels.joinWaitlist}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SiteContainer>
    </section>
  );
}

/** A phone screenshot in a phone-shaped frame, top of the screen showing. */
function PhoneShot({ image, ctx }: { image: SiteImage; ctx: SiteKitContext }) {
  return (
    <div className="w-[220px] shrink-0 overflow-hidden rounded-[32px] border-[6px] border-fg/85 bg-bg shadow-raised">
      <SiteImg image={image} ctx={ctx} className="aspect-[360/740] w-full rounded-none object-top" />
    </div>
  );
}

export function FeaturesSection({ section, ctx }: { section: SiteSectionOf<"features">; ctx: SiteKitContext }) {
  const title = <SectionHeading title={pick(section.title, ctx.locale)} />;
  // Every feature with a picture: a showcase, each feature beside its phone screenshot.
  if (section.features.every((feature) => feature.image)) {
    return (
      <section className="bg-bg py-16 sm:py-24">
        <SiteContainer className="flex flex-col gap-12">
          {title}
          <ul className="flex flex-col gap-14">
            {section.features.map((feature, index) => (
              <li key={index} className={cn("flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-14", index % 2 === 1 && "md:flex-row-reverse")}>
                {feature.image && <PhoneShot image={feature.image} ctx={ctx} />}
                <div className="flex max-w-md flex-col items-center gap-3 text-center md:items-start md:text-left">
                  <IconTile icon={feature.icon} />
                  <h3 className="text-2xl font-bold leading-normal">{pick(feature.title, ctx.locale)}</h3>
                  <p className="text-muted">{pick(feature.line, ctx.locale)}</p>
                </div>
              </li>
            ))}
          </ul>
        </SiteContainer>
      </section>
    );
  }
  // Bento: the first feature large on the brand colour, the rest in tiles around it.
  if (section.layout === "bento") {
    return (
      <section className="bg-bg py-16 sm:py-24">
        <SiteContainer className="flex flex-col gap-10">
          {title}
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {section.features.map((feature, index) => {
              const lead = index === 0;
              return (
                <li
                  key={index}
                  className={cn(
                    "flex flex-col gap-4 rounded-3xl p-6",
                    lead ? "bg-brand text-on-brand md:col-span-2 lg:row-span-2 lg:justify-end lg:p-8" : "border border-border bg-canvas",
                  )}
                >
                  {feature.image && <SiteImg image={feature.image} ctx={ctx} className="aspect-video w-full" />}
                  <IconTile icon={feature.icon} tone={lead ? "solid" : "soft"} />
                  <h3 className={cn("font-bold leading-normal", lead ? "text-2xl sm:text-3xl" : "text-lg")}>{pick(feature.title, ctx.locale)}</h3>
                  <p className={cn(lead ? "max-w-md text-on-brand/85 sm:text-lg" : "text-sm text-muted")}>{pick(feature.line, ctx.locale)}</p>
                </li>
              );
            })}
          </ul>
        </SiteContainer>
      </section>
    );
  }
  return (
    <section className="bg-bg py-16 sm:py-24">
      <SiteContainer className="flex flex-col gap-10">
        {title}
        <ul className={cn("grid gap-4", section.features.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2")}>
          {section.features.map((feature, index) => (
            <li key={index} className="flex flex-col gap-4 rounded-3xl border border-border bg-canvas p-6">
              {feature.image && <SiteImg image={feature.image} ctx={ctx} className="aspect-video w-full" />}
              <IconTile icon={feature.icon} />
              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-semibold">{pick(feature.title, ctx.locale)}</h3>
                <p className="text-sm text-muted">{pick(feature.line, ctx.locale)}</p>
              </div>
            </li>
          ))}
        </ul>
      </SiteContainer>
    </section>
  );
}

export function PromotionSection({ section, ctx }: { section: SiteSectionOf<"promotion">; ctx: SiteKitContext }) {
  return (
    <section className="bg-bg py-8">
      <SiteContainer>
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-brand/30 bg-brand/5 p-6 text-center sm:flex-row sm:text-left">
          {section.image && <SiteImg image={section.image} ctx={ctx} className="h-24 w-24 shrink-0" />}
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-lg font-bold">{pick(section.title, ctx.locale)}</p>
            <p className="text-sm text-muted">{pick(section.line, ctx.locale)}</p>
          </div>
          {section.button && <LinkButton link={section.button} ctx={ctx} className="w-full sm:w-auto" />}
        </div>
      </SiteContainer>
    </section>
  );
}

export function QuestionsSection({ section, ctx }: { section: SiteSectionOf<"questions">; ctx: SiteKitContext }) {
  return (
    <section className="bg-canvas py-16 sm:py-24">
      <SiteContainer className="flex max-w-[800px] flex-col gap-10">
        <SectionHeading title={pick(section.title, ctx.locale)} />
        <div className="flex flex-col gap-3">
          {section.items.map((item, index) => (
            <details key={index} className="group rounded-2xl border border-border bg-bg px-5 open:shadow-card">
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 py-4 font-semibold">
                {pick(item.question, ctx.locale)}
                <ChevronDown className="h-5 w-5 shrink-0 text-brand transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </summary>
              <p className="pb-5 text-sm text-muted">{pick(item.answer, ctx.locale)}</p>
            </details>
          ))}
        </div>
      </SiteContainer>
    </section>
  );
}

export function SellerStorySection({ section, ctx }: { section: SiteSectionOf<"sellerStory">; ctx: SiteKitContext }) {
  const name = pick(section.name, ctx.locale);
  return (
    <section className="bg-bg py-16 sm:py-24">
      <SiteContainer className="max-w-[800px]">
        <figure className="flex flex-col gap-5 rounded-3xl border border-border bg-canvas p-6 sm:p-10">
          {section.sample && (
            <span className="self-start rounded-full border border-border bg-bg px-2.5 py-0.5 text-xs font-semibold text-muted">{ctx.labels.sample}</span>
          )}
          <blockquote className="text-xl font-medium leading-relaxed sm:text-2xl">“{pick(section.quote, ctx.locale)}”</blockquote>
          <figcaption className="flex items-center gap-3">
            {section.photo ? (
              <SiteImg image={section.photo} ctx={ctx} className="h-12 w-12 rounded-full" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-lg font-bold text-on-brand" aria-hidden="true">
                {name.charAt(0)}
              </span>
            )}
            <span className="flex flex-col">
              <span className="font-semibold">{name}</span>
              <span className="text-sm text-muted">{pick(section.shop, ctx.locale)}</span>
            </span>
          </figcaption>
        </figure>
      </SiteContainer>
    </section>
  );
}

export function ClosingSection({ section, ctx }: { section: SiteSectionOf<"closing">; ctx: SiteKitContext }) {
  return (
    <section className="bg-bg py-16 sm:py-24">
      <SiteContainer>
        <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-[2rem] bg-brand px-6 py-12 text-center text-on-brand sm:px-12 sm:py-16 lg:flex-row lg:text-left">
          <div
            className="absolute inset-0 bg-[radial-gradient(50%_80%_at_100%_0%,rgb(var(--color-on-brand)/0.18),transparent_70%)]"
            aria-hidden="true"
          />
          <div className="relative flex flex-1 flex-col gap-3">
            <h2 className="text-2xl font-bold leading-normal tracking-tight sm:text-4xl sm:leading-normal">{pick(section.headline, ctx.locale)}</h2>
            <p className="text-on-brand/85 sm:text-lg">{pick(section.line, ctx.locale)}</p>
          </div>
          <div className="relative flex flex-col items-center gap-4 sm:flex-row lg:flex-col">
            <Mio pose="face" size={88} label={ctx.labels.mio} />
            <a
              href={resolveSiteHref(section.button.href, ctx)}
              className="inline-flex min-h-touch min-w-44 items-center justify-center gap-2 rounded-full bg-bg px-6 font-semibold text-fg transition-colors hover:bg-bg/90"
            >
              {pick(section.button.label, ctx.locale)}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </SiteContainer>
    </section>
  );
}

/**
 * Draws a page's sections in order. The announcement bar is left out here:
 * the page puts it above the header.
 */
export function SiteSections({ sections, ctx }: { sections: SiteSection[]; ctx: SiteKitContext }) {
  return (
    <>
      {sections.map((section) => {
        switch (section.type) {
          case "hero":
            return <HeroSection key={section.id} section={section} ctx={ctx} />;
          case "steps":
            return <StepsSection key={section.id} section={section} ctx={ctx} />;
          case "apps":
            return <AppsSection key={section.id} section={section} ctx={ctx} />;
          case "comparison":
            return <ComparisonSection key={section.id} section={section} ctx={ctx} />;
          case "document":
            return <DocumentSection key={section.id} section={section} ctx={ctx} />;
          case "solutions":
            return <SolutionsSection key={section.id} section={section} ctx={ctx} />;
          case "features":
            return <FeaturesSection key={section.id} section={section} ctx={ctx} />;
          case "promotion":
            return <PromotionSection key={section.id} section={section} ctx={ctx} />;
          case "questions":
            return <QuestionsSection key={section.id} section={section} ctx={ctx} />;
          case "sellerStory":
            return <SellerStorySection key={section.id} section={section} ctx={ctx} />;
          case "closing":
            return <ClosingSection key={section.id} section={section} ctx={ctx} />;
          case "plans":
            return <PlansSection key={section.id} section={section} ctx={ctx} />;
          case "waitlist":
            return <WaitlistSection key={section.id} section={section} ctx={ctx} />;
          case "announcement":
            return null;
        }
      })}
    </>
  );
}

/** The header's "Solutions" menu entries, from the solution list: name, status, and where it leads. */
export function solutionMenuItems(ctx: Pick<SiteKitContext, "solutions" | "locale" | "href">) {
  return ctx.solutions.map((solution) => ({
    icon: ICONS[solution.icon],
    label: pick(solution.name, ctx.locale),
    href: ctx.href(solutionPath(solution.id)),
    status: solution.status,
  }));
}
