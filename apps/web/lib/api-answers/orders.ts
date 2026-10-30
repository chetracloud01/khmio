import {
  SELLER_ORDER_ACTIONS,
  businessTypeSchema,
  currencySchema,
  deliveryAreaSchema,
  deliverySettingsShape,
  invoiceStateSchema,
  orderCancelReasonSchema,
  orderChannelSchema,
  orderFulfilmentSchema,
  orderLineChoicesSchema,
  orderPaymentMethodSchema,
  orderStatusSchema,
} from "@khmio/shared";
import { z } from "zod";
import { perCurrency } from "./shapes";
import { catalogNameSchema, customFieldSchema, productSchema } from "./shop";

/** GET /public/stores/:slug: everything the buyer's shop page shows. */
export const publicShopSchema = z.object({
  store: z.object({
    slug: z.string(),
    name: z.string(),
    businessType: businessTypeSchema,
    phone: z.string(),
    area: deliveryAreaSchema,
    description: z.string(),
    logoUrl: z.string().nullable(),
    defaultCurrency: currencySchema,
    usdToKhrRate: z.number(),
    allowCod: z.boolean(),
    vatPercent: z.number(),
    /** As the seller typed them (packages/shared socialLinkUrl makes them links). */
    telegramLink: z.string(),
    facebookLink: z.string(),
    /** Copied from Google Maps; "" = the Map button searches the pickup address. */
    mapUrl: z.string(),
  }),
  categories: z.array(catalogNameSchema),
  products: z.array(productSchema),
  /** Zones, pickup and provinces — never the drivers. */
  delivery: deliverySettingsShape.omit({ drivers: true }),
  /** Orders need delivery saved at least once; KHQR joins in step 5. */
  ordering: z.object({ deliveryConfigured: z.boolean(), khqrReady: z.boolean() }),
  /** false = the shop is paused: "temporarily closed", no orders. */
  open: z.boolean(),
  /** Pro and Advance: free stock per tracked option; an option not in it sells without a limit. */
  stock: z.record(z.string(), z.number()),
  /** The shop's own product fields it shows buyers, to put names on products' values. */
  customFields: z.array(customFieldSchema),
});
export type PublicShop = z.infer<typeof publicShopSchema>;

/** GET/PUT /delivery. */
export const deliveryResponseSchema = z.object({
  settings: deliverySettingsShape,
  /** Saved at least once (the setup checklist's "delivery" step). */
  configured: z.boolean(),
});
export type DeliveryResponse = z.infer<typeof deliveryResponseSchema>;

/** POST /public/stores/:slug/orders. */
export const placedOrderSchema = z.object({ token: z.string(), orderNumber: z.number() });
export type PlacedOrder = z.infer<typeof placedOrderSchema>;

const dispatchRouteSchema = z.enum(["driver", "bus", "pickup"]);

/** The money and delivery facts every view of an order shares. */
const orderFactsShape = {
  orderNumber: z.number(),
  /** As printed: MEK-7K4P-9QXR. With the buyer's phone it opens this order on "Track my order". */
  trackingCode: z.string(),
  status: orderStatusSchema,
  /** "in_store" = sold at the counter (design/screens.md P1). */
  channel: orderChannelSchema,
  paymentMethod: orderPaymentMethodSchema,
  currency: currencySchema,
  subtotalMinor: z.number(),
  discountMinor: z.number(),
  deliveryFeeMinor: z.number(),
  vatPercent: z.number(),
  vatMinor: z.number(),
  totalMinor: z.number(),
  exchangeRateUsed: z.number(),
  fulfilment: orderFulfilmentSchema,
  area: deliveryAreaSchema,
  districtId: z.string().nullable(),
  provinceId: z.string().nullable(),
  landmark: z.string(),
  buyerName: z.string(),
  createdAt: z.string(),
};

const orderItemShape = {
  titleKm: z.string(),
  titleEn: z.string(),
  variantLabelKm: z.string(),
  variantLabelEn: z.string(),
  unitPriceMinor: z.number(),
  quantity: z.number(),
  lineTotalMinor: z.number(),
  /** The choices picked, frozen with the order ("Less sugar", "+1 shot"). */
  choices: orderLineChoicesSchema,
  /** The buyer's note on this item; "" = none. */
  note: z.string(),
  /** Seller views only: the line's id and the shop's own fields for it (an IMEI). */
  id: z.string().optional(),
  customValues: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
};

