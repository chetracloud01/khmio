import type { Currency } from "@khmio/shared";
import { AlertTriangle, CircleSlash, PackageCheck, PackageX } from "lucide-react";
import type { StockPage } from "@/lib/api";

type Item = StockPage["items"][number];
export type StockLevel = "out" | "low" | "ok" | "untracked";

/** Each level's tone, word (messages "Stock") and icon: the status column, its pill, the chips and the summary cards. */
export const STOCK_LEVELS = {
  out: { tone: "danger", word: "levelOut", icon: PackageX },
  low: { tone: "warning", word: "levelLow", icon: AlertTriangle },
  ok: { tone: "success", word: "levelOk", icon: PackageCheck },
  untracked: { tone: "muted", word: "notTracked", icon: CircleSlash },
} as const;
/** Most urgent first: the status column sorts this way. */
export const STOCK_LEVEL_ORDER: readonly StockLevel[] = ["out", "low", "ok", "untracked"];

export const stockLevelOf = (item: Item): StockLevel => (item.onHand === null ? "untracked" : item.onHand === 0 ? "out" : item.low ? "low" : "ok");

/** On hand × cost, in the option's cost currency; null when it isn't tracked or has no cost. */
export const stockValueOf = (item: Item): { amount: number; currency: Currency } | null =>
  item.onHand !== null && item.costMinor !== null && item.costCurrency ? { amount: item.onHand * item.costMinor, currency: item.costCurrency } : null;
