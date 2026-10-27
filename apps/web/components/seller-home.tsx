import type { Currency } from "@khmio/shared";

// Types shared by the seller's home (design/screens.md S3), live and mockup.
// Its blocks live in components/seller-app (header, install, banner, quick
// actions), components/sales-overview and components/seller-cards.

export type Money = Record<Currency, number>;

/** Where the shop stands, for the pill under the greeting. */
export type ShopState = { kind: "open" } | { kind: "trial"; daysLeft: number } | { kind: "due" } | { kind: "paused" };
