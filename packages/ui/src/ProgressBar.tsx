import { cn } from "./cn";
import type { Tone } from "./blocks";

/** The filled part's colour for each tone. */
const FILL: Record<Tone, string> = {
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  muted: "bg-muted",
};

export interface ProgressBarProps {
  /** How far along (clamped to 0…max). */
  value: number;
  max: number;
  /** Read out to screen readers ("Paid $40 of $100"); the bar itself shows no words. */
  label: string;
  tone?: Tone;
  /** "sm" a thin line in a list or card; "md" (default) a page's main figure. */
  size?: "sm" | "md";
  className?: string;
}

/** How much of something is done: setup steps, a bill paid off. */
export function ProgressBar({ value, max, label, tone = "brand", size = "md", className }: ProgressBarProps) {
  const done = max > 0 ? Math.min(max, Math.max(0, value)) : 0;
  const percent = max > 0 ? (done / max) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={done}
      className={cn("overflow-hidden rounded-full bg-border/40", size === "sm" ? "h-1.5" : "h-2.5", className)}
    >
      <div className={cn("h-full rounded-full transition-all motion-reduce:transition-none", FILL[tone])} style={{ width: `${percent}%` }} />
    </div>
  );
}
