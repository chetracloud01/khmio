"use client";

import { canAddProduct } from "@khmio/shared";
import { Button, ConfirmDialog, Notice, PageHeader, Switch } from "@khmio/ui";
import { EyeOff, ImageOff, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, DataGridHighlight, type DataGridColumn, type DataGridGroup } from "@/components/data-grid";
import { SELLER_PAGE } from "@/components/seller-frame/seller-frame";
import { api, ApiError, type Catalog, type Product } from "@/lib/api";
import { priceText, startingVariant, usdValue } from "@/lib/product-price";
import { useMerchant } from "../merchant-context";
import { PhotoThumb } from "@/components/photo-thumb";

// The seller's products, from the API: search, filters, Hidden badge, and
// delete (soft — old orders keep pointing at the product).
export default function ProductsPage() {
  const t = useTranslations("ProductsList");
  const tApp = useTranslations("App");
  const tStore = useTranslations("Storefront");
  const locale = useLocale();
  const router = useRouter();
  const { store, refreshStore } = useMerchant();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([api<Product[]>("/products"), api<Catalog>("/catalog")])
      .then(([list, names]) => {
        setProducts(list);
        setCatalog(names);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const name = (entry: { nameKm: string; nameEn: string }) => (locale === "km" ? entry.nameKm : entry.nameEn);
  const categoryName = useMemo(() => new Map(catalog?.categories.map((c) => [c.id, locale === "km" ? c.nameKm : c.nameEn])), [catalog, locale]);
  const brandName = useMemo(() => new Map(catalog?.brands.map((b) => [b.id, locale === "km" ? b.nameKm : b.nameEn])), [catalog, locale]);
  const unitName = useMemo(() => new Map(catalog?.units.map((u) => [u.id, locale === "km" ? u.nameKm : u.nameEn])), [catalog, locale]);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 py-16 text-center" role="alert">
        <p className="font-semibold">{tApp("offlineTitle")}</p>
        <Button variant="primary" onClick={load}>
          {tApp("retry")}
        </Button>
      </div>
    );
  }
  if (!products || !catalog) {
    return (
      <div className="flex flex-col gap-3 p-4" aria-busy="true">
        <span className="sr-only" role="status">
          {tApp("loading")}
        </span>
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-20 animate-pulse rounded-2xl bg-border/40 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  const rate = store.usdToKhrRate;
  const atLimit = !canAddProduct(store.plan, products.length);
  const title = (product: Product) => (locale === "km" ? product.titleKm : product.titleEn || product.titleKm);
  const price = (product: Product) => priceText(startingVariant(product, rate), product.discountPercent);
  const sortPrice = (product: Product) => {
    const variant = startingVariant(product, rate);
    return variant ? usdValue(variant, rate) : 0;
  };

  // Round, with a thin ring so light photos keep their edge.
  const thumbnail = (product: Product, size: string) =>
    product.photos[0] ? (
      <PhotoThumb photo={product.photos[0]} className={`${size} shrink-0 rounded-full object-cover ring-1 ring-border`} />
    ) : (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-border/30 ring-1 ring-border`} aria-hidden="true">
        <ImageOff className="h-5 w-5 text-muted" />
      </div>
    );
  const hiddenBadge = (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-border/40 px-2 py-0.5 text-xs font-semibold text-muted">
      <EyeOff className="h-3 w-3" aria-hidden="true" />
      {t("hidden")}
    </span>
  );

  const visibilitySwitch = (product: Product) => (
    <Switch checked={product.isVisible} onChange={(visible) => void setVisible(product, visible)} label={product.isVisible ? t("shownInShop") : t("hiddenInShop")} labelHidden />
  );
  // Categories in the shop's own order; only those with products get a pill.
  const categoryOrder = new Map(catalog.categories.map((category, index) => [category.id, index]));
  const usedCategories = catalog.categories.filter((category) => products.some((product) => product.categoryId === category.id));
  const categoryGroups: DataGridGroup<Product> = {
    key: (product) => product.categoryId,
    label: (product) => categoryName.get(product.categoryId) ?? "—",
    rank: (product) => categoryOrder.get(product.categoryId) ?? catalog.categories.length,
  };

  const columns: DataGridColumn<Product>[] = [
    {
      key: "product",
      header: t("colProduct"),
      hideable: false,
      pin: "start",
      sortable: true,
      value: title,
      cell: (product) => (
        <div className="flex items-center gap-3">
          {thumbnail(product, "h-10 w-10")}
          <div className="min-w-0">
            <p className="flex items-center gap-2">
              <span className="truncate font-medium"><DataGridHighlight text={title(product)} /></span>
              {!product.isVisible && hiddenBadge}
            </p>
            {product.hasOptions && <p className="text-xs text-muted">{t("variantsCount", { count: product.variants.length })}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: t("colCategory"),
      sortable: true,
      value: (product) => categoryName.get(product.categoryId) ?? "",
      cell: (product) => categoryName.get(product.categoryId) ?? "—",
    },
    {
      key: "brand",
      header: t("colBrand"),
      sortable: true,
      defaultHidden: true,
      value: (product) => (product.brandId ? (brandName.get(product.brandId) ?? "") : ""),
      cell: (product) => (product.brandId ? (brandName.get(product.brandId) ?? "—") : "—"),
    },
    {
      key: "unit",
      header: t("colUnit"),
      defaultHidden: true,
      value: (product) => (product.unitId ? (unitName.get(product.unitId) ?? "") : ""),
      cell: (product) => (product.unitId ? (unitName.get(product.unitId) ?? "—") : "—"),
    },
    { key: "price", header: t("colPrice"), align: "right", sortable: true, value: sortPrice, exportValue: price, cell: (product) => <span className="font-medium">{price(product)}</span> },
    {
      key: "discount",
      header: t("colDiscount"),
      align: "right",
      sortable: true,
      value: (product) => product.discountPercent ?? 0,
      cell: (product) =>
        product.discountPercent ? (
          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">−{product.discountPercent}%</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "shown",
      header: t("colShown"),
      align: "right",
      pin: "end",
      value: (product) => (product.isVisible ? 1 : 0),
      exportValue: (product) => (product.isVisible ? t("shownInShop") : t("hiddenInShop")),
      // The row opens the product; the switch must not.
      cell: (product) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          {visibilitySwitch(product)}
        </div>
      ),
    },
  ];

  /** Shown or hidden in the shop, straight from the list: changes at once, and goes back if the save fails. */
  async function setVisible(product: Product, isVisible: boolean) {
    setDeleteError(null);
    const apply = (visible: boolean) => setProducts((list) => list && list.map((entry) => (entry.id === product.id ? { ...entry, isVisible: visible } : entry)));
    apply(isVisible);
    try {
      await api(`/products/${product.id}/visibility`, { method: "PATCH", body: { isVisible } });
      void refreshStore();
    } catch (error) {
      apply(!isVisible);
      setDeleteError(error instanceof ApiError && error.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    }
  }

  /** Hide or show several selected products at once. */
  async function setManyVisible(rows: Product[], isVisible: boolean) {
    for (const product of rows) await setVisible(product, isVisible);
  }

  async function deleteProducts(rows: Product[]) {
    setDeleteError(null);
    try {
      for (const product of rows) await api(`/products/${product.id}`, { method: "DELETE" });
    } catch (error) {
      setDeleteError(error instanceof ApiError && error.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    }
    setPendingDelete([]);
    load();
    void refreshStore();
  }

  return (
    <div className={`${SELLER_PAGE} gap-4 pb-24 md:pb-6`}>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          atLimit ? (
            <Button variant="primary" disabled>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addProduct")}
            </Button>
          ) : (
            // On a phone the round + at the bottom adds a product.
            <Link href={`/${locale}/m/products/new`} className="hidden md:block">
              <Button variant="primary">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("addProduct")}
              </Button>
            </Link>
          )
        }
      />

      {atLimit && <Notice tone="warning">{tApp("productLimit", { count: products.length })}</Notice>}
      {deleteError && (
        <Notice tone="danger" role="alert">
          {deleteError}
        </Notice>
      )}

      <DataGrid
        syncUrl
        rowNumbers
        rows={products}
        getRowId={(product) => product.id}
        columns={columns}
        searchText={(product) => `${product.titleKm} ${product.titleEn} ${product.variants.map((v) => v.sku).join(" ")}`}
        searchPlaceholder={t("searchPlaceholder")}
        chips={[
          ...usedCategories.map((category) => ({ value: `category:${category.id}`, label: name(category), predicate: (product: Product) => product.categoryId === category.id })),
          { value: "discounted", label: t("chipDiscounted"), predicate: (product: Product) => !!product.discountPercent },
          { value: "hidden", label: t("chipHidden"), predicate: (product: Product) => !product.isVisible },
        ]}
        // "All": grouped by category, in the shop's category order.
        groupBy={(chip) => (chip === "all" ? categoryGroups : null)}
        defaultPageSize={20}
        selectOnDemand
        filters={[
          { key: "category", label: t("colCategory"), options: catalog.categories.map((c) => ({ value: c.id, label: name(c) })), predicate: (product, value) => product.categoryId === value },
          { key: "brand", label: t("colBrand"), options: catalog.brands.map((b) => ({ value: b.id, label: name(b) })), predicate: (product, value) => product.brandId === value },
          { key: "unit", label: t("colUnit"), options: catalog.units.map((u) => ({ value: u.id, label: name(u) })), predicate: (product, value) => product.unitId === value },
        ]}
        bulkActions={[
          { key: "hide", label: t("hideSelected"), applies: (product) => product.isVisible, run: (rows) => void setManyVisible(rows, false) },
          { key: "show", label: t("showSelected"), applies: (product) => !product.isVisible, run: (rows) => void setManyVisible(rows, true) },
          { key: "delete", label: t("deleteSelected"), variant: "danger", run: setPendingDelete },
        ]}
        onRowClick={(product) => router.push(`/${locale}/m/products/${product.id}`)}
        renderCard={(product) => (
          <div className="flex items-center gap-3">
            {thumbnail(product, "h-16 w-16")}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="line-clamp-2 font-medium leading-snug"><DataGridHighlight text={title(product)} /></p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {categoryName.get(product.categoryId)}
                {product.hasOptions && <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">{tStore("optionCount", { count: product.variants.length })}</span>}
                {!product.isVisible && hiddenBadge}
              </p>
              <p className="flex items-center gap-2 text-sm font-semibold tabular-nums">
                {price(product)}
                {product.discountPercent ? <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">−{product.discountPercent}%</span> : null}
              </p>
            </div>
          </div>
        )}
        renderCardAside={visibilitySwitch}
        exportFileName="products"
        // "-v2": the 2026-10-22 columns (Shown added, Unit hidden) replace earlier saved choices.
        storageKey="products-v2"
        emptyTitle={t("noProducts")}
      />

      {/* Phone: always within reach, above the bottom tabs. */}
      {!atLimit && (
        <Link
          href={`/${locale}/m/products/new`}
          aria-label={t("addProduct")}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-raised transition-transform active:scale-95 md:hidden"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
        </Link>
      )}

      <ConfirmDialog
        open={pendingDelete.length > 0}
        title={t("deleteConfirmTitle", { count: pendingDelete.length })}
        body={t("deleteConfirmBody")}
        confirmLabel={t("deleteSelected")}
        cancelLabel={t("cancel")}
        danger
        onConfirm={() => void deleteProducts(pendingDelete)}
        onClose={() => setPendingDelete([])}
      />
    </div>
  );
}
