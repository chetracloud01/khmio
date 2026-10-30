"use client";

import { useTranslations } from "next-intl";
import { DocumentScreen } from "@/components/paper/document-screen";
import { InvoiceDocument, type InvoiceData, type InvoiceSize } from "./invoice-document";

/**
 * The whole invoice page (design/screens.md B7) on the shared document page.
 * The buyer's page and the seller's page both show this one screen.
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
  const documentName = data.state === "paid" ? t("titleReceipt") : t("titleInvoice");
  return (
    <DocumentScreen
      render={(size, copy) => <InvoiceDocument data={data} size={size} {...copy} />}
      backHref={backHref}
      backLabel={backLabel}
      badge={badge}
      initialSize={initialSize}
      fileName={`${data.state === "paid" ? "receipt" : "invoice"}-${data.orderNumber}`}
      shareTitle={t("shareTitle", { shop: data.shop.name, document: documentName, number: data.orderNumber })}
      documentName={documentName}
      contentKey={JSON.stringify(data)}
    />
  );
}
