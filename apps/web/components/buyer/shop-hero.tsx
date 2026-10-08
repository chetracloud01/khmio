"use client";

import { StatusPill } from "@khmio/ui";
import type { ReactNode } from "react";

/**
 * The top of a shop page (design/screens.md B1): a brand-colour banner, the
 * shop's logo over its edge, its name, whether it's open, a short line of
 * facts (rating, delivery time, Verified) and the delivery-and-call line
 * (`info`). The shop leads; Khmio stays in the background. One block for the
 * live shop and its mockup — words come in as props.
 */
export function ShopHero({
  name,
  logo,
  openLabel,
  facts,
  info,
  controls,
  highlight,
}: {
  name: string;
  /** The logo picture, or the shop's first letter. */
  logo: ReactNode;
  /** "Open now"; the page shows a closed notice instead of the shop when it isn't. */
  openLabel: string;
  /** Rating, delivery time, Verified badge … */
  facts?: ReactNode;
  /** "Delivery from $1 · Pickup · Provinces" with the call button (opens Shop info). */
  info?: ReactNode;
  /** Language and theme, top right of the banner. */
  controls?: ReactNode;
  /** A short line on the banner, e.g. "Up to 20% off". */
  highlight?: string;
}) {
  return (
    <section className="relative">
      {/* Brand colours (they follow the viewer's accent); a soft darker corner keeps the highlight readable. */}
      <div className="h-28 w-full bg-gradient-to-br from-brand via-brand to-nav-bg sm:h-40 lg:rounded-t-2xl" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-28 bg-gradient-to-t from-nav-bg/40 via-transparent to-transparent sm:h-40 lg:rounded-t-2xl" />
      {controls && <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-bg/90 p-0.5 shadow-card backdrop-blur">{controls}</div>}
      {highlight && <span className="absolute right-4 top-16 text-lg font-extrabold text-nav-fg drop-shadow sm:top-24 sm:text-2xl">{highlight}</span>}

      <div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-end sm:gap-4">
        <div className="-mt-9 flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-bg bg-brand text-2xl font-bold text-on-brand shadow-raised sm:-mt-12 sm:h-24 sm:w-24 sm:text-3xl">
          {logo}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold leading-normal sm:text-2xl">{name}</h1>
            <StatusPill tone="success">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              {openLabel}
            </StatusPill>
          </div>
          {facts && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">{facts}</div>}
        </div>
      </div>
      {info && <div className="px-4 pb-3">{info}</div>}
    </section>
  );
}
