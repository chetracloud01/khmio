import { merchantActor, writeAudit, type Prisma, type Tx } from "@khmio/db";
import { canShareShop, offersAnyFulfilment, type DeliverySettings, type ExchangeRateBand, type FormErrorCode, type PlanId, type ShopDetailsSave } from "@khmio/shared";
import type { MerchantStore } from "../merchant/store.guard";
import { storePlan } from "../merchant/plan";

// The seller's own shop (GET/PUT /store and friends), always inside the
// merchant's withContext: the details page (with its location, pickup,
// prices and tax, and what's printed on invoices) and the facts the setup
// checklist and sharing rule need.

export const storeSelect = {
  slug: true,
  name: true,
  businessType: true,
  phone: true,
  area: true,
  description: true,
  logoKey: true,
  usdToKhrRate: true,
  defaultCurrency: true,
  allowCod: true,
  vatPercent: true,
  deliveryConfiguredAt: true,
  linkSharedAt: true,
  taxNumber: true,
  invoiceNote: true,
  telegramLink: true,
  facebookLink: true,
  // "Location and pickup": the pickup address is also the shop address on invoices.
  pickupEnabled: true,
  pickupAddress: true,
  pickupHours: true,
  mapUrl: true,
  paymentQrKey: true,
} satisfies Prisma.StoreSelect;

export interface StoreDetailsRows {
  store: Prisma.StoreGetPayload<{ select: typeof storeSelect }>;
  bakongId: string | null;
  plan: { plan: PlanId; paused: boolean };
  visibleProducts: number;
  productsWithPhoto: number;
  /** Today's USD to KHR band (admin Settings): the rate box's limits. */
  rateBand: ExchangeRateBand;
}

export async function readStoreDetails(tx: Tx, storeId: string, photoUrl: (key: string) => string) {
  const visible = { deletedAt: null, isVisible: true } as const;
  const [store, bakong, plan, visibleProducts, productsWithPhoto, rateBand] = await Promise.all([
    tx.store.findUniqueOrThrow({ where: { id: storeId }, select: storeSelect }),
    tx.storePaymentConfig.findUnique({ where: { storeId_provider: { storeId, provider: "bakong_khqr" } }, select: { bakongAccountId: true } }),
    storePlan(tx, storeId),
    tx.product.count({ where: visible }),
    tx.product.count({ where: { ...visible, photos: { some: {} } } }),
    readRateBand(tx),
  ]);
  return toStoreDetails({ store, bakongId: bakong?.bakongAccountId ?? null, plan, visibleProducts, productsWithPhoto, rateBand }, photoUrl);
}

/** The shop's details, plus what the dashboard needs around them: the plan in force and the setup checklist's facts. */
export function toStoreDetails(rows: StoreDetailsRows, photoUrl: (key: string) => string) {
  const { deliveryConfiguredAt, linkSharedAt, paymentQrKey, ...store } = rows.store;
  const bakongId = rows.bakongId ?? "";
  return {
    ...store,
    paymentQrKey: paymentQrKey || null,
    paymentQrUrl: paymentQrKey ? photoUrl(paymentQrKey) : null,
    rateBand: rows.rateBand,
    logoUrl: store.logoKey ? photoUrl(store.logoKey) : null,
    bakongId,
    plan: rows.plan.plan,
    paused: rows.plan.paused,
    // The facts packages/shared shop-readiness.ts asks for.
    readiness: {
      visibleProducts: rows.visibleProducts,
      productsWithPhoto: rows.productsWithPhoto,
      deliveryConfigured: deliveryConfiguredAt !== null,
      khqrReady: bakongId !== "",
      codEnabled: store.allowCod,
    },
    /** The last checklist step: the seller shared (copied or sent) the shop link. */
    linkShared: linkSharedAt !== null,
  };
}
export type StoreDetailsDto = ReturnType<typeof toStoreDetails>;

/** The sharing rule (packages/shared canShareShop) on the details the dashboard shows. */
export const isReadyToShare = (details: StoreDetailsDto) => canShareShop({ businessType: details.businessType, shopPhone: details.phone, ...details.readiness });

