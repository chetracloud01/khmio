"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";
import { radioKeyDown, radioTabIndex } from "./radio-keys";

/** `V` is the values' own type ("today" | "week"), so onChange hands back that type, never a plain string. */
export interface SegmentedControlOption<V extends string = string> {
  value: V;
  label: ReactNode;
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
  className?: string;
}

export function SegmentedControl<V extends string>({ options, value, onChange, mode = "tabs", label, className }: SegmentedControlProps<V>) {
  const choice = mode === "choice";
  const values = options.map((option) => option.value);
  return (
    <div
      role={choice ? "radiogroup" : "tablist"}
      aria-label={label}
      onKeyDown={choice ? (event) => radioKeyDown(event, values, value, onChange) : undefined}
      className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-border/10 p-1", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role={choice ? "radio" : "tab"}
          aria-selected={choice ? undefined : value === option.value}
          aria-checked={choice ? value === option.value : undefined}
          tabIndex={choice ? radioTabIndex(values, value, option.value) : undefined}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-touch shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
            value === option.value ? "bg-brand text-on-brand" : "text-muted hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
