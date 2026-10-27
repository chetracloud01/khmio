"use client";

import { cn } from "./cn";
import { radioKeyDown, radioTabIndex } from "./radio-keys";

export interface OptionChip {
  value: string;
  label: string;
  /** A short second line, e.g. "+$0.50". */
  detail?: string;
  disabled?: boolean;
}

export interface OptionChipsProps {
  /** Names the group for screen readers (usually the heading above it). */
  label: string;
  options: OptionChip[];
  /** "one" — pick one (read out as radio buttons); "many" — pick any number (checkboxes). */
  mode: "one" | "many";
  /** The picked values; "one" holds at most one. */
  value: string[];
  onChange: (value: string[]) => void;
  /** Marks the group for focusFirstInvalidField when its error is shown. */
  invalid?: boolean;
  className?: string;
}

/**
 * Small chips to pick from, wrapping onto more lines: a size or a colour,
 * sugar level, add-ons. Each is a 44 px tap target.
 */
export function OptionChips({ label, options, mode, value, onChange, invalid = false, className }: OptionChipsProps) {
  const one = mode === "one";
  const values = options.map((option) => option.value);
  const current = value[0] ?? null;
  return (
    <div
      role={one ? "radiogroup" : "group"}
      aria-label={label}
      aria-invalid={invalid || undefined}
      data-invalid={invalid ? "true" : undefined}
      tabIndex={-1}
      onKeyDown={one ? (event) => radioKeyDown(event, values, current, (next) => onChange([next])) : undefined}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role={one ? "radio" : "checkbox"}
            aria-checked={selected}
            tabIndex={one ? radioTabIndex(values, current, option.value) : undefined}
            disabled={option.disabled}
            onClick={() => onChange(one ? [option.value] : selected ? value.filter((entry) => entry !== option.value) : [...value, option.value])}
            className={cn(
              "flex min-h-touch min-w-touch flex-col items-center justify-center rounded-DEFAULT border px-3 py-1 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
              selected ? "border-brand bg-brand text-on-brand" : "border-border bg-bg text-fg hover:border-brand",
            )}
          >
            {option.label}
            {option.detail && <span className={cn("text-xs font-normal", selected ? "text-on-brand/90" : "text-muted")}>{option.detail}</span>}
          </button>
        );
      })}
    </div>
  );
}
