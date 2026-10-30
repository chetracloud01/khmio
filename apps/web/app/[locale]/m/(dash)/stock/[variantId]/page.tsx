"use client";

import { buttonVariants, EmptyState } from "@khmio/ui";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StockItemScreen } from "@/components/stock/stock-item-screen";
import { api, ApiError, type StockItemDetail, stockItemDetailSchema, type Supplier, suppliersSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";

// One item's stock (design/screens.md S13 "Item"), from GET /stock/items/:id.
// Another shop's item, a service, or a mistyped address is "not found".
export default function StockItemPage() {
  const t = useTranslations("Stock");
  const locale = useLocale();
  const { variantId } = useParams<{ variantId: string }>();
  const { store } = useMerchant();
  const [detail, setDetail] = useState<StockItemDetail | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "offline">("loading");
  const stock = `/${locale}/m/stock`;

  const load = useCallback(() => {
    api(`/stock/items/${variantId}`, stockItemDetailSchema)
      .then((answer) => {
        setDetail(answer);
        setState("ready");
      })
      .catch((error: unknown) => setState(error instanceof ApiError && (error.status === 404 || error.status === 400) ? "not_found" : "offline"));
    // Only the stock-in sheet's picker needs them: without them it still saves, with no supplier.
    api("/suppliers", suppliersSchema).then((answer) => setSuppliers(answer.suppliers.filter((supplier) => !supplier.archived)), () => setSuppliers([]));
  }, [variantId]);
  useEffect(load, [load]);

  if (state === "offline") return <PageOffline onRetry={load} />;
  if (state === "not_found")
    return (
      <EmptyState
        title={t("itemNotFound")}
        action={
          <Link href={stock} className={buttonVariants({ variant: "secondary" })}>
            {t("title")}
          </Link>
        }
      />
    );
  if (!detail) return <PageLoading />;
  return (
    <StockItemScreen
      detail={detail}
      writable={detail.tracksStock}
      shopCurrency={store.defaultCurrency}
      suppliers={suppliers}
      back={{ href: stock, label: t("title") }}
      billHref={(purchaseId) => `/${locale}/m/purchases/${purchaseId}`}
      onChanged={load}
    />
  );
}
