"use client";

import { Loader2, Upload } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { buttonVariants } from "./Button";
import { cn } from "./cn";

export interface FileButtonProps {
  /** What the button says (or, for "tile", what screen readers hear). From the translation files. */
  children: ReactNode;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** e.g. ACCEPTED_IMAGE_TYPES from packages/shared. */
  accept?: string;
  multiple?: boolean;
  /** Opens the camera first on a phone ("environment" = the back camera, for documents). */
  capture?: "user" | "environment";
  /** Uploading: a spinner instead of the icon, and no second pick meanwhile. */
  busy?: boolean;
  disabled?: boolean;
  /**
   * "button" — an outlined button (Upload logo);
   * "link" — brand text (Add logo, Replace);
   * "tile" — a dashed square that sits in a photo grid, icon only.
   */
  look?: "button" | "link" | "tile";
  /** Marks the picker for focusFirstInvalidField and draws it red. */
  invalid?: boolean;
  className?: string;
}

/**
 * Pick a photo or file. A real file input sits inside, hidden from view but
 * not from the keyboard, so Tab reaches it and Enter or Space opens the picker.
 */
export function FileButton({ children, onChange, accept, multiple, capture, busy = false, disabled = false, look = "button", invalid = false, className }: FileButtonProps) {
  const off = disabled || busy;
  const Icon = busy ? Loader2 : Upload;
  return (
    <label
      className={cn(
        "cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
        look === "button" && cn(buttonVariants({ variant: "secondary", size: "sm" }), invalid && "border-danger"),
        look === "link" && cn(buttonVariants({ variant: "ghost", tone: "brand" }), "px-0 hover:bg-transparent"),
        look === "tile" && cn("flex aspect-square flex-col items-center justify-center gap-1 rounded-DEFAULT border border-dashed text-muted hover:bg-border/10", invalid ? "border-danger" : "border-border"),
        off && "pointer-events-none opacity-60",
        className,
      )}
    >
      <Icon className={cn(look === "tile" ? "h-5 w-5" : "h-4 w-4", busy && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
      {look === "tile" ? <span className="sr-only">{children}</span> : children}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        disabled={off}
        aria-invalid={invalid || undefined}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  );
}
