"use client";

import {
  canAddProduct,
  convertKhrToUsdCents,
  formatKhr,
  formatUsd,
  getMinimumPlanForProductCount,
} from "@khmio/shared";
import { Button, ConfirmDialog, Switch } from "@khmio/ui";
import { ChevronRight, EyeOff, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getStartingVariant, getUnitKhr, getUnitUsdCents, type MockProduct } from "@/mock/mock-data";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { useMerchantProducts } from "../../merchant-products-context";
import { useMerchantSubscription } from "../../merchant-subscription-context";
import { useStoreSettings } from "../../store-settings-context";
import { UpgradePrompt } from "../upgrade-prompt";

export default function DashboardProductsMockupPage() {
  const { hydrated: productsReady } = useMerchantProducts();
  const { hydrated: subscriptionReady } = useMerchantSubscription();
  return productsReady && subscriptionReady ? <ProductsList /> : null;
}

function ProductsList() {
  const t = useTranslations("ProductsList");
  const tUp = useTranslations("Upgrade");
  const tStore = useTranslations("Storefront");
  const locale = useLocale();
  const router = useRouter();
  const { products, categories, brands, uoms, removeProduct, updateProduct } = useMerchantProducts();
  const { subscription } = useMerchantSubscription();
  const atProductLimit = !canAddProduct(subscription.plan, products.length);
  const [pendingDelete, setPendingDelete] = useState<MockProduct[]>([]);

  const categoryName = useMemo(
    () => new Map(categories.map((c) => [c.id, locale === "km" ? c.labelKm : c.labelEn])),
    [categories, locale],
  );
  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, locale === "km" ? b.nameKm : b.nameEn])), [brands, locale]);
  const uomName = useMemo(() => new Map(uoms.map((u) => [u.id, locale === "km" ? u.labelKm : u.labelEn])), [uoms, locale]);
  const { rate } = useStoreSettings();

  const title = (product: MockProduct) => (locale === "km" ? product.titleKm : product.titleEn);

  // Retail price shown to buyers (the cheapest option for products with options).
  function price(product: MockProduct) {
    const variant = product.variants?.length ? getStartingVariant(product) : undefined;
    return { usd: getUnitUsdCents(product, variant), khr: getUnitKhr(product, variant) };
  }
  function priceText(product: MockProduct) {
    const { usd, khr } = price(product);
    return usd != null ? formatUsd(usd) : khr != null ? formatKhr(khr) : "—";
  }
  /** Sort key in USD cents, converting KHR-only products at the store rate. */
  function priceSortValue(product: MockProduct) {
    const { usd, khr } = price(product);
    return usd ?? (khr != null ? convertKhrToUsdCents(khr, rate) : 0);
  }

  const thumbnail = (product: MockProduct, size: string) =>
    product.photoDataUrls?.[0] ? (
      // eslint-disable-next-line @next/next/no-img-element -- local FileReader preview, not a remote image
      <img src={product.photoDataUrls[0]} alt="" className={`${size} shrink-0 rounded-DEFAULT object-cover`} />
    ) : (
      <div className={`${size} shrink-0 rounded-DEFAULT ${product.photoColor}`} aria-hidden="true" />
    );

  // Hidden = still here to edit, not shown in the shop.
  const hiddenBadge = (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-border/40 px-2 py-0.5 text-xs font-semibold text-muted">
      <EyeOff className="h-3 w-3" aria-hidden="true" />
      {t("hidden")}
    </span>
  );

  const columns: DataGridColumn<MockProduct>[] = [
    {
      key: "product",
      header: t("colProduct"),
      hideable: false,
      sortable: true,
      value: title,
      cell: (product) => (
        <div className="flex items-center gap-3">
          {thumbnail(product, "h-10 w-10")}
          <div className="min-w-0">
            <p className="flex items-center gap-2">
              <span className="truncate font-medium">{title(product)}</span>
              {product.isHidden && hiddenBadge}
            </p>
            {product.variants?.length ? (
              <p className="text-xs text-muted">{t("variantsCount", { count: product.variants.length })}</p>
            ) : null}
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
      value: (product) => (product.uomId ? (uomName.get(product.uomId) ?? "") : ""),
      cell: (product) => (product.uomId ? (uomName.get(product.uomId) ?? "—") : "—"),
    },
    {
      key: "price",
      header: t("colPrice"),
      align: "right",
      sortable: true,
      value: priceSortValue,
      exportValue: priceText,
      cell: (product) => <span className="font-medium">{priceText(product)}</span>,
    },
    {
      key: "discount",
      header: t("colDiscount"),
      align: "right",
      sortable: true,
      value: (product) => product.discountPercent ?? 0,
      cell: (product) =>
        product.discountPercent ? (
          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
            −{product.discountPercent}%
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "actions",
      header: t("edit"),
      align: "right",
      hideable: false,
      cell: () => (
        <span className="inline-flex items-center gap-1 font-medium text-brand">
          {t("edit")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-4 text-fg md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("description")}</p>
        </div>
        {atProductLimit ? (
          <Button variant="primary" disabled>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("addProduct")}
          </Button>
        ) : (
          <Link href={`/${locale}/mockup/dashboard/products/new`}>
            <Button variant="primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addProduct")}
            </Button>
          </Link>
        )}
      </div>

      {atProductLimit && (
        <UpgradePrompt
          compact
          title={tUp("productLimitTitle", { count: products.length })}
          plan={getMinimumPlanForProductCount(products.length)}
        />
      )}

      <DataGrid
        rows={products}
        getRowId={(product) => product.id}
        columns={columns}
        searchText={(product) => `${product.titleKm} ${product.titleEn} ${product.variants?.map((v) => v.sku).join(" ") ?? ""}`}
        searchPlaceholder={t("searchPlaceholder")}
        chips={[
          { value: "options", label: t("chipWithOptions"), predicate: (product) => !!product.variants?.length },
          { value: "simple", label: t("chipSimple"), predicate: (product) => !product.variants?.length },
          { value: "discounted", label: t("chipDiscounted"), predicate: (product) => !!product.discountPercent },
          { value: "hidden", label: t("chipHidden"), predicate: (product) => !!product.isHidden },
        ]}
        filters={[
          {
            key: "category",
            label: t("colCategory"),
            options: categories.map((c) => ({ value: c.id, label: locale === "km" ? c.labelKm : c.labelEn })),
            predicate: (product, value) => product.categoryId === value,
          },
          {
            key: "brand",
            label: t("colBrand"),
            options: brands.map((b) => ({ value: b.id, label: locale === "km" ? b.nameKm : b.nameEn })),
            predicate: (product, value) => product.brandId === value,
          },
          {
            key: "unit",
            label: t("colUnit"),
            options: uoms.map((u) => ({ value: u.id, label: locale === "km" ? u.labelKm : u.labelEn })),
            predicate: (product, value) => product.uomId === value,
          },
        ]}
        bulkActions={[{ key: "delete", label: t("deleteSelected"), variant: "danger", run: setPendingDelete }]}
        onRowClick={(product) => router.push(`/${locale}/mockup/dashboard/products/${product.id}`)}
        renderCard={(product) => (
          <div className="flex items-center gap-3">
            {thumbnail(product, "h-14 w-14")}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="truncate font-medium">{title(product)}</span>
                {product.isHidden && hiddenBadge}
              </p>
              <p className="flex items-center gap-2 truncate text-xs text-muted">
                {categoryName.get(product.categoryId)}
                {product.variants?.length ? (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">{tStore("optionCount", { count: product.variants.length })}</span>
                ) : null}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {priceText(product)}
                {product.discountPercent ? (
                  <span className="ml-2 text-xs font-semibold text-danger">−{product.discountPercent}%</span>
                ) : null}
              </p>
            </div>
          </div>
        )}
        renderCardAction={(product) => (
          // Show or hide in the shop without opening the product (2026-10-22 seller review).
          <div className="border-t border-border px-4">
            <Switch
              checked={!product.isHidden}
              onChange={(visible) => updateProduct({ ...product, isHidden: !visible })}
              label={product.isHidden ? t("hiddenInShop") : t("shownInShop")}
            />
          </div>
        )}
        exportFileName="products"
        storageKey="merchant-products"
        emptyTitle={t("noProducts")}
      />

      <ConfirmDialog
        open={pendingDelete.length > 0}
        title={t("deleteConfirmTitle", { count: pendingDelete.length })}
        body={t("deleteConfirmBody")}
        confirmLabel={t("deleteSelected")}
        cancelLabel={t("cancel")}
        danger
        onConfirm={() => {
          pendingDelete.forEach((product) => removeProduct(product.id));
          setPendingDelete([]);
        }}
        onClose={() => setPendingDelete([])}
      />
    </div>
  );
}
