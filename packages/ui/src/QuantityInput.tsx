"use client";

import { Minus, Plus } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export interface QuantityInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode" | "prefix"> {
  label: string;
  /** What's typed (whole units); the page turns it into a number. */
  value: string;
  onChange: (text: string) => void;
  /** Read out for the − and + buttons, from the translation files. */
  decreaseLabel: string;
  increaseLabel: string;
  /** The least − goes down to (0 for a count, 1 for a bill line). */
  min?: number;
  error?: string;
  /** The label is read out only (a table row whose column header names the box). */
  hideLabel?: boolean;
}

/** Whole units in the box, or `min` when it holds anything else. */
const unitsOf = (text: string, min: number) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : min);

/**
 * How many of something: a box to type in, with − and + either side (44 px
 * each) for a thumb on a phone. Typing stays free (the page checks it); the
 * buttons step whole units and never go below `min`.
 */
export const QuantityInput = forwardRef<HTMLInputElement, QuantityInputProps>(
  ({ label, value, onChange, decreaseLabel, increaseLabel, min = 0, error, hideLabel = false, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const step = (by: number) => onChange(String(Math.max(min, unitsOf(value, min) + by)));
    const button = "flex h-11 w-11 shrink-0 items-center justify-center text-brand hover:bg-brand/10 disabled:opacity-40";

    return (
      // relative: a hidden label (sr-only is absolutely placed) stays in this box, never stretching a scrolling table's page.
      <div className="relative flex flex-col gap-1.5">
        <label htmlFor={inputId} className={hideLabel ? "sr-only" : "text-sm font-medium text-fg"}>
          {label}
        </label>
        <div className={cn("flex items-stretch overflow-hidden rounded-DEFAULT border border-border bg-bg focus-within:ring-2 focus-within:ring-brand", error && "border-danger focus-within:ring-danger")}>
          <button type="button" aria-label={decreaseLabel} title={decreaseLabel} className={button} disabled={unitsOf(value, min) <= min} onClick={() => step(-1)}>
            <Minus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </button>
          <input
            ref={ref}
            id={inputId}
            inputMode="numeric"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn("min-h-touch w-full min-w-0 border-x border-border bg-bg px-2 text-center text-base font-semibold tabular-nums text-fg focus:outline-none", className)}
            {...props}
          />
          <button type="button" aria-label={increaseLabel} title={increaseLabel} className={button} onClick={() => step(1)}>
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
QuantityInput.displayName = "QuantityInput";
