"use client";

import { planHasFeature } from "@khmio/shared";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { PurchaseNotFound } from "@/components/purchases/purchase-not-found";
import { PurchaseScreen } from "@/components/purchases/purchase-screen";
import { useLoadedPurchase } from "@/components/purchases/use-loaded-purchase";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";

// One bill or return (design/screens.md S13 "Bill"), from GET /purchases/:id.
// Another shop's bill, or a mistyped address, is "not found".
export default function PurchasePage() {
  const t = useTranslations("Purchases");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const { store } = useMerchant();
  const { purchase, state, load } = useLoadedPurchase(id);
  const list = `/${locale}/m/purchases`;

  if (state === "offline") return <PageOffline onRetry={load} />;
  if (state === "not_found") return <PurchaseNotFound />;
  if (!purchase) return <PageLoading />;
  return <PurchaseScreen key={purchase.id} purchase={purchase} writable={planHasFeature(store.plan, "stock")} hrefFor={(other) => `${list}/${other}`}
      printHrefFor={(other) => `${list}/${other}/print`}
      voucherHrefFor={(paymentId) => `${list}/${purchase.id}/payments/${paymentId}/print`}
      back={{ href: list, label: t("title") }} />;
}
