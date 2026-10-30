"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { DocumentScreen } from "@/components/paper/document-screen";
import { paperShopOf } from "@/components/paper/paper-shop";
import { BillPaper } from "@/components/purchases/bill-paper";
import { PurchaseNotFound } from "@/components/purchases/purchase-not-found";
import { useLoadedPurchase } from "@/components/purchases/use-loaded-purchase";
import { usePurchaseText } from "@/components/purchases/use-purchase-text";
import { useMerchant } from "../../../merchant-context";
import { PageLoading, PageOffline } from "../../../page-states";

// A bill or a supplier return to print, save or share (design/screens.md S13
// "Printing"), on the same document page as the invoice.
export default function PurchasePrintPage() {
  const t = useTranslations("BillPaper");
  const tInvoice = useTranslations("Invoice");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const { store } = useMerchant();
  const { title } = usePurchaseText();
  const { purchase, state, load } = useLoadedPurchase(id);

  if (state === "offline") return <PageOffline onRetry={load} />;
  if (state === "not_found") return <PurchaseNotFound />;
  if (!purchase) return <PageLoading />;
  const shop = paperShopOf(store);
  const documentName = t(purchase.kind === "return" ? "titleReturn" : "titleBill");
  return (
    <DocumentScreen
      render={(size, copy) => <BillPaper purchase={purchase} shop={shop} size={size} {...copy} />}
      backHref={`/${locale}/m/purchases/${purchase.id}`}
      backLabel={title(purchase)}
      fileName={title(purchase)}
      shareTitle={tInvoice("shareTitle", { shop: shop.name, document: documentName, number: title(purchase) })}
      documentName={documentName}
      contentKey={JSON.stringify(purchase)}
    />
  );
}
