"use client";

import { forwardRef, useId } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface PillInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Read out for the field; shown above it unless `labelHidden`. */
  label: string;
  labelHidden?: boolean;
  /** A small icon at the start (e.g. a search glass, a ticket, a phone). */
  icon?: ReactNode;
  /** Inside the pill at the end: a submit button ("Find") or a clear button. */
  action?: ReactNode;
  /** Shown under the field in red; also outlines it. */
  error?: string;
  /** Marks the field wrong without a message under it (the caller shows one elsewhere). */
  invalid?: boolean;
  /** "md" 44px (search, find), "lg" 52px (a form's main fields, e.g. Track my order). */
  size?: "md" | "lg";
  /** A code typed in capitals with wide letters (tracking codes); the placeholder stays normal. */
  code?: boolean;
}

/**
 * The one rounded field of the app: a pill with an icon, the input and an
 * optional button inside. Search boxes (SearchInput), "Find order by code"
 * and the buyer's "Track my order" are all this field.
 */
export const PillInput = forwardRef<HTMLInputElement, PillInputProps>(
  ({ label, labelHidden = false, icon, action, error, invalid = false, size = "md", code = false, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const wrong = invalid || !!error;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className={cn("px-1 text-sm font-medium text-fg", labelHidden && "sr-only")}>
          {label}
        </label>
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border bg-canvas pl-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30",
            action ? "p-1" : "pr-4",
            wrong ? "border-danger" : "border-border",
          )}
        >
          {icon && <span className="flex shrink-0 text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={wrong || undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              "min-w-0 flex-1 bg-transparent text-base text-fg placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden",
              size === "lg" ? "min-h-[52px]" : "min-h-touch",
              code && "uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal",
              className,
            )}
            {...props}
          />
          {action}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="px-1 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);
PillInput.displayName = "PillInput";

/** The button inside a PillInput: teal, round, its text (or icon) given by the caller. */
export function PillInputButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("flex min-h-touch shrink-0 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-on-brand disabled:opacity-60", className)} {...props} />;
}
