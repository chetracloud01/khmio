"use client";

import { ORDER_TILE_TABS, type Currency } from "@khmio/shared";
import { CircleDollarSign, HandCoins } from "lucide-react";
import { useTranslations } from "next-intl";
import { ORDER_TAB_ICON, ORDER_TAB_TONE } from "@/components/order-ui";
import { moneyLines } from "@/components/reports/report-money";
import { StatusTileRow, type StatusTile } from "@/components/status-tile-row";
import type { OrderTiles } from "@/lib/api";

/** The list views the Orders tiles open: four of its tabs, and cash still to collect. */
export const ORDER_TILE_VIEWS = [...ORDER_TILE_TABS, "to_collect"] as const;
export type OrderTileView = (typeof ORDER_TILE_VIEWS)[number];
export const isOrderTileView = (chip: string): chip is OrderTileView => (ORDER_TILE_VIEWS as readonly string[]).includes(chip);

/** What each tab's tile asks the seller to do, when it has orders. */
const TAB_ACTION = { to_confirm: "tileActionConfirm", packing: "tileActionPack", sending: "tileActionSend", problems: "tileActionCheck" } as const;

/**
 * The Orders page's status tiles (design/screens.md S4), over every order:
 * To confirm · Packing · Sending · Cash to collect · Problems — how many, how
 * much (the shop's currency, the other under it) and what to do; tapped, the
 * list follows — and Sales today, which opens the Sales report.
 */
export function OrderStatusTiles({ figures, mainCurrency, rate, active, onSelect, todayHref }: { figures: OrderTiles; mainCurrency: Currency; rate: number; active: OrderTileView | null; onSelect: (view: OrderTileView | null) => void; todayHref: string }) {
  const t = useTranslations("Orders");
  const money = (value: Record<Currency, number>) => moneyLines(value, mainCurrency, null, rate);
  const tile = (key: OrderTileView, figure: OrderTiles["toCollect"], look: Pick<StatusTile<OrderTileView>, "icon" | "tone" | "label" | "action">): StatusTile<OrderTileView> => {
    const lines = money(figure.money);
    return { key, ...look, count: t("orderCount", { count: figure.count }), amount: lines.main, sub: lines.other ?? undefined, view: key };
  };
  const today = money(figures.today.money);
  const tiles: StatusTile<OrderTileView>[] = [
    ...ORDER_TILE_TABS.filter((tab) => tab !== "problems").map((tab) =>
      tile(tab, figures.tabs[tab], { icon: ORDER_TAB_ICON[tab], tone: ORDER_TAB_TONE[tab], label: t(`tab_${tab}`), action: figures.tabs[tab].count > 0 ? t(TAB_ACTION[tab]) : undefined }),
    ),
    tile("to_collect", figures.toCollect, { icon: HandCoins, tone: "info", label: t("tab_to_collect"), action: figures.toCollect.count > 0 ? t("tileActionCollect") : undefined }),
    // Problems: how many, not their money (mostly cancelled orders, which nobody owes).
    {
      key: "problems",
      icon: ORDER_TAB_ICON.problems,
      tone: ORDER_TAB_TONE.problems,
      label: t("tab_problems"),
      amount: t("orderCount", { count: figures.tabs.problems.count }),
      sub: figures.notDelivered > 0 ? t("notDeliveredCount", { count: figures.notDelivered }) : undefined,
      action: figures.notDelivered > 0 ? t(TAB_ACTION.problems) : undefined,
      view: "problems",
    },
    { key: "today", icon: CircleDollarSign, tone: "success", label: t("tileToday"), count: t("orderCount", { count: figures.today.count }), amount: today.main, sub: today.other ?? undefined, action: t("tileActionReport"), view: null, href: todayHref },
  ];
  return <StatusTileRow label={t("tilesLabel")} tiles={tiles} active={active} onSelect={onSelect} />;
}
