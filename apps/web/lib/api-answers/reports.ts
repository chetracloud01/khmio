import {
  DASHBOARD_PERIODS,
  LOSS_REASONS,
  REPORT_PERIODS,
  currencySchema,
  orderChannelSchema,
  orderFulfilmentSchema,
  orderPaymentMethodSchema,
  orderStatusSchema,
} from "@khmio/shared";
import { z } from "zod";
import { perCurrency } from "./shapes";

const payablesCellSchema = z.object({ count: z.number(), bought: z.number(), owed: z.number() });
const payablesFiguresShape = {
  billCount: z.number(),
  bought: z.number(),
  returned: z.number(),
  paid: z.number(),
  owed: z.number(),
  overdue: z.number(),
  dueSoon: z.number(),
  dueSoonCount: z.number(),
  notReceived: payablesCellSchema,
};
const goodsCellsSchema = z.object({ received: payablesCellSchema, not_received: payablesCellSchema });
const payablesCurrencySchema = z.object({
  figures: z.object(payablesFiguresShape),
  status: z.object({ unpaid: goodsCellsSchema, part: goodsCellsSchema, paid: goodsCellsSchema, overdue: goodsCellsSchema }),
  /** What's owed by how late (AGE_BUCKETS). */
  ageing: z.object({ not_due: z.number(), late_1_30: z.number(), late_31_60: z.number(), late_61_90: z.number(), late_over_90: z.number() }),
});

/** GET /purchases/report: the payables report (packages/shared payables.ts) — dollars and riel apart. */
export const payablesReportSchema = z.object({
  period: z.enum(REPORT_PERIODS),
  days: z.object({ from: z.string(), to: z.string() }).nullable(),
  /** The bought-and-paid bars: by day, or by month ("2026-10") for long ranges and every bill. */
  unit: z.enum(["day", "month"]),
  series: z.array(z.object({ key: z.string(), bought: perCurrency, paid: perCurrency })),
  currencies: z.object({ USD: payablesCurrencySchema, KHR: payablesCurrencySchema }),
  suppliers: z.array(z.object({ key: z.string(), supplierId: z.string().nullable(), supplierName: z.string(), currency: currencySchema, ...payablesFiguresShape })),
});
export type PayablesReport = z.infer<typeof payablesReportSchema>;
export type PayablesSupplierRow = PayablesReport["suppliers"][number];

const stockReportItemShape = {
  variantId: z.string(),
  titleKm: z.string(),
  titleEn: z.string(),
  optionKm: z.string(),
  optionEn: z.string(),
  sku: z.string(),
  categoryId: z.string(),
  onHand: z.number().nullable(),
  low: z.boolean(),
};
const itemWorthSchema = z.object({ amount: z.number(), currency: currencySchema }).nullable();

/** GET /stock/report: the stock report (packages/shared stock-report.ts) — money at today's cost, dollars and riel apart. */
export const stockReportSchema = z.object({
  period: z.enum(REPORT_PERIODS),
  days: z.object({ from: z.string(), to: z.string() }).nullable(),
  unit: z.enum(["day", "month"]),
  series: z.array(z.object({ key: z.string(), in: z.number(), out: z.number() })),
  figures: z.object({ value: perCurrency, withoutCost: z.number(), inUnits: z.number(), outUnits: z.number(), inValue: perCurrency, outValue: perCurrency }),
  levels: z.object({ out: z.number(), low: z.number(), ok: z.number(), untracked: z.number() }),
  byCategory: z.array(z.object({ categoryId: z.string(), value: perCurrency, units: z.number() })),
  kinds: z.array(z.object({ kind: z.string(), direction: z.enum(["in", "out"]), units: z.number(), value: perCurrency })),
  slowMovers: z.array(z.object({ ...stockReportItemShape, value: itemWorthSchema, lastSoldOn: z.string().nullable() })),
  rows: z.array(z.object({ ...stockReportItemShape, opening: z.number(), in: z.number(), out: z.number(), closing: z.number(), value: itemWorthSchema })),
});
export type StockReport = z.infer<typeof stockReportSchema>;

const countSumsShape = { lost: perCurrency, found: perCurrency, net: perCurrency, lostUnits: z.number(), foundUnits: z.number(), withoutCost: z.number(), items: z.number(), accuracy: z.number().nullable() };

/** GET /stock/counts/report: the stock counts report (packages/shared count-report.ts) — worth at each count's fixed costs, dollars and riel apart; lost is below zero. */
export const countReportSchema = z.object({
  period: z.enum(REPORT_PERIODS),
  days: z.object({ from: z.string(), to: z.string() }).nullable(),
  figures: z.object({ ...countSumsShape, counts: z.number() }),
  counts: z.array(z.object({ ...countSumsShape, id: z.string(), number: z.number(), appliedAt: z.string(), appliedOn: z.string(), categoryIds: z.array(z.string()) })),
  byCategory: z.array(z.object({ categoryId: z.string(), lostUnits: z.number(), lost: perCurrency })),
  items: z.array(z.object({ ...stockReportItemShape, timesShort: z.number(), unitsLost: z.number(), lost: perCurrency, timesOver: z.number(), unitsFound: z.number() })),
});
export type CountReport = z.infer<typeof countReportSchema>;

