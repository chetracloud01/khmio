"use client";

import { cn } from "@khmio/ui";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRef, useState } from "react";
import { InvoiceActions, InvoicePrintStyle } from "./invoice-actions";
import { InvoiceDocument, type InvoiceData, type InvoiceSize } from "./invoice-document";

/**
 * The whole invoice page (design/screens.md B7) — back link, size switch,
 * buttons, the document, and its off-screen copy at paper width that becomes
 * the image and PDF. The buyer's page and the seller's page both show this
 * one screen.
 */
export function InvoiceScreen({
  data,
  backHref,
  backLabel,
  badge,
  initialSize = "a4",
}: {
  data: InvoiceData;
  backHref: string;
  backLabel: string;
  badge?: string;
  /** "receipt" for a sale at the counter, printed on an 80 mm roll. */
  initialSize?: InvoiceSize;
}) {
  const t = useTranslations("Invoice");
  const [size, setSize] = useState<InvoiceSize>(initialSize);
  const exportRef = useRef<HTMLDivElement>(null);
  const documentName = data.state === "paid" ? t("titleReceipt") : t("titleInvoice");

  return (
    <div className="min-h-dvh bg-canvas text-fg print:min-h-0 print:bg-paper">
      <InvoicePrintStyle size={size} />
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4 p-4 print:max-w-none print:p-0">
        <div className="flex items-center justify-between gap-2 print:hidden">
          <Link href={backHref} className="-ml-2 flex min-h-touch items-center gap-2 rounded-full px-2 text-sm font-medium hover:bg-border/30">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
          {badge && <span className="rounded-full bg-border/40 px-2.5 py-1 text-xs font-semibold text-muted">{badge}</span>}
        </div>

        <InvoiceActions
          target={exportRef}
          size={size}
          onSizeChange={setSize}
          fileName={`${data.state === "paid" ? "receipt" : "invoice"}-${data.orderNumber}`}
          shareTitle={t("shareTitle", { shop: data.shop.name, document: documentName, number: data.orderNumber })}
          contentKey={JSON.stringify(data)}
          documentName={documentName}
        />

        <div
          className={cn(
            "overflow-hidden border border-border shadow-raised print:overflow-visible print:rounded-none print:border-0 print:shadow-none",
            size === "receipt" ? "mx-auto w-full max-w-[302px] rounded-md" : "rounded-2xl",
          )}
        >
          <InvoiceDocument data={data} size={size} />
        </div>
      </div>

      {/* The copy at paper width that becomes the image and the PDF — never seen, never printed. */}
      <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0 print:hidden">
        <InvoiceDocument ref={exportRef} data={data} size={size} fixedWidth />
      </div>
    </div>
  );
}
