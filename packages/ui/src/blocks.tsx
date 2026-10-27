"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { cn } from "./cn";
import { Skeleton } from "./Skeleton";

// The standard building blocks of every app screen — admin, seller and their
// mockups (docs/blueprint.md "Admin area standards", design/design-standard.md).
// One copy here, used everywhere: a page never re-creates a header, a status
// badge or an empty state of its own. Like the rest of this package they hold
// no words — every label comes from the caller (messages/*.json).

/** The colour roles a badge, a stat card or a notice can take — only tokens, so themes and accents follow. */
export type Tone = "brand" | "success" | "warning" | "danger" | "info" | "muted";

export const TONE_STYLES: Record<Tone, string> = {
  brand: "bg-brand/10 text-brand",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  muted: "bg-border/30 text-muted",
};

/** A small status badge ("Active", "Failed"). Give a tone, or classes from a page's own status map. */
export function StatusPill({ tone, className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tone && TONE_STYLES[tone], className)}>
      {children}
    </span>
  );
}

/** Title, one line about the page, and its main buttons on the right. Every page starts with it. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A small heading over a block of the page, with an optional link or button on the right. */
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {aside}
    </div>
  );
}

/** The small grey heading over a group of rows or fields ("YOUR SHOP", "LANGUAGE & DISPLAY"). */
export function GroupTitle({ id, as: Tag = "h2", children, className }: { id?: string; as?: "h2" | "h3" | "p" | "span" | "div"; children: ReactNode; className?: string }) {
  return (
    <Tag id={id} className={cn("px-1 text-xs font-semibold uppercase tracking-wide text-muted", className)}>
      {children}
    </Tag>
  );
}

/** One key number: icon, value, label. */
/**
 * One number with its label. `detail` is an optional second line under the
 * number — the other currency ("+ 80,000៛"; dollars and riel are never added
 * together) or a comparison ("12 last week").
 */
export function StatCard({ icon: Icon, label, value, detail, tone = "brand" }: { icon: LucideIcon; label: string; value: string; detail?: ReactNode; tone?: Tone }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-DEFAULT", TONE_STYLES[tone])}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {detail && <span className="text-sm font-medium tabular-nums text-muted">{detail}</span>}
      </span>
      <span className="text-xs leading-normal text-muted">{label}</span>
    </Card>
  );
}

/** Nothing here yet: an optional icon (or a picture such as Mio), one sentence, and the next step. */
export function EmptyState({ icon: Icon, art, title, body, action }: { icon?: LucideIcon; art?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {art}
      {!art && Icon && (
        <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-border/20">
          <Icon className="h-6 w-6 text-muted" aria-hidden="true" />
        </span>
      )}
      <p className="font-medium text-fg">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Grey blocks in the shape of a page while it loads — never a blank page or a spinner. */
export function LoadingBlocks({ label, rows = 1 }: { label: string; rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-48 rounded-2xl" />
      ))}
    </div>
  );
}

/** Something failed to load: what happened, and a way to try again. */
export function ErrorState({ title, body, retryLabel, onRetry }: { title: string; body?: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      <Button variant="primary" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

/** Label–value pairs in a details panel. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-DEFAULT bg-border/10 p-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd className="break-words font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Centred confirm for risky actions. Escape or the backdrop cancels. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* The dimmed backdrop closes on click but stays out of the accessibility tree,
          so screen readers only hear the dialog's own buttons. */}
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-fg/40" />
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 flex w-full max-w-sm flex-col gap-3 rounded-DEFAULT bg-bg p-5 shadow-raised">
        <h2 id={titleId} className="font-semibold text-fg">
          {title}
        </h2>
        <p className="text-sm text-muted">{body}</p>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
