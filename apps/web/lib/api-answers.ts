import {
  businessTypeSchema,
  currencySchema,
  deliveryAreaSchema,
  deliverySettingsShape,
  fulfilmentSchema,
  invoiceStateSchema,
  orderCancelReasonSchema,
  orderStatusSchema,
  paymentMethodSchema,
  planIdSchema,
  SELLER_ORDER_ACTIONS,
  subscriptionStatusSchema,
} from "@khmio/shared";
import { z } from "zod";

// What the API answers, read with these schemas by api() in lib/api.ts, so a
// screen never works on a shape it only assumed. They check the shape, not
// the input rules (a save is checked by the form's own schema): an answer
// keeps loading even after a rule is tightened. Extra fields are dropped.

export const meSchema = z.object({
  /** signedInWithTelegram: new-order alerts reach the merchant's own chat with the bot. */
  merchant: z.object({ firstName: z.string(), lastName: z.string(), telegramUsername: z.string().nullable(), signedInWithTelegram: z.boolean() }),
  store: z
    .object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      businessType: businessTypeSchema,
      phone: z.string(),
      subscription: z.object({ plan: planIdSchema, status: subscriptionStatusSchema, trialEndsAt: z.string().nullable() }).nullable(),
    })
    .nullable(),
});
export type Me = z.infer<typeof meSchema>;

export const uploadedPhotoSchema = z.object({
  key: z.string(),
  url: z.string(),
  /** The ~400 px copy for lists; null or missing when there isn't one (PhotoThumb then shows the photo). */
  thumbUrl: z.string().nullish(),
});
export type UploadedPhoto = z.infer<typeof uploadedPhotoSchema>;

export const catalogNameSchema = z.object({ id: z.string(), nameKm: z.string(), nameEn: z.string() });
export type CatalogName = z.infer<typeof catalogNameSchema>;

/** GET /catalog: what the product form picks from. */
export const catalogSchema = z.object({
  categories: z.array(catalogNameSchema),
  brands: z.array(catalogNameSchema),
  units: z.array(catalogNameSchema),
  defaultUnitId: z.string().nullable(),
});
export type Catalog = z.infer<typeof catalogSchema>;

/** GET /store: the shop details page, the plan in force and the setup checklist's facts. */
export const storeDetailsSchema = z.object({
  slug: z.string(),
  name: z.string(),
  businessType: businessTypeSchema,
  phone: z.string(),
  area: deliveryAreaSchema,
  description: z.string(),
  logoKey: z.string().nullable(),
  logoUrl: z.string().nullable(),
  bakongId: z.string(),
  usdToKhrRate: z.number(),
  /** The currency buyers see first; it leads the dashboard's sales numbers. */
  defaultCurrency: currencySchema,
  plan: planIdSchema,
  paused: z.boolean(),
  readiness: z.object({
    visibleProducts: z.number(),
    productsWithPhoto: z.number(),
    deliveryConfigured: z.boolean(),
    khqrReady: z.boolean(),
    codEnabled: z.boolean(),
  }),
  /** The last checklist step: the shop link was shared. */
  linkShared: z.boolean(),
  /** "On your invoices" (saved with the rest of Shop details); empty = not printed. */
  taxNumber: z.string(),
  invoiceNote: z.string(),
  telegramLink: z.string(),
  facebookLink: z.string(),
  /** "Location and pickup": the pickup address is also the shop address on invoices. */
  pickupEnabled: z.boolean(),
  pickupAddress: z.string(),
  pickupHours: z.string(),
  mapUrl: z.string(),
  /** "Getting paid" and "Prices & tax" (once Store settings). */
  allowCod: z.boolean(),
  vatPercent: z.number(),
  /** The USD to KHR band the platform allows today: the rate box's limits. */
  rateBand: z.object({ min: z.number(), max: z.number() }),
});
export type StoreDetails = z.infer<typeof storeDetailsSchema>;

