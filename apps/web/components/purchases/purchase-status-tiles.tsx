"use client";

import type { Currency } from "@khmio/shared";
import type { Tone } from "@khmio/ui";
import { AlarmClock, CalendarClock, CircleCheck, HandCoins, PackageOpen, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/components/order-ui";
import { StatusTileRow } from "@/components/status-tile-row";
import type { PayablesReport } from "@/lib/api";
import { PURCHASE_TILES, tileFigures, type PurchaseTile } from "./purchase-tiles";

/** Each tile's look and what it asks for (none: nothing to do there). */
const TILE_LOOK: Record<PurchaseTile, { icon: LucideIcon; tone: Tone; action?: "tileActionPay" | "tileActionReceive" }> = {
  overdue: { icon: AlarmClock, tone: "danger", action: "tileActionPay" },
  due_soon: { icon: CalendarClock, tone: "warning", action: "tileActionPay" },
  open: { icon: HandCoins, tone: "info", action: "tileActionPay" },
  not_received: { icon: PackageOpen, tone: "warning", action: "tileActionReceive" },
  paid: { icon: CircleCheck, tone: "success" },
};

/**
 * The Purchases page's status tiles (design/screens.md S13 "Purchases"), over
 * every bill as of today: Overdue · Due in 7 days · Unpaid · Not received ·
 * Paid — how many, how much in the shop's currency (the other under it), and
 * what to do. Tapped, the list follows; tapped again, it shows every bill.
 */
export function PurchaseStatusTiles({ report, mainCurrency, active, onSelect }: { report: PayablesReport; mainCurrency: Currency; active: PurchaseTile | null; onSelect: (tile: PurchaseTile | null) => void }) {
  const t = useTranslations("Purchases");
  const tPayables = useTranslations("Payables");
  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";
  const main = tileFigures(report, mainCurrency);
  const second = tileFigures(report, other);
  const tiles = PURCHASE_TILES.map((tile) => {
    const look = TILE_LOOK[tile];
    const figures = main[tile];
    return {
      key: tile,
      icon: look.icon,
      tone: look.tone,
      label: t(`tile_${tile}`),
      count: tPayables("billCount", { count: figures.count }),
      amount: formatMoney(figures.amount, mainCurrency),
      sub: second[tile].amount > 0 ? `+ ${formatMoney(second[tile].amount, other)}` : undefined,
      action: look.action && figures.count > 0 ? t(look.action) : undefined,
      view: tile,
    };
  });
  return <StatusTileRow label={t("tilesLabel")} tiles={tiles} active={active} onSelect={onSelect} />;
}
