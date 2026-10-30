// Types shared by the seller's home (design/screens.md S3).
// Its blocks live in components/seller-app (header, install, banner, quick
// actions), components/home (the sales, profit and bills cards) and
// components/seller-cards.

/** Where the shop stands, for the pill under the greeting. */
export type ShopState = { kind: "open" } | { kind: "trial"; daysLeft: number } | { kind: "due" } | { kind: "paused" };
