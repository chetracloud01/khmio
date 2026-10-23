import { cn } from "@khmio/ui";
import type { ReactNode } from "react";

// The styleguide's own frame: a titled section, and a Demo box labelled with
// the part's name. The names are what coverage.test.ts looks for, so every
// kit part shown here is written as a quoted name in a Demo.

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border pb-8">
      <div>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** One part (or a few that are used together), with its code name above it. */
export function Demo({ name, children, className }: { name: string | string[]; children: ReactNode; className?: string }) {
  const names = Array.isArray(name) ? name : [name];
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {names.map((part) => (
          <code key={part} className="rounded-sm bg-border/30 px-1.5 py-0.5 text-xs text-muted">
            {part}
          </code>
        ))}
      </div>
      <div className={cn("flex min-w-0 flex-col gap-3", className)}>{children}</div>
    </div>
  );
}

export function Swatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex w-20 flex-col items-center gap-1 text-center">
      <div className={`h-14 w-14 rounded-DEFAULT border border-border ${className}`} />
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
