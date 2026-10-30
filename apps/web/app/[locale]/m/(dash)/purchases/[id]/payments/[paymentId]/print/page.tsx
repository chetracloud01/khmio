"use client";

import { formatDocumentNumber } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { DocumentScreen } from "@/components/paper/document-screen";
import { paperShopOf } from "@/components/paper/paper-shop";
import { PurchaseNotFound } from "@/components/purchases/purchase-not-found";
import { useLoadedPurchase } from "@/components/purchases/use-loaded-purchase";
import { usePurchaseText } from "@/components/purchases/use-purchase-text";
import { VoucherPaper } from "@/components/purchases/voucher-paper";
import { useMerchant } from "../../../../../merchant-context";
import { PageLoading, PageOffline } from "../../../../../page-states";

// A payment voucher to print, save or share (design/screens.md S13
// "Printing"): one payment of a bill, read with its bill. A payment that isn't
// this bill's is "not found".
export default function PaymentVoucherPage() {
  const t = useTranslations("BillPaper");
  const tInvoice = useTranslations("Invoice");
  const locale = useLocale();
  const { id, paymentId } = useParams<{ id: string; paymentId: string }>();
  const { store } = useMerchant();
  const { title } = usePurchaseText();
  const { purchase, state, load } = useLoadedPurchase(id);

  if (state === "offline") return <PageOffline onRetry={load} />;
  const payment = purchase?.payments.find((entry) => entry.id === paymentId);
  if (state === "not_found" || (purchase && !payment)) return <PurchaseNotFound />;
  if (!purchase || !payment) return <PageLoading />;
  const shop = paperShopOf(store);
  const number = formatDocumentNumber("payment", payment.number);
  const documentName = t("titleVoucher");
  return (
    <DocumentScreen
      render={(size, copy) => <VoucherPaper purchase={purchase} payment={payment} shop={shop} size={size} {...copy} />}
      backHref={`/${locale}/m/purchases/${purchase.id}`}
      backLabel={title(purchase)}
      fileName={number}
      shareTitle={tInvoice("shareTitle", { shop: shop.name, document: documentName, number })}
      documentName={documentName}
      contentKey={JSON.stringify(payment)}
    />
  );
}
