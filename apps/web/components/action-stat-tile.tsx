"use client";

import { cn, TONE_STYLES, type Tone } from "@khmio/ui";
import { ArrowRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The tile's ring when it's the one the list follows. */
const ACTIVE_RING: Record<Tone, string> = {
  brand: "ring-brand",
  success: "ring-success",
  warning: "ring-warning",
  danger: "ring-danger",
  info: "ring-info",
  muted: "ring-muted",
};

/** The "what to do" line's colour. */
const ACTION_TEXT: Record<Tone, string> = {
  brand: "text-brand",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  muted: "text-muted",
};

/**
 * A number that leads somewhere (design/screens.md S13 "Purchases"): its
 * icon in a tone, how many and how much, and what to do there ("Pay now →").
 * Tapped, the list below follows it; the tile it follows is ringed, and
 * tapping it again lets go. Words come from the page that uses it.
 */
export function ActionStatTile({
  icon: Icon,
  tone,
  label,
  count,
  amount,
  sub,
  action,
  active,
  onSelect,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  /** "3 bills", top right; none when the amount is the count. */
  count?: string;
  /** "$1,044.50". */
  amount: string;
  /** A line under the amount (the other currency). */
  sub?: ReactNode;
  /** What to do there, shown when there's something to do. */
  action?: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "group flex h-full min-h-touch w-full min-w-0 flex-col gap-2 rounded-2xl border border-border bg-bg p-3 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        active && cn("ring-2", ACTIVE_RING[tone]),
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TONE_STYLES[tone])} aria-hidden="true">
          <Icon className="h-5 w-5" />
        </span>
        {count && <span className="text-right text-xs font-semibold text-muted">{count}</span>}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs leading-normal text-muted">{label}</span>
        <span className="text-lg font-bold tabular-nums leading-snug [overflow-wrap:anywhere]">{amount}</span>
        {sub && <span className="text-xs text-muted tabular-nums">{sub}</span>}
      </span>
      {action && (
        <span className={cn("mt-auto inline-flex items-center gap-1 text-xs font-semibold", ACTION_TEXT[tone])}>
          {action}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}
