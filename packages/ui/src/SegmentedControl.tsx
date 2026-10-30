"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TONE_STYLES, type Tone } from "./blocks";
import { cn } from "./cn";
import { radioKeyDown, radioTabIndex } from "./radio-keys";

/** `V` is the values' own type ("today" | "week"), so onChange hands back that type, never a plain string. */
export interface SegmentedControlOption<V extends string = string> {
  value: V;
  label: ReactNode;
  /** An icon before the label. */
  icon?: LucideIcon;
  /** A small count after the label (what needs attention there), in a tone; left out or 0: none. */
  badge?: { value: number; tone?: Tone; label?: string };
}

export interface SegmentedControlProps<V extends string = string> {
  options: SegmentedControlOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /**
   * "tabs" (default) switches what the page shows; "choice" is a form answer
   * (Phnom Penh or province, USD or KHR) and is read out as radio buttons.
   */
  mode?: "tabs" | "choice";
  /** Names the group for screen readers; needed with "choice". */
  label?: string;
  /** "md" (default); "sm" fits four short tabs on a 360 px phone (still 44 px tall). */
  size?: "md" | "sm";
  /**
   * "pill" (default): rounded buttons in a tray, the active one filled.
   * "underline": flat tabs across a line, the active one in brand colour over
   * a thick underline — a section's own pages (Stock · Purchases · Suppliers).
   */
  look?: "pill" | "underline";
  className?: string;
}

/** A tab's count, in its tone; nothing at 0. */
function badge(value: SegmentedControlOption["badge"]) {
  if (!value || value.value <= 0) return null;
  return (
    <span aria-label={value.label} className={cn("inline-block min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums leading-5", TONE_STYLES[value.tone ?? "muted"])}>
      {value.value}
    </span>
  );
}

export function SegmentedControl<V extends string>({ options, value, onChange, mode = "tabs", label, size = "md", look = "pill", className }: SegmentedControlProps<V>) {
  const choice = mode === "choice";
  const underline = look === "underline";
  const values = options.map((option) => option.value);
  return (
    <div
      role={choice ? "radiogroup" : "tablist"}
      aria-label={label}
      onKeyDown={choice ? (event) => radioKeyDown(event, values, value, onChange) : undefined}
      className={cn(
        underline ? "flex items-stretch gap-1 border-b border-border" : "inline-flex items-center gap-1 rounded-full border border-border bg-border/10 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role={choice ? "radio" : "tab"}
            aria-selected={choice ? undefined : active}
            aria-checked={choice ? active : undefined}
            tabIndex={choice ? radioTabIndex(values, value, option.value) : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-touch shrink-0 items-center font-medium transition-colors",
              underline
                ? // A phone: equal columns, icon and badge over a small label, so four fit on 360 px; wider: one line each.
                  cn(
                    "-mb-px min-w-0 flex-1 flex-col justify-center gap-0.5 border-b-[3px] px-1 py-1.5 text-xs sm:flex-none sm:flex-row sm:gap-2 sm:py-0 sm:text-sm",
                    size === "sm" ? "sm:px-3" : "sm:px-4",
                    active ? "border-brand text-brand" : "border-transparent text-muted hover:border-border hover:text-fg",
                  )
                : cn("gap-2 rounded-full text-sm", size === "sm" ? "px-3" : "px-4", active ? "bg-brand text-on-brand" : "text-muted hover:text-fg"),
            )}
          >
            {underline ? (
              <>
                <span className="inline-flex items-center gap-1">
                  {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  <span className="sm:hidden">{badge(option.badge)}</span>
                </span>
                <span className="max-w-full truncate">{option.label}</span>
                <span className="hidden sm:inline">{badge(option.badge)}</span>
              </>
            ) : (
              <>
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {option.label}
                {badge(option.badge)}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
