"use client";

import type { BuyerStockState } from "@khmio/shared";

/** Buyer-facing stock text, already translated. */
export interface StockLabels {
  soldOut: string;
  onlyLeft: (count: number) => string;
}

/** "Sold out" or "Only 3 left" under an item; nothing when stock isn't tracked or there's plenty. */
export function StockNote({ state, labels }: { state: BuyerStockState; labels: StockLabels }) {
  if (state.kind === "sold_out") return <span className="text-xs font-semibold text-danger">{labels.soldOut}</span>;
  if (state.kind === "low") return <span className="text-xs font-medium text-warning">{labels.onlyLeft(state.available)}</span>;
  return null;
}
