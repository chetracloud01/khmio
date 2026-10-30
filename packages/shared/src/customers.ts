import type { ListSpec } from "./list-query";

// The shop's customers (design/screens.md S14; every plan): the buyers it
// already keeps (a row per phone, saved by online checkout and by counter
// sales with a phone). Their numbers count the same orders as the sales
// figures: not cancelled, not still awaiting payment; dollars and riel
// apart, never converted.

/** A customer is new for this many days after they're first saved. */
export const NEW_CUSTOMER_DAYS = 30;
/** A customer is coming back from this many orders. */
export const RETURNING_MIN_ORDERS = 2;
/** A customer who bought before but not in this many days hasn't come back (worth a call). */
export const LAPSED_AFTER_DAYS = 60;

/** The customer list's views (the Customers page's tiles): new, coming back, not back for a while. */
export const CUSTOMER_CHIPS = ["new", "returning", "lapsed"] as const;
export type CustomerChip = (typeof CUSTOMER_CHIPS)[number];
export const isCustomerChip = (chip: string): chip is CustomerChip => (CUSTOMER_CHIPS as readonly string[]).includes(chip);

/** The customer list: sorted by their newest order unless the seller picks another column. */
export const CUSTOMER_LIST_SPEC = {
  sorts: ["lastOrder", "orders", "spent", "name", "since"],
  chips: CUSTOMER_CHIPS,
  filters: {},
  defaultSort: { key: "lastOrder", dir: "desc" },
} as const satisfies ListSpec;

/** Most orders one customer's page lists, newest first. */
export const CUSTOMER_ORDER_HISTORY = 50;
