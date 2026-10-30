"use client";

import { formatKhmerPhoneLocal } from "@khmio/shared";
import { cn } from "@khmio/ui";
import { forwardRef, type ReactNode } from "react";

// The pieces every printed document is made of (design/screens.md B7 and
// S13 "Printing"): the paper itself, the shop's header with the document's
// title and stamps, label–value rows, dividers, and signature lines. On white
// paper in both themes, because they're printed, saved as an image or PDF and
// shared. They take their words from the document that uses them.

export type PaperSize = "a4" | "receipt";

/** Width of the saved image / PDF page: A4 at 96 dpi, and an 80 mm roll's printable 72 mm. */
export const PAPER_EXPORT_WIDTH: Record<PaperSize, number> = { a4: 794, receipt: 302 };

export interface PaperShop {
  name: string;
  logoUrl?: string | null;
  /** 855… */
  phone?: string;
  address?: string;
  taxNumber?: string;
  telegram?: string;
  facebook?: string;
}

/** The stamp's ink: green when settled, red when something is owed or late, grey when void. */
export type StampTone = "paid" | "unpaid" | "void";
const STAMP: Record<StampTone, string> = {
  paid: "border-paper-paid text-paper-paid",
  unpaid: "border-paper-unpaid text-paper-unpaid",
  void: "border-paper-void text-paper-void",
};

export function PaperStamp({ tone, children }: { tone: StampTone; children: ReactNode }) {
  return <span className={cn("inline-block -rotate-6 rounded-md border-2 px-3 py-0.5 text-sm font-bold uppercase leading-normal tracking-wide", STAMP[tone])}>{children}</span>;
}

/**
 * The sheet: A4 (a page, wide from `sm`) or an 80 mm receipt roll.
 * `fixedWidth`: the off-screen copy at paper width that becomes the image and
 * PDF — always the wide layout.
 */
export const Paper = forwardRef<HTMLDivElement, { size: PaperSize; fixedWidth?: boolean; className?: string; children: ReactNode }>(function Paper({ size, fixedWidth = false, className, children }, ref) {
  const receipt = size === "receipt";
  return (
    <div
      ref={ref}
      className={cn(
        "relative mx-auto flex flex-col bg-paper font-khmer leading-relaxed text-paper-ink",
        receipt ? "gap-3 px-4 py-5" : fixedWidth ? "gap-6 p-10" : "gap-6 p-5 sm:p-10",
        fixedWidth ? "" : receipt ? "w-full max-w-[302px]" : "w-full max-w-[794px]",
        className,
      )}
      style={fixedWidth ? { width: PAPER_EXPORT_WIDTH[size] } : undefined}
    >
      {children}
    </div>
  );
});

/** The shop on the left (logo, name, address, contacts, tax number), the document's title and stamps on the right; centred on a receipt. */
export function PaperHeader({ shop, taxText, title, stamps, receipt }: { shop: PaperShop; /** "VAT TIN: …", when the shop has one. */ taxText?: string; title: string; stamps?: ReactNode; receipt: boolean }) {
  const contacts = [shop.phone && formatKhmerPhoneLocal(shop.phone), shop.telegram, shop.facebook].filter(Boolean);
  const logo = shop.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- also drawn into the saved image, which needs a plain <img>
    <img src={shop.logoUrl} alt="" className={cn("shrink-0 rounded-xl object-cover", receipt ? "h-14 w-14" : "h-16 w-16")} />
  ) : (
    <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-xl bg-paper-brand font-bold text-paper", receipt ? "h-14 w-14 text-2xl" : "h-16 w-16 text-3xl")}>
      {shop.name.charAt(0).toUpperCase()}
    </span>
  );
  return (
    <header className={cn("flex gap-4", receipt ? "flex-col items-center text-center" : "flex-wrap items-start justify-between")}>
      <div className={cn("flex min-w-0 gap-3", receipt ? "flex-col items-center" : "items-start")}>
        {logo}
        <div className="min-w-0">
          <p className="text-lg font-bold leading-normal">{shop.name}</p>
          {shop.address && <p className="text-xs text-paper-muted">{shop.address}</p>}
          {contacts.length > 0 && <p className="text-xs text-paper-muted">{contacts.join(" · ")}</p>}
          {taxText && <p className="text-xs text-paper-muted">{taxText}</p>}
        </div>
      </div>
      <div className={cn("flex flex-col gap-1", receipt ? "items-center" : "items-end text-right")}>
        <h1 className="text-2xl font-bold uppercase leading-normal tracking-wide">{title}</h1>
        {stamps && <div className={cn("flex flex-wrap gap-2", receipt ? "justify-center" : "justify-end")}>{stamps}</div>}
      </div>
    </header>
  );
}

/** A label and its value on one line (a <dl> row). */
export function PaperRow({ label, value, strong = false, mono = false }: { label: string; value: ReactNode; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-paper-muted">{label}</dt>
      <dd className={cn("text-right tabular-nums", strong && "font-semibold", mono && "tracking-wider")}>{value}</dd>
    </div>
  );
}

export function PaperDivider({ receipt }: { receipt: boolean }) {
  return <hr className={cn("border-paper-ink", receipt ? "border-dashed" : "border-t-2")} />;
}

/** Lines to sign on, each with who signs under it: side by side on A4, one under another on a receipt. */
export function PaperSignatures({ labels, receipt }: { labels: string[]; receipt: boolean }) {
  return (
    <section className={cn("grid gap-6 pt-6 text-xs text-paper-muted", receipt ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3")}>
      {labels.map((label) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <span className="h-10 w-full border-b border-paper-ink" aria-hidden="true" />
          <span>{label}</span>
        </div>
      ))}
    </section>
  );
}
