import type { OrderPaymentMethod } from "./checkout";
import type { Currency } from "./money";
import { countsAsSale, getOrderTab, isCashToCollect, type OrderStatus } from "./orders";

// The Orders page's status tiles (design/screens.md S4): over every order of
// the shop — not the list's search or filters — how many orders and how much
// money wait at each step (To confirm, Packing, Sending, Problems), the cash
// still to collect, and today's sales. Each counts exactly what its list tab
// lists. Dollars and riel apart. Pure, so it's tested without a database.

type Money = Record<Currency, number>;
const zero = (): Money => ({ USD: 0, KHR: 0 });

/** The order tabs that have a tile (Delivered is history, not work). */
export const ORDER_TILE_TABS = ["to_confirm", "packing", "sending", "problems"] as const;
export type OrderTileTab = (typeof ORDER_TILE_TABS)[number];
const isTileTab = (tab: string): tab is OrderTileTab => (ORDER_TILE_TABS as readonly string[]).includes(tab);

/** Orders grouped by what the tiles split them by (the API adds them up per group). */
export interface OrderStatusGroup {
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  currency: Currency;
  /** Placed today (Phnom Penh). */
  today: boolean;
  orders: number;
  total: number;
}

export interface OrderTileFigure {
  count: number;
  money: Money;
}

export interface OrderStatusFigures {
  tabs: Record<OrderTileTab, OrderTileFigure>;
  /** Of Problems: those not delivered (the rest were cancelled). */
  notDelivered: number;
  toCollect: OrderTileFigure;
  /** Today's sales (countsAsSale). */
  today: OrderTileFigure;
}

const addTo = (figure: OrderTileFigure, group: OrderStatusGroup) => {
  figure.count += group.orders;
  figure.money[group.currency] += group.total;
};

export function orderStatusFigures(groups: readonly OrderStatusGroup[]): OrderStatusFigures {
  const empty = (): OrderTileFigure => ({ count: 0, money: zero() });
  const tabs: Record<OrderTileTab, OrderTileFigure> = { to_confirm: empty(), packing: empty(), sending: empty(), problems: empty() };
  const figures: OrderStatusFigures = { tabs, notDelivered: 0, toCollect: empty(), today: empty() };
  for (const group of groups) {
    const tab = getOrderTab(group.status);
    if (isTileTab(tab)) addTo(figures.tabs[tab], group);
    if (group.status === "failed_delivery") figures.notDelivered += group.orders;
    if (isCashToCollect(group)) addTo(figures.toCollect, group);
    if (group.today && countsAsSale(group.status)) addTo(figures.today, group);
  }
  return figures;
}
