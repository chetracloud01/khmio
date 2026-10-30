"use client";

import { Coins, EyeOff, ImageOff, Package, Percent, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusTileRow, type StatusTile } from "@/components/status-tile-row";
import type { Product } from "@/lib/api";
import { productTileFigures, type ProductTileView } from "./product-tiles";

/**
 * The Products page's status tiles (design/screens.md S6): every product (and
 * how many the shop shows) · hidden · on discount · no cost price · no photo
 * — tapped, the list follows — and, with stock, the items low or out, which
 * opens Stock's reorder list.
 */
export function ProductStatusTiles({ products, active, onSelect, toReorder, reorderHref }: { products: readonly Product[]; active: ProductTileView | null; onSelect: (view: ProductTileView | null) => void; /** Plans with stock: items at or below their reorder point; null without stock. */ toReorder: number | null; reorderHref: string }) {
  const t = useTranslations("ProductsList");
  const figures = productTileFigures(products);
  const count = (value: number) => t("productCount", { count: value });
  const tiles: StatusTile<ProductTileView>[] = [
    { key: "all", icon: Package, tone: "brand", label: t("tileAll"), amount: count(figures.all), sub: t("tileShownHint", { count: figures.shown }), view: null },
    { key: "hidden", icon: EyeOff, tone: "muted", label: t("chipHidden"), amount: count(figures.hidden), sub: t("tileHiddenHint"), action: figures.hidden > 0 ? t("tileActionSee") : undefined, view: "hidden" },
    { key: "discounted", icon: Percent, tone: "info", label: t("chipDiscounted"), amount: count(figures.discounted), action: figures.discounted > 0 ? t("tileActionSee") : undefined, view: "discounted" },
    { key: "nocost", icon: Coins, tone: "warning", label: t("chipNoCost"), amount: count(figures.nocost), sub: t("tileNoCostHint"), action: figures.nocost > 0 ? t("tileActionAddCost") : undefined, view: "nocost" },
    { key: "nophoto", icon: ImageOff, tone: "warning", label: t("chipNoPhoto"), amount: count(figures.nophoto), sub: t("tileNoPhotoHint"), action: figures.nophoto > 0 ? t("tileActionAddPhoto") : undefined, view: "nophoto" },
    ...(toReorder === null
      ? []
      : [{ key: "reorder", icon: ShoppingCart, tone: "danger" as const, label: t("tileReorder"), amount: t("itemCount", { count: toReorder }), action: toReorder > 0 ? t("tileActionReorder") : undefined, view: null, href: reorderHref }]),
  ];
  return <StatusTileRow label={t("tilesLabel")} tiles={tiles} active={active} onSelect={onSelect} />;
}
