import type { SiteIcon, SiteImage, SiteLink, SiteSection, SiteSectionOf } from "@khmio/shared";
import {
  BellRing,
  Boxes,
  Building2,
  Clock,
  Heart,
  Languages,
  ListChecks,
  QrCode,
  Share2,
  ShieldCheck,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { buttonVariants } from "../Button";
import { cn } from "../cn";
import { Mio } from "../Mio";
import { pick, resolveSiteHref, SiteContainer, type SiteKitContext } from "./kit";
import { PlansSection } from "./PlansSection";
import { WaitlistSection } from "./WaitlistSection";

// The site kit (design/screens.md "Platform website"): one component per
// section type, drawn only from its content. The admin edits the content;
// these components alone decide the layout, so every page keeps the design
// standard. Plain functions, no hooks: they render on the server or client
// (the Plans section, with its currency switch, is a client component).

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
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-2xl font-bold leading-normal sm:text-3xl sm:leading-normal">{children}</h2>;
}

function IconTile({ icon }: { icon: SiteIcon }) {
  const Icon = ICONS[icon];
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-DEFAULT bg-brand/10 text-brand">
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function LinkButton({ link, ctx, variant = "primary", className }: { link: SiteLink; ctx: SiteKitContext; variant?: "primary" | "secondary"; className?: string }) {
  const external = link.href.startsWith("https://");
  return (
    <a
      href={resolveSiteHref(link.href, ctx)}
      className={cn(buttonVariants({ variant }), className)}
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

// ------------------------------------------------------------------ sections

export function AnnouncementBar({ section, ctx }: { section: SiteSectionOf<"announcement">; ctx: SiteKitContext }) {
  const text = pick(section.text, ctx.locale);
  return (
    <div className="bg-brand text-on-brand">
      <SiteContainer className="flex min-h-touch flex-wrap items-center justify-center gap-x-3 py-2 text-center text-sm">
        <span>{text}</span>
        {section.link && (
          <a href={resolveSiteHref(section.link.href, ctx)} className="inline-flex min-h-touch items-center font-semibold underline underline-offset-4">
            {pick(section.link.label, ctx.locale)}
          </a>
        )}
      </SiteContainer>
    </div>
  );
}

export function HeroSection({ section, ctx }: { section: SiteSectionOf<"hero">; ctx: SiteKitContext }) {
  return (
    <section className="bg-gradient-to-b from-brand/10 to-canvas">
      <SiteContainer className="grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1.2fr_1fr] lg:py-20">
        <div className="flex flex-col gap-4 text-center lg:text-left">
          {section.eyebrow && <p className="text-sm font-semibold text-brand">{pick(section.eyebrow, ctx.locale)}</p>}
          <h1 className="text-3xl font-bold leading-normal sm:text-5xl sm:leading-normal">{pick(section.headline, ctx.locale)}</h1>
          <p className="text-base text-muted sm:text-lg">{pick(section.sentence, ctx.locale)}</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <LinkButton link={section.primary} ctx={ctx} className="sm:min-w-44" />
            {section.secondary && <LinkButton link={section.secondary} ctx={ctx} variant="secondary" className="sm:min-w-44" />}
          </div>
        </div>
        <div className="flex justify-center">
          {section.art.kind === "mio" ? (
            <Mio pose={section.art.pose} size={200} label={ctx.labels.mio} className="sm:h-64 sm:w-64" />
          ) : (
            <SiteImg image={section.art.image} ctx={ctx} className="aspect-square w-full max-w-sm" />
          )}
        </div>
      </SiteContainer>
    </section>
  );
}

export function StepsSection({ section, ctx }: { section: SiteSectionOf<"steps">; ctx: SiteKitContext }) {
  return (
    <section className="bg-canvas py-12 sm:py-16">
      <SiteContainer className="flex flex-col gap-8">
        <SectionTitle>{pick(section.title, ctx.locale)}</SectionTitle>
        <ol className={cn("grid gap-4", section.steps.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
          {section.steps.map((step, index) => (
            <li key={index} className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand">{index + 1}</span>
                <IconTile icon={step.icon} />
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

export function ProductCardsSection({ section, ctx }: { section: SiteSectionOf<"productCards">; ctx: SiteKitContext }) {
  const products = ctx.products.filter((product) => section.show !== "coming_soon" || product.status === "coming_soon");
  return (
    <section className="bg-bg py-12 sm:py-16">
      <SiteContainer className="flex flex-col gap-8">
        <SectionTitle>{pick(section.title, ctx.locale)}</SectionTitle>
        <ul className={cn("grid gap-4 sm:grid-cols-2", products.length >= 3 && "lg:grid-cols-3")}>
          {products.map((product) => {
            const live = product.status === "live";
            return (
              <li key={product.id} className={cn("flex flex-col gap-3 rounded-2xl border bg-bg p-5 shadow-card", live ? "border-brand/40" : "border-border")}>
                <div className="flex items-start justify-between gap-3">
                  <IconTile icon={product.icon} />
                  {!live && <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">{ctx.labels.comingSoon}</span>}
                </div>
                <div>
                  <h3 className="text-lg font-bold">{product.name}</h3>
                  <p className="text-sm font-medium text-brand">{pick(product.subtitle, ctx.locale)}</p>
                </div>
                <p className="flex-1 text-sm text-muted">{pick(product.line, ctx.locale)}</p>
                <div className="flex flex-col gap-2">
                  {live ? (
                    <>
                      <a href={ctx.href("/start")} className={buttonVariants({ variant: "primary", fullWidth: true })}>
                        {ctx.labels.startFree}
                      </a>
                      <a href={ctx.href(`/products/${product.id}`)} className={buttonVariants({ variant: "secondary", fullWidth: true })}>
                        {ctx.labels.learnMore}
                      </a>
                    </>
                  ) : (
                    <a href={ctx.href(`/products/${product.id}`)} className={buttonVariants({ variant: "secondary", fullWidth: true })}>
                      {ctx.labels.joinWaitlist}
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
    <div className="w-[220px] shrink-0 overflow-hidden rounded-[28px] border-[6px] border-fg/85 bg-bg shadow-raised">
      <SiteImg image={image} ctx={ctx} className="aspect-[360/740] w-full rounded-none object-top" />
    </div>
  );
}

export function FeaturesSection({ section, ctx }: { section: SiteSectionOf<"features">; ctx: SiteKitContext }) {
  // Every feature with a picture: a showcase, each feature beside its phone screenshot.
  if (section.features.every((feature) => feature.image)) {
    return (
      <section className="bg-canvas py-12 sm:py-16">
        <SiteContainer className="flex flex-col gap-10">
          <SectionTitle>{pick(section.title, ctx.locale)}</SectionTitle>
          <ul className="flex flex-col gap-12">
            {section.features.map((feature, index) => (
              <li key={index} className={cn("flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-12", index % 2 === 1 && "md:flex-row-reverse")}>
                {feature.image && <PhoneShot image={feature.image} ctx={ctx} />}
                <div className="flex max-w-md flex-col gap-3 text-center md:text-left">
                  <div className="flex justify-center md:justify-start">
                    <IconTile icon={feature.icon} />
                  </div>
                  <h3 className="text-xl font-bold leading-normal">{pick(feature.title, ctx.locale)}</h3>
                  <p className="text-muted">{pick(feature.line, ctx.locale)}</p>
                </div>
              </li>
            ))}
          </ul>
        </SiteContainer>
      </section>
    );
  }
  return (
    <section className="bg-canvas py-12 sm:py-16">
      <SiteContainer className="flex flex-col gap-8">
        <SectionTitle>{pick(section.title, ctx.locale)}</SectionTitle>
        <ul className={cn("grid gap-4", section.features.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2")}>
          {section.features.map((feature, index) => (
            <li key={index} className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-5 shadow-card">
              {feature.image && <SiteImg image={feature.image} ctx={ctx} className="aspect-video w-full" />}
              <div className="flex items-start gap-3">
                <IconTile icon={feature.icon} />
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold">{pick(feature.title, ctx.locale)}</h3>
                  <p className="text-sm text-muted">{pick(feature.line, ctx.locale)}</p>
                </div>
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
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-brand/40 bg-brand/10 p-5 text-center sm:flex-row sm:p-6 sm:text-left">
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
    <section className="bg-bg py-12 sm:py-16">
      <SiteContainer className="flex max-w-[760px] flex-col gap-6">
        <SectionTitle>{pick(section.title, ctx.locale)}</SectionTitle>
        <div className="flex flex-col gap-2">
          {section.items.map((item, index) => (
            <details key={index} className="group rounded-2xl border border-border bg-bg px-4 shadow-card">
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 py-3 font-semibold">
                {pick(item.question, ctx.locale)}
                <span className="text-brand transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="pb-4 text-sm text-muted">{pick(item.answer, ctx.locale)}</p>
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
    <section className="bg-bg py-12 sm:py-16">
      <SiteContainer className="max-w-[760px]">
        <figure className="flex flex-col gap-4 rounded-2xl border border-border bg-canvas p-6 sm:p-8">
          {section.sample && (
            <span className="self-start rounded-full border border-border bg-bg px-2.5 py-0.5 text-xs font-semibold text-muted">{ctx.labels.sample}</span>
          )}
          <blockquote className="text-lg font-medium leading-relaxed sm:text-xl">“{pick(section.quote, ctx.locale)}”</blockquote>
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
    <section className="bg-brand py-12 text-on-brand sm:py-16">
      <SiteContainer className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-2xl font-bold leading-normal sm:text-3xl sm:leading-normal">{pick(section.headline, ctx.locale)}</h2>
        <p className="opacity-90">{pick(section.line, ctx.locale)}</p>
        <a
          href={resolveSiteHref(section.button.href, ctx)}
          className="inline-flex min-h-touch min-w-44 items-center justify-center rounded-DEFAULT bg-bg px-6 font-semibold text-fg transition-colors hover:bg-bg/90"
        >
          {pick(section.button.label, ctx.locale)}
        </a>
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
          case "productCards":
            return <ProductCardsSection key={section.id} section={section} ctx={ctx} />;
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
