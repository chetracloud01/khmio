"use client";

import { planHasFeature } from "@khmio/shared";
import { buttonVariants, EmptyState } from "@khmio/ui";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BackLink } from "@/components/seller-frame/back-to-my-shop";
import { itemName } from "@/components/stock/item-name";
import { StockArea } from "@/components/stock/stock-area";
import { StockCountScreen } from "@/components/stock/stock-count-screen";
import { api, ApiError, type Catalog, catalogSchema, type StockCount, stockCountSchema, type StockPage, stockPageSchema } from "@/lib/api";
import { useMerchant } from "../../../merchant-context";
import { PageLoading, PageOffline } from "../../../page-states";
import { categoryNameLookup } from "@/lib/local-name";

// One stock count (design/screens.md S13 "Count stock"), from GET
// /stock/counts/:id: an applied or cancelled count, read-only — what was
// counted, each difference and what it was worth. A draft is continued on the
// Count tab. Another shop's count, or a mistyped address, is "not found".
export default function StockCountDetailPage() {
  const t = useTranslations("Stock");
  const locale = useLocale();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { store } = useMerchant();
  const writable = planHasFeature(store.plan, "stock");
  const [data, setData] = useState<{ count: StockCount; page: StockPage; catalog: Catalog } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "offline">("loading");
  const tab = `/${locale}/m/stock/count`;

  const load = useCallback(() => {
    setState("loading");
    Promise.all([api(`/stock/counts/${id}`, stockCountSchema), api("/stock", stockPageSchema), api("/catalog", catalogSchema)]).then(
      ([count, page, catalog]) => {
        // A draft is continued where it's typed.
        if (count.status === "draft") router.replace(tab);
        setData({ count, page, catalog });
        setState("ready");
      },
      (error: unknown) => setState(error instanceof ApiError && (error.status === 404 || error.status === 400) ? "not_found" : "offline"),
    );
  }, [id, router, tab]);
  useEffect(load, [load]);

  const categoryName = categoryNameLookup(data?.catalog.categories, locale);

  return (
    <StockArea tab="count" writable={writable}>
      <BackLink href={tab} label={t("countBackToCounts")} />
      {state === "offline" ? (
        <PageOffline onRetry={load} />
      ) : state === "not_found" ? (
        <EmptyState
          title={t("countNotFound")}
          action={
            <Link href={tab} className={buttonVariants({ variant: "secondary" })}>
              {t("countBackToCounts")}
            </Link>
          }
        />
      ) : !data ? (
        <PageLoading />
      ) : (
        <StockCountScreen
          count={data.count}
          items={data.page.items}
          nameOf={(item) => itemName(locale, item)}
          categoryName={categoryName}
          mainCurrency={store.defaultCurrency}
          writable={writable}
          onDone={(done) => setData((current) => (current ? { ...current, count: done } : current))}
        />
      )}
    </StockArea>
  );
}
