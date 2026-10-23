"use client";

import type { FormErrorCode } from "@khmio/shared";
import { Button, cn } from "@khmio/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

// The standard form, used by every merchant and admin form (docs/blueprint.md
// "Admin area standards" → "Every form"):
// - fields grouped in FormSection blocks (what the group is for, then the fields);
// - edits go into a local draft, never straight into saved data;
// - Save runs the shared Zod schema from packages/shared; problems come back as
//   FormErrorCode per field, shown under the field, and the first one is focused;
// - a sticky FormActions bar, active only once something changed.

/**
 * A long form's groups as a row of chips under the title, each jumping to its
 * FormSection (by id) — so a seller on a phone goes straight to "Invoices".
 */
export function SectionJumpLinks({ label, links }: { label: string; links: { id: string; label: string }[] }) {
  return (
    <nav aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {links.map((link) => (
        <a
          key={link.id}
          href={`#${link.id}`}
          className="flex min-h-touch shrink-0 items-center rounded-full border border-border bg-bg px-4 text-sm font-medium hover:border-brand/40 hover:bg-brand/5"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

/** Standard form row: what this group of fields is for, then the fields. Side by side on laptop. */
export function FormSection({
  id,
  title,
  description,
  children,
  stacked = false,
}: {
  /** Lets other screens link straight here, e.g. profile#payments. */
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  /** Keep the heading above the fields at every width — for narrow merchant forms. */
  stacked?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "grid scroll-mt-24 gap-4 border-b border-border py-6 first:pt-0 last:border-b-0",
        !stacked && "md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-8",
      )}
    >
      <div>
        <h2 className="font-semibold text-fg">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {/* min-w-0: a long one-line value (an address in a row) shortens with "…" instead of widening the form. */}
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/** A read-only value shown in the same shape as a form field. */
export function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">{label}</span>
      <div className="flex min-h-touch items-center rounded-DEFAULT border border-border bg-border/10 px-3 text-base text-muted">
        {value}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Sticky Save/Cancel bar at the bottom of a form; only active once something changed. */
export function FormActions({
  dirty,
  onCancel,
  onSave,
  saveLabel,
  cancelLabel,
  status,
  className,
  canCancel = dirty,
}: {
  dirty: boolean;
  /** Cancel is usually only useful after a change; a page form whose Cancel leaves the page keeps it on. */
  canCancel?: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  cancelLabel: string;
  /** e.g. "Unsaved changes" or "Saved" — already translated. */
  status?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-bg px-4 py-3 md:-mx-6 md:px-6",
        className,
      )}
    >
      {/* One row on a phone: the status is read out by screen readers there and shown from sm up. */}
      <span className="sr-only text-sm text-muted sm:not-sr-only sm:mr-auto" role="status">
        {status}
      </span>
      <Button variant="secondary" onClick={onCancel} disabled={!canCancel} className="flex-1 sm:flex-none">
        {cancelLabel}
      </Button>
      <Button variant="primary" onClick={onSave} disabled={!dirty} className="flex-1 sm:flex-none">
        {saveLabel}
      </Button>
    </div>
  );
}

/** Turns a schema error code into text in the viewer's language. */
export function useFormErrorText(): (code: FormErrorCode | undefined) => string | undefined {
  const t = useTranslations("FormErrors");
  return (code) => (code ? t(code) : undefined);
}

/**
 * After a failed save: once the errors have rendered, move to the first
 * field marked invalid so the merchant sees what to fix (blueprint
 * "Validation behaviour").
 */
export function focusFirstInvalidField(container: HTMLElement | null) {
  window.requestAnimationFrame(() => {
    // data-invalid marks fields that can't carry aria-invalid, like a photo picker button.
    const field = container?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
    if (!field) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
