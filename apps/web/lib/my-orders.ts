// "My orders" without an account (2026-10-22 buyer review): the orders this
// phone has placed or opened, kept on the phone only — never sent anywhere.
// Each entry is just enough to find the order again; its status is read
// fresh from the order page's own link when the list is shown.

export interface MyOrder {
  /** The order link's token: the only key to the order. */
  token: string;
  shopSlug: string;
  shopName: string;
  orderNumber: number;
  /** ISO time it was placed. */
  placedAt: string;
}

const KEY = "khmio.myOrders";
/** Enough for a year of a regular buyer; older ones drop off. */
const MAX_ORDERS = 30;

const isMyOrder = (value: unknown): value is MyOrder => {
  const entry = value as MyOrder;
  return Boolean(entry) && typeof entry.token === "string" && typeof entry.shopSlug === "string" && typeof entry.shopName === "string" && typeof entry.orderNumber === "number" && typeof entry.placedAt === "string";
};

/** Newest first. Storage can be missing or blocked (private window): then there are none. */
export function readMyOrders(): MyOrder[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isMyOrder) : [];
  } catch {
    return [];
  }
}

/** Adds or refreshes one order (opening an order page calls this). */
export function rememberOrder(order: MyOrder) {
  try {
    const rest = readMyOrders().filter((entry) => entry.token !== order.token);
    const next = [order, ...rest].sort((a, b) => b.placedAt.localeCompare(a.placedAt)).slice(0, MAX_ORDERS);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not kept on this phone: the order page still works by its link.
  }
}

export function forgetMyOrders() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}
