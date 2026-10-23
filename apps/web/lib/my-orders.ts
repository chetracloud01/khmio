import { z } from "zod";
import { readStored, writeStored } from "./device-storage";

// "My orders" without an account (2026-10-22 buyer review): the orders this
// phone has placed or opened, kept on the phone only — never sent anywhere.
// Each entry is just enough to find the order again; its status is read
// fresh from the order page's own link when the list is shown.

const myOrderSchema = z.object({
  /** The order link's token: the only key to the order. */
  token: z.string(),
  shopSlug: z.string(),
  shopName: z.string(),
  orderNumber: z.number(),
  /** ISO time it was placed. */
  placedAt: z.string(),
});
export type MyOrder = z.infer<typeof myOrderSchema>;

const KEY = "khmio.myOrders";
/** Enough for a year of a regular buyer; older ones drop off. */
const MAX_ORDERS = 30;

/** Newest first. Storage can be missing or blocked (private window): then there are none. One unreadable entry drops only itself. */
export function readMyOrders(): MyOrder[] {
  return (readStored(KEY, z.array(z.unknown())) ?? []).flatMap((entry) => {
    const order = myOrderSchema.safeParse(entry);
    return order.success ? [order.data] : [];
  });
}

/** Adds or refreshes one order (opening an order page calls this). */
export function rememberOrder(order: MyOrder) {
  // Not kept when storage refuses: the order page still works by its link.
  const rest = readMyOrders().filter((entry) => entry.token !== order.token);
  writeStored(KEY, [order, ...rest].sort((a, b) => b.placedAt.localeCompare(a.placedAt)).slice(0, MAX_ORDERS));
}

export function forgetMyOrders() {
  writeStored(KEY, null);
}
