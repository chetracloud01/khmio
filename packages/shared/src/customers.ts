import type { ListSpec } from "./list-query";

// The shop's customers (design/screens.md S14; every plan): the buyers it
// already keeps (a row per phone, saved by online checkout and by counter
// sales with a phone). Their numbers count the same orders as the sales
// figures: not cancelled, not still awaiting payment; dollars and riel
// apart, never converted.

/** The customer list: sorted by their newest order unless the seller picks another column. */
export const CUSTOMER_LIST_SPEC = {
  sorts: ["lastOrder", "orders", "spent", "name", "since"],
  chips: [],
  filters: {},
  defaultSort: { key: "lastOrder", dir: "desc" },
} as const satisfies ListSpec;

/** Most orders one customer's page lists, newest first. */
export const CUSTOMER_ORDER_HISTORY = 50;
