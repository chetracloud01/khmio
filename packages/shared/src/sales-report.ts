import type { OrderPaymentMethod } from "./checkout";
import type { OrderFulfilment } from "./delivery";
import type { Currency } from "./money";
import { countsAsSale, isCashToCollect, type OrderChannel, type OrderStatus } from "./orders";
import { HOURS_IN_DAY } from "./time";
import { reportRange, reportSeries, seriesKeyOf, type ReportPeriod, type ReportQuery, type SeriesUnit } from "./report-period";

// The sales report (design/screens.md S17 "Sales"): for a period, what the
// shop sold in the shop (counter sales) and online (orders and bookings from
// the shop page) — the totals, the average order, sales over time, how
// buyers paid, the busiest hours, how online orders reached the buyer, cash
// still to collect, what was cancelled, and the best sellers. Sales follow
// the home page's rule (countsAsSale: not cancelled, not still waiting for
// an online payment). Each order keeps its currency and frozen total: dollars
// and riel are never added together here. Pure, so it's tested without a
// database.

type Money = Record<Currency, number>;
const zero = (): Money => ({ USD: 0, KHR: 0 });

/** Most products the report lists (best sellers). */
export const SALES_REPORT_TOP_PRODUCTS = 20;
/** Most orders the report's table lists, newest first (the sums always read every order; the Orders page finds any). */
export const SALES_REPORT_ORDER_LIMIT = 1000;

/** The period's orders, grouped by everything the report splits them by (the API adds them up per group). */
export interface SalesGroup {
  /** Phnom Penh day and hour the order was placed. */
  day: string;
  hour: number;
  channel: OrderChannel;
  paymentMethod: OrderPaymentMethod;
  fulfilment: OrderFulfilment;
  status: OrderStatus;
  currency: Currency;
  /** Services booked for a time (orders.preferred_at set). */
  booking: boolean;
  orders: number;
  total: number;
}

/** One product's sales on one day in one currency (orders that count as sales only). */
export interface SalesItemRow {
  day: string;
  productId: string;
  nameKm: string;
  nameEn: string;
  currency: Currency;
  quantity: number;
  total: number;
}

export interface SalesShare {
  orders: number;
  /** Per currency: what the orders in that currency added up to (the average is worked out per currency). */
  ordersBy: Record<Currency, number>;
  sales: Money;
}

export interface SalesReport {
  period: ReportPeriod;
  days: { from: string; to: string } | null;
  unit: SeriesUnit;
  series: { key: string; shop: Money; online: Money; orders: number }[];
  figures: {
    all: SalesShare;
    /** The average order, per currency (rounded to the smallest unit). */
    average: Money;
    shop: SalesShare;
    online: SalesShare & { bookings: number };
    /** Cash-on-delivery orders not finished yet: money still with the buyer or a driver. */
    toCollect: { orders: number; money: Money };
    cancelled: { orders: number; money: Money };
  };
  payments: { method: OrderPaymentMethod; orders: number; money: Money }[];
  /** 0–23: orders and money by the hour they were placed, and the money in the shop and online. */
  hours: { hour: number; orders: number; money: Money; shop: Money; online: Money }[];
  /** Online orders sent out or picked up. Success: delivered (or handed over) of those that ended. */
  delivery: { delivery: number; pickup: number; done: number; failed: number; underway: number; successRate: number | null };
  /** Most sold first, by money in the shop's currency, then the other, then units. */
  products: { productId: string; nameKm: string; nameEn: string; quantity: number; money: Money }[];
}

const emptyShare = (): SalesShare => ({ orders: 0, ordersBy: { USD: 0, KHR: 0 }, sales: zero() });
const addTo = (share: SalesShare, group: SalesGroup) => {
  share.orders += group.orders;
  share.ordersBy[group.currency] += group.orders;
  share.sales[group.currency] += group.total;
};
const DELIVERED: readonly OrderStatus[] = ["delivered", "completed"];

