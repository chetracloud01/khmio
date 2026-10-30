import {
  businessModuleSchema,
  businessTypeSchema,
  choicePickSchema,
  currencySchema,
  customFieldTargetSchema,
  customFieldTypeSchema,
  deliveryAreaSchema,
  jobCardStatusSchema,
  orderChannelSchema,
  orderFulfilmentSchema,
  orderLineChoicesSchema,
  planIdSchema,
  productKindSchema,
  subscriptionStatusSchema,
} from "@khmio/shared";
import { z } from "zod";

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

/** GET and PUT /store/modules: the shop's switched-on modules. */
export const storeModulesSchema = z.object({ modules: z.array(businessModuleSchema) });

/** GET /store: the shop details page, the plan in force and the setup checklist's facts. */
export const storeDetailsSchema = z.object({
  slug: z.string(),
  name: z.string(),
  businessType: businessTypeSchema,
  /** The shop's switched-on modules (packages/shared business-modules.ts). */
  modules: z.array(businessModuleSchema),
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
  /** The seller's own payment QR for sales at the counter; null = none yet. */
  paymentQrKey: z.string().nullable(),
  paymentQrUrl: z.string().nullable(),
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
  /** With variant groups: one value id per group, in the groups' order. */
  valueIds: z.array(z.string()),
  priceUsdCents: z.number().nullable(),
  priceKhr: z.number().nullable(),
  /** Only on plans with wholesale prices. */
  wholesalePriceUsdCents: z.number().nullish(),
  wholesalePriceKhr: z.number().nullish(),
  /** The seller's own cost (never sent to the shop page); null = not known. */
  costMinor: z.number().nullish(),
  costCurrency: currencySchema.nullish(),
});
export type ProductVariant = z.infer<typeof productVariantSchema>;

const optionValueShape = { id: z.string(), labelKm: z.string(), labelEn: z.string() };

/** Size, Colour…: every variant is one value of each (packages/shared product-options.ts). */
export const variantGroupSchema = z.object({ id: z.string(), nameKm: z.string(), nameEn: z.string(), values: z.array(z.object(optionValueShape)) });
export type VariantGroup = z.infer<typeof variantGroupSchema>;

/** Sugar, Add-ons…: picked when ordering, each value with an optional extra price per unit. */
export const choiceGroupSchema = z.object({
  id: z.string(),
  nameKm: z.string(),
  nameEn: z.string(),
  pick: choicePickSchema,
  required: z.boolean(),
  values: z.array(z.object({ ...optionValueShape, extraUsdCents: z.number().nullable(), extraKhr: z.number().nullable() })),
});
export type ChoiceGroup = z.infer<typeof choiceGroupSchema>;

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
  variantGroups: z.array(variantGroupSchema),
  choiceGroups: z.array(choiceGroupSchema),
  /** The shop's own fields, field id → value (on the shop page: the public ones only). */
  customValues: z.record(z.union([z.string(), z.number(), z.boolean()])),
  /** A service: no stock, nothing to deliver; a cart of only services is a booking. */
  kind: productKindSchema,
});
export type Product = z.infer<typeof productSchema>;

/** One of the shop's own fields (packages/shared custom-fields.ts). */
export const customFieldSchema = z.object({
  id: z.string(),
  target: customFieldTargetSchema,
  type: customFieldTypeSchema,
  labelKm: z.string(),
  labelEn: z.string(),
  options: z.array(z.object({ id: z.string(), labelKm: z.string(), labelEn: z.string() })),
  required: z.boolean(),
  public: z.boolean(),
});
export type CustomField = z.infer<typeof customFieldSchema>;

/** GET and PUT /custom-fields. */
export const customFieldsAnswerSchema = z.object({ fields: z.array(customFieldSchema) });

/** GET and PUT /tables: a restaurant's tables (Features › tables). */
export const dineTablesSchema = z.object({ tables: z.array(z.object({ id: z.string(), name: z.string() })) });
export type DineTable = z.infer<typeof dineTablesSchema>["tables"][number];

/** GET /kitchen (and "Done"): today's orders still to make, oldest first — no prices. */
export const kitchenSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string(),
      orderNumber: z.number(),
      channel: orderChannelSchema,
      fulfilment: orderFulfilmentSchema,
      tableName: z.string(),
      createdAt: z.string(),
      items: z.array(
        z.object({ titleKm: z.string(), titleEn: z.string(), variantLabelKm: z.string(), variantLabelEn: z.string(), quantity: z.number(), choices: orderLineChoicesSchema, note: z.string() }),
      ),
    }),
  ),
});
export type KitchenOrder = z.infer<typeof kitchenSchema>["orders"][number];

/** A garage's car (Features › jobCards). */
export const vehicleSchema = z.object({ id: z.string(), plate: z.string(), makeModel: z.string(), ownerName: z.string(), ownerPhone: z.string() });
export type Vehicle = z.infer<typeof vehicleSchema>;
export const vehiclesSchema = z.object({ vehicles: z.array(vehicleSchema) });

/** One job card: the car, what's wrong, and its parts and labour (each one of the shop's products). */
export const jobCardSchema = z.object({
  id: z.string(),
  number: z.number(),
  status: jobCardStatusSchema,
  complaint: z.string(),
  mileageKm: z.number().nullable(),
  /** The counter sale it was billed with. */
  orderId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  vehicle: vehicleSchema,
  lines: z.array(
    z.object({
      id: z.string(),
      variantId: z.string(),
      quantity: z.number(),
      note: z.string(),
      titleKm: z.string(),
      titleEn: z.string(),
      optionKm: z.string(),
      optionEn: z.string(),
      /** A service product: labour rather than a part. */
      labour: z.boolean(),
    }),
  ),
});
export type JobCard = z.infer<typeof jobCardSchema>;
export const jobCardsSchema = z.object({ jobCards: z.array(jobCardSchema) });
