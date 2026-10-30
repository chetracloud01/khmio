"use client";

import { cn } from "@khmio/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode, type Ref } from "react";
import { DocumentActions, PaperPrintStyle } from "./document-actions";
import type { PaperSize } from "./paper-parts";

/**
 * A printed document's whole page — an invoice (design/screens.md B7), a
 * bill, a return or a payment voucher (S13): the back link, the size switch
 * and buttons, the document, and its off-screen copy at paper width that
 * becomes the image and PDF. `render` draws the document at a size; with
 * `fixedWidth` and `ref` it's that copy.
 */
export function DocumentScreen({
  render,
  backHref,
  backLabel,
  badge,
  initialSize = "a4",
  fileName,
  shareTitle,
  documentName,
  contentKey,
}: {
  render: (size: PaperSize, copy?: { fixedWidth: true; ref: Ref<HTMLDivElement> }) => ReactNode;
  backHref: string;
  backLabel: string;
  badge?: string;
  /** "receipt" for what's printed on an 80 mm roll. */
  initialSize?: PaperSize;
  /** Without extension: "receipt-SOK-123456". */
  fileName: string;
  shareTitle: string;
  /** "Invoice", "Bill"…, for the share button. */
  documentName: string;
  /** Changes whenever what the document shows changes. */
  contentKey: string;
}) {
  const [size, setSize] = useState<PaperSize>(initialSize);
  const exportRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-dvh bg-canvas text-fg print:min-h-0 print:bg-paper">
      <PaperPrintStyle size={size} />
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4 p-4 print:max-w-none print:p-0">
        <div className="flex items-center justify-between gap-2 print:hidden">
          <Link href={backHref} className="-ml-2 flex min-h-touch items-center gap-2 rounded-full px-2 text-sm font-medium hover:bg-border/30">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
          {badge && <span className="rounded-full bg-border/40 px-2.5 py-1 text-xs font-semibold text-muted">{badge}</span>}
        </div>

        <DocumentActions target={exportRef} size={size} onSizeChange={setSize} fileName={fileName} shareTitle={shareTitle} contentKey={contentKey} documentName={documentName} />

        <div
          className={cn(
            "overflow-hidden border border-border shadow-raised print:overflow-visible print:rounded-none print:border-0 print:shadow-none",
            size === "receipt" ? "mx-auto w-full max-w-[302px] rounded-md" : "rounded-2xl",
          )}
        >
          {render(size)}
        </div>
      </div>

      {/* The copy at paper width that becomes the image and the PDF — never seen, never printed. */}
      <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0 print:hidden">
        {render(size, { fixedWidth: true, ref: exportRef })}
      </div>
    </div>
  );
}
