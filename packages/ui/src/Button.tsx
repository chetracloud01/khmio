"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export const buttonVariants = cva(
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-DEFAULT px-6 text-base font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand text-on-brand hover:bg-brand/90",
        secondary: "border border-border bg-bg text-fg hover:bg-border/30",
        danger: "bg-danger text-white hover:bg-danger/90",
        /** Text only, for the small actions beside a form or card: "Resend code", "Remove option", "Start over". */
        ghost: "px-3 text-sm",
      },
      /** The ghost's text colour; the other variants ignore it. */
      tone: {
        brand: "",
        muted: "",
        danger: "",
      },
      size: {
        md: "",
        /** Smaller text and padding, same 44 px height. */
        sm: "px-3 text-sm",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "ghost", tone: "brand", className: "text-brand hover:bg-brand/5" },
      { variant: "ghost", tone: "muted", className: "text-muted hover:bg-border/30 hover:text-fg" },
      { variant: "ghost", tone: "danger", className: "text-danger hover:bg-danger/10" },
    ],
    defaultVariants: { variant: "primary", tone: "brand", size: "md", fullWidth: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, tone, size, fullWidth, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, tone, size, fullWidth }), className)}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
