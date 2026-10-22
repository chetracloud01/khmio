"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** With a label the whole row (44px tall) is the tap target; without one, give `aria-label`. */
  label?: string;
  /** One line under the label. */
  description?: string;
}

/**
 * The one tick box of the app, for choosing (rows in a list, columns to
 * show, "remember my details"). For a setting that is on or off, use Switch.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ label, description, className, disabled, ...props }, ref) => {
  const box = <input ref={ref} type="checkbox" disabled={disabled} className={cn("h-5 w-5 shrink-0 cursor-pointer rounded accent-brand disabled:cursor-not-allowed", label && description && "mt-0.5", className)} {...props} />;
  if (!label) return box;
  return (
    <label className={cn("flex min-h-touch items-center gap-3 text-sm", description && "items-start py-2", disabled ? "text-muted" : "cursor-pointer")}>
      {box}
      <span className="min-w-0">
        <span className="block">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
});
Checkbox.displayName = "Checkbox";