/** The report for a period. `groups` and `items` are from the period's first day on (all, for everything). */
export function salesReport(groups: readonly SalesGroup[], items: readonly SalesItemRow[], query: ReportQuery, today: string, mainCurrency: Currency): SalesReport {
  const days = reportRange(query, today);
  const inPeriod = <T extends { day: string }>(row: T) => !days || (row.day >= days.from && row.day <= days.to);
  const read = groups.filter(inPeriod);
  const first = read.reduce((oldest, group) => (group.day < oldest ? group.day : oldest), today);
  const { unit, keys } = reportSeries(days?.from ?? first, days?.to ?? today);
  const series = keys.map((key) => ({ key, shop: zero(), online: zero(), orders: 0 }));
  const bar = new Map(series.map((point) => [point.key, point]));
  const all = emptyShare();
  const shop = emptyShare();
  const online = { ...emptyShare(), bookings: 0 };
  const toCollect = { orders: 0, money: zero() };
  const cancelled = { orders: 0, money: zero() };
  const payments = new Map<OrderPaymentMethod, SalesReport["payments"][number]>();
  const hours = Array.from({ length: HOURS_IN_DAY }, (_, hour) => ({ hour, orders: 0, money: zero(), shop: zero(), online: zero() }));
  const delivery = { delivery: 0, pickup: 0, done: 0, failed: 0, underway: 0 };

  for (const group of read) {
    if (group.status === "cancelled") {
      cancelled.orders += group.orders;
      cancelled.money[group.currency] += group.total;
    }
    if (!countsAsSale(group.status)) continue;
    addTo(all, group);
    if (group.channel === "in_store") addTo(shop, group);
    else {
      addTo(online, group);
      if (group.booking) online.bookings += group.orders;
    }
    if (isCashToCollect(group)) {
      toCollect.orders += group.orders;
      toCollect.money[group.currency] += group.total;
    }
    const point = bar.get(seriesKeyOf(group.day, unit));
    if (point) {
      point[group.channel === "in_store" ? "shop" : "online"][group.currency] += group.total;
      point.orders += group.orders;
    }
    const payment = payments.get(group.paymentMethod) ?? { method: group.paymentMethod, orders: 0, money: zero() };
    payment.orders += group.orders;
    payment.money[group.currency] += group.total;
    payments.set(group.paymentMethod, payment);
    const hour = hours[group.hour];
    if (hour) {
      hour.orders += group.orders;
      hour.money[group.currency] += group.total;
      hour[group.channel === "in_store" ? "shop" : "online"][group.currency] += group.total;
    }
    if (group.fulfilment === "delivery" || group.fulfilment === "pickup") {
      delivery[group.fulfilment] += group.orders;
      if (DELIVERED.includes(group.status)) delivery.done += group.orders;
      else if (group.status === "failed_delivery") delivery.failed += group.orders;
      else delivery.underway += group.orders;
    }
  }

  const other: Currency = mainCurrency === "USD" ? "KHR" : "USD";
  const byProduct = new Map<string, SalesReport["products"][number]>();
  for (const row of items.filter(inPeriod)) {
    const product = byProduct.get(row.productId) ?? { productId: row.productId, nameKm: row.nameKm, nameEn: row.nameEn, quantity: 0, money: zero() };
    product.quantity += row.quantity;
    product.money[row.currency] += row.total;
    byProduct.set(row.productId, product);
  }
  const average = (currency: Currency) => (all.ordersBy[currency] > 0 ? Math.round(all.sales[currency] / all.ordersBy[currency]) : 0);
  const ended = delivery.done + delivery.failed;
  return {
    period: query.period,
    days,
    unit,
    series,
    figures: { all, average: { USD: average("USD"), KHR: average("KHR") }, shop, online, toCollect, cancelled },
    payments: [...payments.values()].sort((a, b) => b.orders - a.orders),
    hours,
    delivery: { ...delivery, successRate: ended > 0 ? Math.round((delivery.done / ended) * 100) : null },
    products: [...byProduct.values()]
      .sort((a, b) => b.money[mainCurrency] - a.money[mainCurrency] || b.money[other] - a.money[other] || b.quantity - a.quantity)
      .slice(0, SALES_REPORT_TOP_PRODUCTS),
  };
}