/** What the buyer's order page and the seller's order page both show. */
const orderViewSchema = z.object({
  ...orderFactsShape,
  pickupAddress: z.string(),
  pickupHours: z.string(),
  /** A booking (only services): when the buyer would like it done; null otherwise. */
  preferredAt: z.string().nullable(),
  cancelReason: orderCancelReasonSchema.nullable(),
  items: z.array(z.object({ variantId: z.string(), ...orderItemShape })),
});

/** GET /public/orders/:token: the buyer's order page. */
export const publicOrderSchema = orderViewSchema.extend({
  events: z.array(z.object({ status: orderStatusSchema, at: z.string() })),
  /** How it was sent: the driver's name or the bus ticket (never the driver's phone). */
  dispatch: z
    .object({ route: dispatchRouteSchema, driverName: z.string(), busCompany: z.string(), ticketNumber: z.string(), dispatchedAt: z.string() })
    .nullable(),
  /** The buyer may cancel by themselves right now (packages/shared canBuyerCancel). */
  canCancel: z.boolean(),
  /** A Telegram chat follows this order's status. */
  followingOnTelegram: z.boolean(),
  /** The KHQR to pay while the order waits for payment; null otherwise. */
  payment: z
    .object({
      qrPayload: z.string(),
      amountMinor: z.number(),
      currency: currencySchema,
      expiresAt: z.string(),
      /** Only with the stand-in bank (KHQR_PROVIDER=fake): what "pay (test)" pays. */
      testBankRef: z.string().nullable(),
    })
    .nullable(),
  store: z.object({ slug: z.string(), name: z.string(), phone: z.string(), logoUrl: z.string().nullable() }),
});
export type PublicOrder = z.infer<typeof publicOrderSchema>;

/** GET /orders/summary: what needs the seller now (the dashboard and the Orders badge). Money per currency (cents, riel), never added together. */
export const sellerSummarySchema = z.object({ waiting: z.number(), cashToCollect: perCurrency });
export type SellerSummary = z.infer<typeof sellerSummarySchema>;

/** GET /customers/status: the Customers page's tiles — how many customers in each view, and what they've spent. */
export const customerTilesSchema = z.object({
  counts: z.object({ all: z.number(), new: z.number(), returning: z.number(), lapsed: z.number() }),
  spent: perCurrency,
});
export type CustomerTiles = z.infer<typeof customerTilesSchema>;

const orderTileFigureSchema = z.object({ count: z.number(), money: perCurrency });
/** GET /orders/status: the Orders page's status tiles (packages/shared order-status.ts), over every order. */
export const orderTilesSchema = z.object({
  tabs: z.object({ to_confirm: orderTileFigureSchema, packing: orderTileFigureSchema, sending: orderTileFigureSchema, problems: orderTileFigureSchema }),
  notDelivered: z.number(),
  toCollect: orderTileFigureSchema,
  today: orderTileFigureSchema,
});
export type OrderTiles = z.infer<typeof orderTilesSchema>;

/** GET /orders: one row of the seller's order list. */
export const sellerOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.number(),
  /** As printed: MEK-7K4P-9QXR (the list's search finds it). */
  trackingCode: z.string(),
  status: orderStatusSchema,
  /** "in_store" = sold at the counter (design/screens.md P1). */
  channel: orderChannelSchema,
  paymentMethod: orderPaymentMethodSchema,
  currency: currencySchema,
  totalMinor: z.number(),
  buyerName: z.string(),
  buyerPhone: z.string(),
  fulfilment: orderFulfilmentSchema,
  area: deliveryAreaSchema,
  districtId: z.string().nullable(),
  provinceId: z.string().nullable(),
  createdAt: z.string(),
  itemCount: z.number(),
});
export type SellerOrder = z.infer<typeof sellerOrderSchema>;

/** GET /customers/page (rows): one of the shop's buyers with their numbers (packages/shared customers.ts). Money per currency, never added together. */
export const customerRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** 855… */
  phone: z.string(),
  /** Orders that count as sales: not cancelled, not still awaiting payment. */
  orderCount: z.number(),
  spent: perCurrency,
  firstOrderAt: z.string().nullable(),
  lastOrderAt: z.string().nullable(),
  /** When the shop first saw them. */
  createdAt: z.string(),
});
export type CustomerRow = z.infer<typeof customerRowSchema>;

/** GET /customers/:id: one buyer, their last delivery choice, and their orders, newest first. */
export const customerDetailSchema = customerRowSchema.extend({
  area: deliveryAreaSchema.nullable(),
  districtId: z.string().nullable(),
  provinceId: z.string().nullable(),
  landmark: z.string(),
  orders: z.array(sellerOrderSchema),
});
export type CustomerDetail = z.infer<typeof customerDetailSchema>;

