"use client";

import { useId } from "react";
import { cn } from "./cn";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** One line under the label saying what the current position means. */
  description?: string;
  /** Only the toggle shows (the label is still read out): for a switch inside a list row. */
  labelHidden?: boolean;
  className?: string;
}

/** An on/off setting that takes effect as a whole row: tap anywhere on it. */
export function Switch({ checked, onChange, label, description, labelHidden = false, className }: SwitchProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={() => onChange(!checked)}
      className={cn("flex min-h-touch items-center justify-between gap-4 text-left", labelHidden ? "min-w-touch justify-center" : "w-full", className)}
    >
      <span className={cn("flex min-w-0 flex-col", labelHidden && "sr-only")}>
        <span id={labelId} className="text-sm font-medium text-fg">
          {label}
        </span>
        {description && (
          <span id={descriptionId} className="text-sm text-muted">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors motion-reduce:transition-none",
          checked ? "bg-brand" : "bg-border",
        )}
      >
        <span
          className={cn(
            "h-6 w-6 rounded-full bg-bg shadow-card transition-transform motion-reduce:transition-none",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}