/** What once was the Store settings page: currency, rate, cash on delivery, VAT. */
const storeSettingsSelect = { defaultCurrency: true, usdToKhrRate: true, allowCod: true, vatPercent: true } satisfies Prisma.StoreSelect;
type StoreSettingsRow = Prisma.StoreGetPayload<{ select: typeof storeSettingsSelect }>;

/**
 * Pickup can't be switched off when it's the only way a buyer gets an order
 * (packages/shared offersAnyFulfilment). Until delivery is first saved the
 * shop isn't taking orders, so the details page is free to save either way.
 */
export function pickupSwitchProblem(delivery: { settings: DeliverySettings; configured: boolean }, pickupEnabled: boolean): FormErrorCode | undefined {
  if (!delivery.configured) return undefined;
  return offersAnyFulfilment({ ...delivery.settings, pickup: { enabled: pickupEnabled } }) ? undefined : "delivery_required";
}

/**
 * Saves the details page in one go: the shop, its location and pickup, and
 * "On your invoices". A Bakong ID is optional: clearing it turns KHQR off;
 * cash on delivery still works.
 */
export async function saveStoreDetails(tx: Tx, context: MerchantStore, input: ShopDetailsSave): Promise<void> {
  const before = await tx.store.findUniqueOrThrow({ where: { id: context.storeId }, select: storeSettingsSelect });
  await tx.store.update({
    where: { id: context.storeId },
    data: {
      name: input.shopName,
      businessType: input.businessType,
      phone: input.phone,
      area: input.area,
      description: input.description,
      logoKey: input.logoKey,
      paymentQrKey: input.paymentQrKey ?? "",
      pickupAddress: input.address,
      mapUrl: input.mapUrl,
      pickupEnabled: input.pickupEnabled,
      pickupHours: input.pickupHours,
      taxNumber: input.taxNumber,
      invoiceNote: input.invoiceNote,
      telegramLink: input.telegramLink,
      facebookLink: input.facebookLink,
      defaultCurrency: input.defaultCurrency,
      usdToKhrRate: input.usdToKhrRate,
      allowCod: input.allowCod,
      vatPercent: input.vatPercent,
    },
  });
  const bakong = { bakongAccountId: input.bakongId || null, enabled: input.bakongId !== "" };
  await tx.storePaymentConfig.upsert({
    where: { storeId_provider: { storeId: context.storeId, provider: "bakong_khqr" } },
    create: { storeId: context.storeId, provider: "bakong_khqr", ...bakong },
    update: bakong,
  });
  await writeAudit(tx, merchantActor(context), { action: "store.details_saved", entity: "store", entityId: context.storeId });
  // The rate and VAT change what buyers pay, so the admin's log keeps them as their own entry.
  if (storeSettingsChanged(before, input)) {
    await writeAudit(tx, merchantActor(context), { action: "store.settings_saved", entity: "store", entityId: context.storeId });
  }
}

/** Whether any of currency, rate, cash on delivery or VAT changed. */
export function storeSettingsChanged(before: StoreSettingsRow, input: StoreSettingsRow): boolean {
  return (
    before.defaultCurrency !== input.defaultCurrency ||
    before.usdToKhrRate !== input.usdToKhrRate ||
    before.allowCod !== input.allowCod ||
    before.vatPercent !== input.vatPercent
  );
}

/** The USD to KHR band the platform allows today (admin Settings). */
export async function readRateBand(tx: Tx): Promise<{ min: number; max: number }> {
  const platform = await tx.platformSettings.findUniqueOrThrow({ where: { id: 1 }, select: { usdToKhrMin: true, usdToKhrMax: true } });
  return { min: platform.usdToKhrMin, max: platform.usdToKhrMax };
}

/** The checklist's last step: the link was shared. Kept from the first time only. */
export async function markLinkShared(tx: Tx, storeId: string): Promise<void> {
  await tx.store.updateMany({ where: { id: storeId, linkSharedAt: null }, data: { linkSharedAt: new Date() } });
}
