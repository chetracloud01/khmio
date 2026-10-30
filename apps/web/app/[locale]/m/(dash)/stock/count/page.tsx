"use client";

import { getMinimumPlanFor, planHasFeature } from "@khmio/shared";
import { buttonVariants } from "@khmio/ui";
import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CountStart } from "@/components/stock/count-start";
import { itemName } from "@/components/stock/item-name";
import { StockArea } from "@/components/stock/stock-area";
import { StockCountScreen } from "@/components/stock/stock-count-screen";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, ApiError, type Catalog, catalogSchema, type StockCount, stockCountSchema, stockCountsSchema, type StockPage, stockPageSchema } from "@/lib/api";
import { useMerchant } from "../../merchant-context";
import { PageLoading, PageOffline } from "../../page-states";
import { categoryNameLookup } from "@/lib/local-name";

// Count stock (design/screens.md S13 "Count stock"), the Stock area's Count
// tab: the open draft count, to continue — or, with none, what to count and
// Start, over the shop's past counts (GET /stock/counts). From GET /stock
// (today's counts and costs) and the catalog's categories. Applied or
// cancelled, the count's own page shows it.
export default function StockCountPage() {
  const t = useTranslations("Stock");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const router = useRouter();
  const { store } = useMerchant();
  const writable = planHasFeature(store.plan, "stock");
  const [data, setData] = useState<{ page: StockPage; catalog: Catalog; counts: StockCount[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const base = `/${locale}/m/stock/count`;

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([api("/stock", stockPageSchema), api("/catalog", catalogSchema), api("/stock/counts", stockCountsSchema)]).then(
      ([page, catalog, counts]) => setData({ page, catalog, counts: counts.counts }),
      () => setFailed(true),
    );
  }, []);
  useEffect(load, [load]);

  const categoryName = categoryNameLookup(data?.catalog.categories, locale);

  async function start(categoryIds: string[]) {
    setStarting(true);
    setProblem(null);
    try {
      const draft = await api("/stock/counts", stockCountSchema, { method: "POST", body: { categoryIds } });
      setData((current) => (current ? { ...current, counts: [draft, ...current.counts.filter((count) => count.id !== draft.id)] } : current));
    } catch (failure) {
      setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setStarting(false);
    }
  }

  const draft = data?.counts.find((count) => count.status === "draft");
  // The categories the shop's items are in: what a count can cover.
  const categories = data ? data.catalog.categories.filter((category) => data.page.items.some((item) => item.categoryId === category.id)).map((category) => ({ id: category.id, name: categoryName(category.id) })) : [];

  return (
    <StockArea
      tab="count"
      writable={writable}
      actions={
        <Link href={`/${locale}/m/reports/counts`} className={buttonVariants({ variant: "secondary" })}>
          <ChartColumn className="h-4 w-4" aria-hidden="true" />
          {t("reportLink")}
        </Link>
      }
    >
      {!writable && <UpgradePrompt title={t("lockedTitle")} body={t("lockedBody")} plan={getMinimumPlanFor("stock")} />}
      {failed ? (
        <PageOffline onRetry={load} />
      ) : !data ? (
        <PageLoading />
      ) : draft && writable ? (
        <StockCountScreen
          key={draft.id}
          count={draft}
          items={data.page.items}
          nameOf={(item) => itemName(locale, item)}
          categoryName={categoryName}
          mainCurrency={store.defaultCurrency}
          writable={writable}
          onDone={(done) => router.push(`${base}/${done.id}`)}
        />
      ) : (
        <CountStart categories={categories} counts={data.counts} mainCurrency={store.defaultCurrency} writable={writable} busy={starting} problem={problem} onStart={(ids) => void start(ids)} countHref={(count) => `${base}/${count.id}`} />
      )}
    </StockArea>
  );
}
