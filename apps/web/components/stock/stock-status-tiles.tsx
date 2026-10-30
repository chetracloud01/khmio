"use client";

import type { Currency } from "@khmio/shared";
import { buttonVariants, type Tone } from "@khmio/ui";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { StatusTileRow } from "@/components/status-tile-row";
import { formatMoney } from "@/components/order-ui";
import type { StockPage } from "@/lib/api";
import { STOCK_LEVELS } from "./stock-levels";
import { reorderFigures, STOCK_TILES, stockTileFigures, type StockTile } from "./stock-tiles";

type Item = StockPage["items"][number];

/** Each tile's look and what it asks for (none: nothing to do there). */
const TILE_LOOK: Record<StockTile, { tone: Tone; action?: "tileActionOrder" | "tileActionTrack" }> = {
  out: { tone: "danger", action: "tileActionOrder" },
  low: { tone: "warning", action: "tileActionOrder" },
  ok: { tone: "success" },
  untracked: { tone: "muted", action: "tileActionTrack" },
};

const otherOf = (currency: Currency): Currency => (currency === "USD" ? "KHR" : "USD");

/**
 * The Stock page's status tiles (design/screens.md S13 "Stock"), over every
 * item: Out · Low · In stock (with what it's worth) · Not tracked — how many,
 * and what to do. Tapped, the list follows; tapped again, every item.
 */
export function StockStatusTiles({ items, mainCurrency, active, onSelect }: { items: readonly Item[]; mainCurrency: Currency; active: StockTile | null; onSelect: (tile: StockTile | null) => void }) {
  const t = useTranslations("Stock");
  const figures = stockTileFigures(items);
  const other = otherOf(mainCurrency);
  const tiles = STOCK_TILES.map((tile) => {
    const look = TILE_LOOK[tile];
    const { count, value } = figures[tile];
    // In stock: what it's worth; the others: how many items.
    const worth = tile === "ok";
    return {
      key: tile,
      icon: STOCK_LEVELS[tile].icon,
      tone: look.tone,
      label: t(`chip_${tile}`),
      count: worth ? t("itemsCount", { count }) : undefined,
      amount: worth ? formatMoney(value[mainCurrency], mainCurrency) : t("itemsCount", { count }),
      sub: worth && value[other] > 0 ? `+ ${formatMoney(value[other], other)}` : undefined,
      action: look.action && count > 0 ? t(look.action) : undefined,
      view: tile,
    };
  });
  return <StatusTileRow label={t("tilesLabel")} tiles={tiles} active={active} onSelect={onSelect} />;
}

/**
 * Everything at or below its reorder point, in one tap (design/screens.md
 * S13 "Stock"): how many items, what ordering them at their suggested
 * quantities costs at their last cost, and "Create bill" — a New bill
 * already filled with them.
 */
export function ReorderBar({ items, mainCurrency, billHref }: { items: readonly Item[]; mainCurrency: Currency; billHref: (items: Item[]) => string }) {
  const t = useTranslations("Stock");
  const reorder = reorderFigures(items);
  if (reorder.items.length === 0) return null;
  const other = otherOf(mainCurrency);
  const cost = [mainCurrency, other].filter((currency) => reorder.cost[currency] > 0).map((currency) => formatMoney(reorder.cost[currency], currency));
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/40 bg-warning/5 p-3 sm:flex-nowrap">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning text-bg" aria-hidden="true">
        <ShoppingCart className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-normal">{t("reorderBarTitle", { count: reorder.items.length })}</span>
        <span className="block text-sm text-muted">
          {[cost.length > 0 ? t("reorderBarCost", { amount: cost.join(" + ") }) : "", reorder.withoutCost > 0 ? t("withoutCost", { count: reorder.withoutCost }) : ""].filter(Boolean).join(" · ")}
        </span>
      </span>
      <Link href={billHref(reorder.items)} className={buttonVariants({ variant: "primary", className: "w-full sm:w-auto" })}>
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
        {t("createBill")}
      </Link>
    </section>
  );
}