/** GET /orders/:id and POST /orders/:id/actions: one order in full, for the seller. */
export const sellerOrderDetailSchema = orderViewSchema.extend({
  id: z.string(),
  buyerPhone: z.string(),
  /** Their page in Customers; null for a walk-in at the counter who gave no phone. */
  customerId: z.string().nullable(),
  cancelNote: z.string(),
  /** Dine-in: the table it was for; "" = none. */
  tableName: z.string(),
  events: z.array(z.object({ status: orderStatusSchema, actor: z.enum(["buyer", "merchant", "system"]), at: z.string() })),
  dispatches: z.array(
    z.object({
      route: dispatchRouteSchema,
      driverName: z.string(),
      driverPhone: z.string(),
      busCompany: z.string(),
      ticketNumber: z.string(),
      dispatchedAt: z.string(),
      pickedUpAt: z.string().nullable(),
      deliveredAt: z.string().nullable(),
      failedAt: z.string().nullable(),
    }),
  ),
  /** What the seller may do now (packages/shared getSellerActions), the main step first. */
  actions: z.array(z.enum(SELLER_ORDER_ACTIONS)),
  /** How it must be sent (packages/shared getDispatchRoute). */
  route: dispatchRouteSchema,
});
export type SellerOrderDetail = z.infer<typeof sellerOrderDetailSchema>;

/** GET /orders/:id/invoice (seller) and GET /public/orders/:token/invoice (buyer: phone half hidden). Saved amounts only. */
export const orderInvoiceSchema = z.object({
  order: z.object({
    ...orderFactsShape,
    state: invoiceStateSchema,
    /** In full for the seller; "012 ••• 678" for the buyer. */
    buyerPhone: z.string(),
    /** Cash at the counter: handed over and given back; null otherwise. */
    cashReceivedMinor: z.number().nullable(),
    changeMinor: z.number().nullable(),
    items: z.array(z.object(orderItemShape)),
  }),
  shop: z.object({
    slug: z.string(),
    name: z.string(),
    phone: z.string(),
    address: z.string(),
    logoUrl: z.string().nullable(),
    taxNumber: z.string(),
    invoiceNote: z.string(),
    telegramLink: z.string(),
    facebookLink: z.string(),
  }),
  /** The buyer's order page, for the QR code. */
  orderToken: z.string(),
});
export type OrderInvoice = z.infer<typeof orderInvoiceSchema>;

/** POST /counter/sales: the sale as the server worked it out. */
export const counterSaleResultSchema = z.object({
  id: z.string(),
  orderNumber: z.number(),
  currency: currencySchema,
  totalMinor: z.number(),
  /** Cash: what to hand back; null for the shop's QR. */
  changeMinor: z.number().nullable(),
  created: z.boolean(),
});
export type CounterSaleResult = z.infer<typeof counterSaleResultSchema>;

const counterDaySumsSchema = z.object({ count: z.number(), USD: z.number(), KHR: z.number() });

/** GET /counter/sales/today: today's sales at the counter and their totals (voided ones listed, not counted). */
export const counterDaySchema = z.object({
  sales: z.array(
    z.object({
      id: z.string(),
      orderNumber: z.number(),
      createdAt: z.string(),
      status: orderStatusSchema,
      paymentMethod: orderPaymentMethodSchema,
      currency: currencySchema,
      totalMinor: z.number(),
      buyerName: z.string(),
      lineCount: z.number(),
      voided: z.boolean(),
    }),
  ),
  totals: z.object({ all: counterDaySumsSchema, cash: counterDaySumsSchema, shopQr: counterDaySumsSchema }),
});
export type CounterDay = z.infer<typeof counterDaySchema>;

/** POST /public/track: the order link for a tracking code and phone. */
export const trackedOrderSchema = z.object({ token: z.string() });

/** POST /store/telegram-groups/link and /public/orders/:token/telegram-link: a one-time t.me link (15 minutes). */
export const telegramLinkSchema = z.object({ link: z.string(), expiresAt: z.string() });
export type TelegramLink = z.infer<typeof telegramLinkSchema>;

/** GET /store/telegram-groups. */
export const staffGroupSchema = z.object({ id: z.string(), title: z.string(), createdAt: z.string() });
export type StaffGroup = z.infer<typeof staffGroupSchema>;

/** GET /stores/slug-available. */
export const slugAvailabilitySchema = z.object({ available: z.boolean(), reason: z.enum(["taken", "invalid"]).optional() });
