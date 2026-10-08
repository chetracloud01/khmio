"use client";

import { cn, KhmioMark, Mio } from "@khmio/ui";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * Seller sign-up and onboarding (design/screens.md S1, S2), live and mockup:
 * from 1024 px a split screen — the Deep Khmio Teal side with Mio and what
 * Khmio gives a seller, the form on the right; on a phone one column with
 * the Khmio mark on top. `controls`: language and theme, top right.
 */
export function SignUpFrame({ children, controls, wide = false }: { children: ReactNode; controls?: ReactNode; /** A wider form column (onboarding's shop step with its preview). */ wide?: boolean }) {
  const t = useTranslations("SignUp");
  const tMascot = useTranslations("Mascot");
  const benefits = [t("benefitLink"), t("benefitAlerts"), t("benefitCash")];
  return (
    <div className="min-h-dvh bg-canvas text-fg lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Laptop: the brand side. */}
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between bg-nav-bg p-10 text-nav-fg lg:flex">
        <div className="flex items-center gap-3">
          <KhmioMark size={36} className="text-nav-accent" />
          <span className="text-lg font-bold">Khmio</span>
        </div>
        <div className="flex flex-col gap-8">
          <Mio size={120} label={tMascot("label")} />
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl font-bold leading-normal">{t("brandTitle")}</h2>
            <ul className="flex flex-col gap-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-base">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nav-accent text-nav-bg">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-nav-fg/90">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="inline-flex w-fit rounded-full bg-nav-badge/15 px-3 py-1 text-sm font-semibold text-nav-badge">{t("betaFree")}</p>
      </aside>

      {/* The form side (the whole page on a phone). */}
      <main className="flex min-h-dvh flex-col">
        <div className="flex items-center justify-between gap-3 p-4">
          <span className="flex items-center gap-2 lg:invisible">
            <KhmioMark size={28} />
            <span className="font-bold">Khmio</span>
          </span>
          {controls && <div className="flex shrink-0 items-center gap-1">{controls}</div>}
        </div>
        <div className={cn("mx-auto flex w-full flex-1 flex-col gap-6 px-4 pb-10 lg:justify-center", wide ? "max-w-[880px]" : "max-w-[440px]")}>{children}</div>
      </main>
    </div>
  );
}

/** ① Business ── ② Your shop ── ③ Ready, for onboarding. */
export function OnboardingSteps({ current }: { current: 1 | 2 | 3 }) {
  const t = useTranslations("SignUp");
  const labels = [t("stepBusiness"), t("stepShop"), t("stepReady")];
  return (
    <ol className="flex items-center gap-2" aria-label={t("stepsLabel")}>
      {labels.map((label, index) => {
        const number = index + 1;
        const done = number < current;
        const here = number === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2" aria-current={here ? "step" : undefined}>
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                done ? "bg-success text-bg" : here ? "bg-brand text-on-brand" : "bg-border/40 text-muted",
              )}
            >
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : number}
            </span>
            <span className={cn("truncate text-sm", here ? "font-semibold text-fg" : "text-muted")}>{label}</span>
            {number < labels.length && <span className={cn("hidden h-0.5 flex-1 rounded-full sm:block", done ? "bg-success" : "bg-border")} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

/** What buyers will see, while the seller types the shop's name and link (onboarding, laptop). */
export function ShopPreview({ name, link, logo }: { name: string; link: string; logo: ReactNode }) {
  const t = useTranslations("SignUp");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-muted">{t("previewTitle")}</p>
      <div className="overflow-hidden rounded-2xl border border-border bg-bg shadow-card">
        <div className="h-20 bg-gradient-to-br from-brand via-brand to-nav-bg" />
        <div className="flex flex-col gap-2 px-4 pb-4">
          <div className="-mt-8 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-bg bg-brand text-2xl font-bold text-on-brand">{logo}</div>
          <p className="truncate text-lg font-bold">{name || t("previewNamePlaceholder")}</p>
          <p className="truncate text-sm text-muted">{link}</p>
          <div className="mt-2 grid grid-cols-2 gap-2" aria-hidden="true">
            {[0, 1].map((index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <div className="aspect-square rounded-DEFAULT bg-border/40" />
                <div className="h-3 w-3/4 rounded bg-border/40" />
                <div className="h-3 w-1/3 rounded bg-border/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-sm text-muted">{t("previewHint")}</p>
    </div>
  );
}

/** "What's next" on the Ready screen: each step to a shop buyers can order from, done or with its link. */
export function NextSteps({ items }: { items: { key: string; label: string; href: string; done: boolean }[] }) {
  const t = useTranslations("SignUp");
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4">
      <div>
        <h2 className="font-semibold">{t("nextTitle")}</h2>
        <p className="text-sm text-muted">{t("nextIntro")}</p>
      </div>
      <ol className="flex flex-col">
        {items.map((item, index) => (
          <li key={item.key}>
            <a
              href={item.href}
              aria-disabled={item.done}
              className={cn("flex min-h-touch items-center gap-3 rounded-DEFAULT px-2 py-2", item.done ? "pointer-events-none" : "hover:bg-border/10")}
            >
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold", item.done ? "bg-success/10 text-success" : "bg-border/30 text-muted")}>
                {item.done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className={cn("min-w-0 flex-1 text-sm", item.done ? "text-muted line-through" : "font-medium")}>{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
