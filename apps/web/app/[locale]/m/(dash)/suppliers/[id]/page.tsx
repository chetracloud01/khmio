"use client";

import { listQueryToSearchParams, planHasFeature, type ListQuery } from "@khmio/shared";
import { buttonVariants, EmptyState } from "@khmio/ui";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SupplierScreen } from "@/components/purchases/supplier-screen";
import { api, ApiError, purchaseListPageSchema, type Supplier, supplierSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";

// One supplier (design/screens.md S13 "Supplier"), from GET /suppliers/:id;
// their bills from GET /purchases/page with the supplier fixed. Another
// shop's supplier, or a mistyped address, is "not found".
export default function SupplierPage() {
  const t = useTranslations("Purchases");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const { store } = useMerchant();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "offline">("loading");
  const suppliers = `/${locale}/m/suppliers`;

  const load = useCallback(() => {
    setState("loading");
    api(`/suppliers/${id}`, supplierSchema)
      .then((answer) => {
        setSupplier(answer);
        setState("ready");
      })
      .catch((error: unknown) => setState(error instanceof ApiError && (error.status === 404 || error.status === 400) ? "not_found" : "offline"));
  }, [id]);
  useEffect(load, [load]);
  const loadBills = useCallback(
    (query: ListQuery) => api(`/purchases/page?${listQueryToSearchParams({ ...query, filters: { ...query.filters, supplier: id } })}`, purchaseListPageSchema),
    [id],
  );

  if (state === "offline") return <PageOffline onRetry={load} />;
  if (state === "not_found")
    return (
      <EmptyState
        title={t("supplierNotFound")}
        action={
          <Link href={suppliers} className={buttonVariants({ variant: "secondary" })}>
            {t("tabSuppliersBack")}
          </Link>
        }
      />
    );
  if (!supplier) return <PageLoading />;
  return (
    <SupplierScreen
      key={supplier.id}
      supplier={supplier}
      writable={planHasFeature(store.plan, "stock")}
      loadBills={loadBills}
      billHref={(purchase) => `/${locale}/m/purchases/${purchase.id}`}
      newBillHref={`/${locale}/m/purchases/new?supplier=${supplier.id}`}
      back={{ href: suppliers, label: t("tabSuppliersBack") }}
    />
  );
}
