"use client";

import type { LucideIcon } from "lucide-react";
import { TONE_STYLES, type Tone } from "./blocks";
import { cn } from "./cn";

const SIZES = {
  sm: { box: "h-8 w-8", icon: "h-4 w-4" },
  md: { box: "h-10 w-10", icon: "h-5 w-5" },
  lg: { box: "h-12 w-12", icon: "h-6 w-6" },
} as const;

export interface IconBadgeProps {
  icon: LucideIcon;
  tone?: Tone;
  size?: keyof typeof SIZES;
  /** "square" (rounded, for menu rows and cards) or "circle" (status, round buttons). */
  shape?: "square" | "circle";
  /** Read out instead of hiding the icon (when the icon alone carries meaning). */
  label?: string;
  className?: string;
}

/** An icon on a soft tinted background: menu rows, order status circles, sheet headers. */
export function IconBadge({ icon: Icon, tone = "brand", size = "md", shape = "square", label, className }: IconBadgeProps) {
  return (
    <span
      title={label}
      className={cn("flex shrink-0 items-center justify-center", SIZES[size].box, shape === "circle" ? "rounded-full" : "rounded-xl", TONE_STYLES[tone], className)}
    >
      <Icon className={SIZES[size].icon} aria-hidden={label ? undefined : true} aria-label={label} />
    </span>
  );
}
