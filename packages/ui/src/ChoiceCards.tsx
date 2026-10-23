"use client";

import { Check, type LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { radioKeyDown, radioTabIndex } from "./radio-keys";

export interface ChoiceCardOption {
  value: string;
  title: string;
  detail?: string;
  icon?: LucideIcon;
}

export interface ChoiceCardsProps {
  /** Names the group for screen readers (usually the question above it). */
  label: string;
  options: ChoiceCardOption[];
  /** null while nothing is chosen yet. */
  value: string | null;
  onChange: (value: string) => void;
  /**
   * "compact" — small cards side by side (delivery or pickup);
   * "large" — big cards with the icon on a tile (business type);
   * "rows" — one row per choice with a tick (payment method).
   */
  variant?: "compact" | "large" | "rows";
  /** Cards per row for "compact" and "large". */
  columns?: 1 | 2 | 3;
  /** Marks the group for focusFirstInvalidField when its error is shown. */
  invalid?: boolean;
  className?: string;
}

const COLUMNS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-2 md:grid-cols-3" } as const;

/** Pick one of a few, shown as cards or rows; read out as radio buttons. */
export function ChoiceCards({ label, options, value, onChange, variant = "compact", columns = 2, invalid = false, className }: ChoiceCardsProps) {
  const values = options.map((option) => option.value);
  const rows = variant === "rows";

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      data-invalid={invalid ? "true" : undefined}
      tabIndex={-1}
      onKeyDown={(event) => radioKeyDown(event, values, value, onChange)}
      className={cn(rows ? "flex flex-col gap-2" : cn("grid gap-3", COLUMNS[columns]), className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={radioTabIndex(values, value, option.value)}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex min-h-touch border-2 text-left transition-colors",
              selected ? "border-brand bg-brand/5" : "border-border bg-bg hover:bg-border/10",
              variant === "compact" && "flex-col items-start gap-1 rounded-2xl p-3",
              variant === "large" && "flex-col items-start gap-3 rounded-2xl p-4",
              rows && "items-center justify-between gap-3 rounded-DEFAULT px-4 py-2",
            )}
          >
            {Icon && variant === "compact" && <Icon className={cn("h-5 w-5", selected ? "text-brand" : "text-muted")} aria-hidden="true" />}
            {Icon && variant === "large" && (
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-DEFAULT", selected ? "bg-brand text-on-brand" : "bg-brand/10 text-brand")}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
            )}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={cn(variant === "compact" ? "text-sm font-semibold" : rows ? "font-medium" : "font-semibold")}>{option.title}</span>
              {option.detail && <span className="text-sm text-muted">{option.detail}</span>}
            </span>
            {selected && variant === "large" && <Check className="absolute right-3 top-3 h-5 w-5 text-brand" aria-hidden="true" />}
            {selected && rows && <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