export const productVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  labelKm: z.string(),
  labelEn: z.string(),
  priceUsdCents: z.number().nullable(),
  priceKhr: z.number().nullable(),
  /** Only on plans with wholesale prices. */
  wholesalePriceUsdCents: z.number().nullish(),
  wholesalePriceKhr: z.number().nullish(),
});
export type ProductVariant = z.infer<typeof productVariantSchema>;

/** A product as GET /products and the shop page return it. */
export const productSchema = z.object({
  id: z.string(),
  titleKm: z.string(),
  titleEn: z.string(),
  descriptionKm: z.string(),
  descriptionEn: z.string(),
  categoryId: z.string(),
  brandId: z.string().nullable(),
  unitId: z.string().nullable(),
  discountPercent: z.number().nullable(),
  isVisible: z.boolean(),
  photos: z.array(uploadedPhotoSchema),
  /** false = one hidden default variant carries the price. */
  hasOptions: z.boolean(),
  variants: z.array(productVariantSchema),
});
export type Product = z.infer<typeof productSchema>;

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
  paymentMethod: paymentMethodSchema,
  currency: currencySchema,
  subtotalMinor: z.number(),
  discountMinor: z.number(),
  deliveryFeeMinor: z.number(),
  vatPercent: z.number(),
  vatMinor: z.number(),
  totalMinor: z.number(),
  exchangeRateUsed: z.number(),
  fulfilment: fulfilmentSchema,
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
};

/** What the buyer's order page and the seller's order page both show. */
const orderViewSchema = z.object({
  ...orderFactsShape,
  pickupAddress: z.string(),
  pickupHours: z.string(),
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
  store: z.object({ slug: z.string(), name: z.string(), phone: z.string(), logoUrl: z.string().nullable() }),
});
export type PublicOrder = z.infer<typeof publicOrderSchema>;

const perCurrency = z.object({ USD: z.number(), KHR: z.number() });
const topProductsSchema = z.array(z.object({ nameKm: z.string(), nameEn: z.string(), quantity: z.number(), USD: z.number(), KHR: z.number() }));

/** GET /orders/summary: the seller's home page numbers. Money per currency (cents, riel), never added together; days in Phnom Penh time. */
export const sellerSummarySchema = z.object({
  waiting: z.number(),
  salesToday: perCurrency,
  cashToCollect: perCurrency,
  ordersLast7Days: z.number(),
  ordersPrevious7Days: z.number(),
  /** 60 days, oldest first; orders also counted per currency. */
  days: z.array(z.object({ date: z.string(), orders: z.number(), ordersUSD: z.number(), ordersKHR: z.number(), USD: z.number(), KHR: z.number() })),
  /** Per period, the products that earned the most (main currency first), dollars and riel apart. */
  topProducts: z.object({ today: topProductsSchema, week: topProductsSchema, month: topProductsSchema }),
});
export type SellerSummary = z.infer<typeof sellerSummarySchema>;

/** GET /orders: one row of the seller's order list. */
export const sellerOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.number(),
  /** As printed: MEK-7K4P-9QXR (the list's search finds it). */
  trackingCode: z.string(),
  status: orderStatusSchema,
  paymentMethod: paymentMethodSchema,
  currency: currencySchema,
  totalMinor: z.number(),
  buyerName: z.string(),
  buyerPhone: z.string(),
  fulfilment: fulfilmentSchema,
  area: deliveryAreaSchema,
  districtId: z.string().nullable(),
  provinceId: z.string().nullable(),
  createdAt: z.string(),
  itemCount: z.number(),
});
export type SellerOrder = z.infer<typeof sellerOrderSchema>;

/** GET /orders/:id and POST /orders/:id/actions: one order in full, for the seller. */
export const sellerOrderDetailSchema = orderViewSchema.extend({
  id: z.string(),
  buyerPhone: z.string(),
  cancelNote: z.string(),
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

/** One page of a server-mode list (packages/shared ListPage), rows read with their own schema. */
export const listPageSchema = <Row extends z.ZodTypeAny>(row: Row) =>
  z.object({
    rows: z.array(row),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    chipCounts: z.record(z.number()),
    groupCounts: z.record(z.number()).optional(),
    filterCounts: z.record(z.record(z.number())).optional(),
  });
