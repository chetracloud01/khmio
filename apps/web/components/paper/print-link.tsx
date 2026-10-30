"use client";

import { buttonVariants, cn } from "@khmio/ui";
import { Printer } from "lucide-react";
import Link from "next/link";

/**
 * Opens a document's print page: a button with its words (a page's header),
 * or only the printer icon (a row in a list), named for screen readers.
 */
export function PrintLink({ href, label, iconOnly = false }: { href: string; label: string; iconOnly?: boolean }) {
  if (iconOnly)
    return (
      <Link href={href} aria-label={label} title={label} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-border/30 hover:text-fg">
        <Printer className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "secondary" }))}>
      <Printer className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
