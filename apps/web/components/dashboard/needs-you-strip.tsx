"use client";

import { cn, type Tone } from "@khmio/ui";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { TONE_TEXT } from "@/components/order-ui";

export interface NeedsYouItem {
  key: string;
  icon: LucideIcon;
  tone: Tone;
  /** "3 orders to handle". */
  text: string;
  href: string;
  /** Only what has something to do is shown. */
  show: boolean;
}

/**
 * What needs the seller now (the dashboard's first line, design/screens.md
 * S3): one link each — orders to handle, cash to collect, items to reorder,
 * bills overdue — only those with something to do; nothing: all caught up.
 */
export function NeedsYouStrip({ title, items, allClear }: { title: string; items: readonly NeedsYouItem[]; allClear: string }) {
  const shown = items.filter((item) => item.show);
  if (shown.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm font-medium text-success">
        <Check className="h-4 w-4" aria-hidden="true" />
        {allClear}
      </p>
    );
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link href={item.href} className="group flex h-full min-h-touch items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2 shadow-card transition-colors hover:border-brand/40">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas", TONE_TEXT[item.tone])} aria-hidden="true">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium">{item.text}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
