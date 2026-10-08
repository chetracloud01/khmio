"use client";

import { cn } from "@khmio/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

// The frame every buyer screen after the shop page shares (cart, checkout,
// payment, order success): one readable column — full width on phones, a
// centred card on the page background from tablet up, like a hosted checkout.

/**
 * `wide`: the redesigned layout — up to 1100 px on the page background, so a
 * laptop can show the page beside a summary column (BuyerColumns). Phones
 * look the same either way. Without it: today's single 560 px column.
 */
export function BuyerShell({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className="min-h-dvh bg-canvas text-fg">
      <div
        className={cn(
          "mx-auto flex min-h-dvh w-full flex-col",
          wide ? "max-w-[1100px] bg-bg lg:bg-transparent" : "max-w-[560px] bg-bg md:border-x md:border-border",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The wide layout's body: the page on the left and, from 1024 px, a sticky
 * column on the right (cart, order summary, the next button). On a phone the
 * aside isn't shown here — pages put what matters from it in the flow and
 * the bottom bar.
 */
export function BuyerColumns({ children, aside, plain = false }: { children: ReactNode; aside?: ReactNode; /** No card around the page (it's made of its own cards, e.g. checkout's sections). */ plain?: boolean }) {
  return (
    <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:p-6">
      <div className={cn("flex min-w-0 flex-col", !plain && "lg:rounded-2xl lg:border lg:border-border lg:bg-bg")}>{children}</div>
      {aside && <aside className="sticky top-6 hidden flex-col gap-4 lg:flex">{aside}</aside>}
    </div>
  );
}

/** A numbered step of a one-page form (checkout: 1 You · 2 How to get it · 3 Payment). */
export function BuyerSection({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-bg p-4">
      <h2 className="flex items-center gap-3 font-semibold">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand" aria-hidden="true">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Sticky top bar: a 44px back button, the title, and optional extra content (e.g. progress steps). */
export function BuyerTopBar({
  backHref,
  backLabel,
  title,
  subtitle,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex flex-col gap-2 border-b border-border bg-bg px-2 py-2">
      <div className="flex items-center gap-1">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/30"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-normal">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </header>
  );
}

/** Where the buyer is in Cart → Checkout → Pay. */
export function BuyerSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 px-2 pb-1">
      {steps.map((step, index) => (
        <li key={step} className="flex min-w-0 flex-1 flex-col gap-1" aria-current={index === current ? "step" : undefined}>
          <span className={cn("h-1 rounded-full", index <= current ? "bg-brand" : "bg-border")} aria-hidden="true" />
          <span className={cn("truncate text-xs", index === current ? "font-semibold text-fg" : "text-muted")}>{step}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Fixed bottom action bar, the width of the column, clear of the phone's home
 * bar. `wide`: for the wide layout — on a phone and tablet only, since from
 * 1024 px the action sits in the side column.
 */
export function BuyerBottomBar({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("fixed inset-x-0 bottom-0 z-30", wide && "lg:hidden")}>
      <div
        className={cn(
          "pb-safe mx-auto w-full border-t border-border bg-bg px-4 pt-3 shadow-[0_-4px_12px_rgb(15_23_42/0.06)]",
          wide ? "max-w-[1100px]" : "max-w-[560px] md:border-x",
        )}
      >
        {children}
      </div>
    </div>
  );
}