const salesShareShape = { orders: z.number(), ordersBy: perCurrency, sales: perCurrency };
const ordersAndMoney = { orders: z.number(), money: perCurrency };

/** GET /orders/report: the sales report (packages/shared sales-report.ts) — in the shop and online, dollars and riel apart, plus the newest orders of the period. */
export const salesReportSchema = z.object({
  period: z.enum(REPORT_PERIODS),
  days: z.object({ from: z.string(), to: z.string() }).nullable(),
  unit: z.enum(["day", "month"]),
  series: z.array(z.object({ key: z.string(), shop: perCurrency, online: perCurrency, orders: z.number() })),
  figures: z.object({
    all: z.object(salesShareShape),
    average: perCurrency,
    shop: z.object(salesShareShape),
    online: z.object({ ...salesShareShape, bookings: z.number() }),
    toCollect: z.object(ordersAndMoney),
    cancelled: z.object(ordersAndMoney),
  }),
  payments: z.array(z.object({ method: orderPaymentMethodSchema, ...ordersAndMoney })),
  hours: z.array(z.object({ hour: z.number(), ...ordersAndMoney })),
  delivery: z.object({ delivery: z.number(), pickup: z.number(), done: z.number(), failed: z.number(), underway: z.number(), successRate: z.number().nullable() }),
  products: z.array(z.object({ productId: z.string(), nameKm: z.string(), nameEn: z.string(), quantity: z.number(), money: perCurrency })),
  orders: z.array(
    z.object({
      id: z.string(),
      orderNumber: z.number(),
      createdAt: z.string(),
      channel: orderChannelSchema,
      fulfilment: orderFulfilmentSchema,
      paymentMethod: orderPaymentMethodSchema,
      status: orderStatusSchema,
      currency: currencySchema,
      totalMinor: z.number(),
      buyerName: z.string(),
      booking: z.boolean(),
    }),
  ),
  ordersLimited: z.boolean(),
});
export type SalesReport = z.infer<typeof salesReportSchema>;

/** GET /orders/profit-loss (Pro): the profit and loss statement for a period (packages/shared profit-loss.ts) — dollars and riel apart; losses below zero. */
export const profitLossSchema = z.object({
  period: z.enum(REPORT_PERIODS),
  days: z.object({ from: z.string(), to: z.string() }).nullable(),
  unit: z.enum(["day", "month"]),
  statement: z.object({
    grossSales: perCurrency,
    discounts: perCurrency,
    goods: perCurrency,
    deliveryFees: perCurrency,
    netSales: perCurrency,
    cost: perCurrency,
    missingCostSales: perCurrency,
    grossProfit: perCurrency,
    losses: perCurrency,
    found: perCurrency,
    profit: perCurrency,
    vat: perCurrency,
    orders: z.number(),
    lossesEstimated: z.boolean(),
    unvaluedUnits: z.number(),
  }),
  series: z.array(z.object({ key: z.string(), netSales: perCurrency, costedSales: perCurrency, cost: perCurrency, losses: perCurrency, profit: perCurrency })),
  moves: z.array(z.object({ reason: z.enum(LOSS_REASONS), direction: z.enum(["in", "out"]), units: z.number(), value: perCurrency })),
  products: z.array(z.object({ productId: z.string(), nameKm: z.string(), nameEn: z.string(), quantity: z.number(), sales: perCurrency, cost: perCurrency, profit: perCurrency, missingCostSales: perCurrency })),
});
export type ProfitLoss = z.infer<typeof profitLossSchema>;

const dashboardSalesShape = z.object({ sales: perCurrency, orders: z.number(), average: perCurrency, shop: perCurrency, online: perCurrency, bookings: z.number() });
const dashboardProfitShape = z.object({ netSales: perCurrency, costedGoods: perCurrency, cost: perCurrency, missingCostSales: perCurrency, grossProfit: perCurrency, losses: perCurrency, found: perCurrency, profit: perCurrency, lossesEstimated: z.boolean() });

/** GET /dashboard: the seller's dashboard (packages/shared dashboard.ts) — the period beside the one before; profit (Pro) and stock (plans with stock) null without them. */
export const dashboardSchema = z.object({
  period: z.enum(DASHBOARD_PERIODS),
  days: z.object({ from: z.string(), to: z.string() }),
  previousDays: z.object({ from: z.string(), to: z.string() }),
  unit: z.enum(["hour", "day"]),
  sales: z.object({
    now: dashboardSalesShape,
    before: dashboardSalesShape,
    toCollect: z.object({ orders: z.number(), money: perCurrency }),
    points: z.array(z.object({ key: z.string(), shop: perCurrency, online: perCurrency, orders: z.number(), previous: perCurrency })),
    payments: z.array(z.object({ method: orderPaymentMethodSchema, orders: z.number(), money: perCurrency })),
    products: z.array(z.object({ productId: z.string(), nameKm: z.string(), nameEn: z.string(), quantity: z.number(), money: perCurrency })),
  }),
  profit: z.object({ now: dashboardProfitShape, before: dashboardProfitShape, points: z.array(z.object({ key: z.string(), profit: perCurrency })) }).nullable(),
  stock: z.object({ value: perCurrency, withoutCost: z.number(), toReorder: z.number(), unpaidBills: z.number(), overdueBills: z.number() }).nullable(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
