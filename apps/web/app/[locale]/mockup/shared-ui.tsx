"use client";

import { canAddMore, type BuyerStockState, type Currency } from "@khmio/shared";
import { cn, PriceTag } from "@khmio/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ProductTile, type ProductView } from "@/components/buyer/product-tile";
import { QuantityStepper } from "@/components/buyer/quantity-control";
import { StockNote, type StockLabels } from "@/components/buyer/stock-note";
import {
  getStartingVariant,
  getUnitKhr,
  getUnitUsdCents,
  lineKey,
  type MockProduct,
} from "@/mock/mock-data";

export function Stepper({
  qty,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
  increaseDisabled = false,
  className,
}: {
  qty: number;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
  /** At the stock limit: the buyer can't add more than the shop has. */
  increaseDisabled?: boolean;
  className?: string;
}) {
  // The same − n + as the live shop (components/buyer/quantity-control).
  return (
    <QuantityStepper
      quantity={qty}
      decreaseLabel={decreaseLabel}
      increaseLabel={increaseLabel}
      onDecrease={onDecrease}
      onIncrease={onIncrease}
      increaseDisabled={increaseDisabled}
      className={className}
    />
  );
}

export function ProductCard({
  product,
  locale,
  currency,
  quantities,
  stockFor,
  stockLabels,
  onAdjustQuantity,
  onOpen,
  addLabel,
  startingFromLabel,
  decreaseLabelFor,
  increaseLabelFor,
  className,
  view = "grid",
}: {
  /** Grid card or list row (the buyer's choice above the list). */
  view?: ProductView;
  product: MockProduct;
  locale: string;
  /** The buyer's currency: shown first, the other one small underneath. */
  currency: Currency;
  quantities: Record<string, number>;
  stockFor: (productId: string, variantId?: string) => BuyerStockState;
  stockLabels: StockLabels;
  onAdjustQuantity: (key: string, delta: number) => void;
  /** Opens the product's own page (photos, description, options). */
  onOpen: (product: MockProduct) => void;
  addLabel: string;
  startingFromLabel: string;
  decreaseLabelFor: (title: string) => string;
  increaseLabelFor: (title: string) => string;
  className?: string;
}) {
  const t = useTranslations("Storefront");
  const title = locale === "km" ? product.titleKm : product.titleEn;
  const hasVariants = !!product.variants?.length;
  const startingVariant = getStartingVariant(product);
  const displayUnitUsd = hasVariants ? getUnitUsdCents(product, startingVariant) : getUnitUsdCents(product);
  const displayUnitKhr = hasVariants ? getUnitKhr(product, startingVariant) : getUnitKhr(product);
  const displayOriginalUsd = product.discountPercent
    ? (hasVariants ? startingVariant?.retailPriceUsdCents : product.retailPriceUsdCents)
    : undefined;
  const displayOriginalKhr = product.discountPercent
    ? (hasVariants ? startingVariant?.retailPriceKhr : product.retailPriceKhr)
    : undefined;

  const productCartCount = hasVariants
    ? (product.variants?.reduce((sum, variant) => sum + (quantities[lineKey(product.id, variant.id)] ?? 0), 0) ?? 0)
    : (quantities[lineKey(product.id)] ?? 0);
  const baseKey = lineKey(product.id);
  const baseQty = hasVariants ? 0 : (quantities[baseKey] ?? 0);

  // A product with options is sold out only when every option is; otherwise the picker shows which are left.
  const variantStates = product.variants?.map((variant) => stockFor(product.id, variant.id)) ?? [];
  const stock: BuyerStockState = hasVariants
    ? variantStates.every((state) => state.kind === "sold_out")
      ? { kind: "sold_out" }
      : { kind: "untracked" }
    : stockFor(product.id);
  const soldOut = stock.kind === "sold_out";

  const optionCount = product.variants?.length ?? 0;
  return (
    <ProductTile
      view={view}
      title={title}
      photo={
        product.photoDataUrls?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- merchant's own upload preview, not a remote image
          <img src={product.photoDataUrls[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className={cn("block h-full w-full", product.photoColor)} />
        )
      }
      discountPercent={product.discountPercent}
      optionCount={optionCount}
      price={
        <PriceTag
          usdCents={displayUnitUsd}
          khr={displayUnitKhr}
          originalUsdCents={displayOriginalUsd}
          originalKhr={displayOriginalKhr}
          primary={currency}
          className="text-sm"
        />
      }
      note={!hasVariants && stock.kind === "low" ? <StockNote state={stock} labels={stockLabels} /> : undefined}
      quantity={hasVariants ? productCartCount : baseQty}
      ordering
      soldOut={soldOut}
      canAddMore={canAddMore(stock, baseQty)}
      labels={{
        add: addLabel,
        decrease: decreaseLabelFor(title),
        increase: increaseLabelFor(title),
        from: startingFromLabel,
        options: t("optionCount", { count: optionCount }),
        inCart: t("inCart", { count: hasVariants ? productCartCount : baseQty }),
        soldOut: stockLabels.soldOut,
      }}
      onOpen={() => onOpen(product)}
      onAdjust={(delta) => onAdjustQuantity(baseKey, delta)}
      className={className}
    />
  );
}
