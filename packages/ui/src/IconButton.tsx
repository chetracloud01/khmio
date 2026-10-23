"use client";

import type { LucideIcon } from "lucide-react";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

const TONES = {
  default: "text-fg",
  muted: "text-muted hover:text-fg",
  danger: "text-danger",
} as const;

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  icon: LucideIcon;
  /** Read out by screen readers and shown on hover: an icon alone says nothing to them. From the translation files. */
  label: string;
  /**
   * "plain" — no background until hovered (remove a zone, unlink a group);
   * "floating" — a round white button over a photo (close, previous, next);
   * "badge" — a small solid red circle on a photo's corner (remove photo).
   */
  look?: "plain" | "floating" | "badge";
  /** Colour of the icon for "plain" and "floating"; "badge" is always red. */
  tone?: keyof typeof TONES;
}

/**
 * A button that is only an icon, always with a 44 px tap area (design
 * standard) — the "badge" look draws a 32 px circle inside it.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, look = "plain", tone = "default", className, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-40",
          look === "plain" && cn("rounded-DEFAULT", TONES[tone], tone === "danger" ? "hover:bg-danger/10" : "hover:bg-border/30"),
          look === "floating" && cn("rounded-full bg-bg/85 shadow-card hover:bg-bg", TONES[tone]),
          look === "badge" && "rounded-full",
          className,
        )}
        {...props}
      >
        {look === "badge" ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-danger text-bg">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : (
          <Icon className={look === "floating" ? "h-5 w-5" : "h-4 w-4"} aria-hidden="true" />
        )}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
