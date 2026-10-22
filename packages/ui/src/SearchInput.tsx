"use client";

import { Search, X } from "lucide-react";
import { forwardRef } from "react";
import { PillInput, type PillInputProps } from "./PillInput";

export interface SearchInputProps extends Omit<PillInputProps, "label" | "icon" | "action"> {
  /** Read out for the box; the placeholder when not given. */
  label?: string;
  /** Shows a 44px clear button while there's text. The caller supplies the translated label. */
  onClear?: () => void;
  clearLabel?: string;
}

/** A search box: the shared PillInput with a search glass and, while there's text, a clear button. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({ label, onClear, clearLabel, value, placeholder, ...props }, ref) => {
  const showClear = !!onClear && !!clearLabel && typeof value === "string" && value.length > 0;
  return (
    <PillInput
      ref={ref}
      type="search"
      label={label ?? props["aria-label"] ?? placeholder ?? ""}
      labelHidden
      icon={<Search />}
      value={value}
      placeholder={placeholder}
      action={
        showClear ? (
          // The browser's own clear "x" differs per browser; ours is the same everywhere.
          <button type="button" onClick={onClear} aria-label={clearLabel} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-fg">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : undefined
      }
      {...props}
    />
  );
});
SearchInput.displayName = "SearchInput";
