import type { Prisma, Tx } from "@khmio/db";
import type { DeliverySettings } from "@khmio/shared";
import { readDeliverySettings } from "../delivery/delivery";
import { productInclude, toProductDto, type ProductRow } from "../products/products";

// The buyer's shop page (GET /public/stores/:slug), read inside
// withPublicStore: the database itself shows only the store's public face,
// its visible products and its delivery zones.

export const publicStoreSelect = {
  slug: true,
  name: true,
  businessType: true,
  phone: true,
  area: true,
  description: true,
  logoKey: true,
  defaultCurrency: true,
  usdToKhrRate: true,
  allowCod: true,
  vatPercent: true,
  // The profile's Telegram and Facebook buttons: already public on the buyer's invoice.
  telegramLink: true,
  facebookLink: true,
  // Where the Map button goes; empty = search the pickup address.
  mapUrl: true,
} satisfies Prisma.StoreSelect;
type PublicStoreRow = Prisma.StoreGetPayload<{ select: typeof publicStoreSelect }>;

export interface PublicShopRows {
  store: PublicStoreRow;
  categories: { id: string; nameKm: string; nameEn: string }[];
  products: ProductRow[];
  delivery: { settings: DeliverySettings; configured: boolean };
  /** app_public_store_open(): false while the shop is paused. */
  open: boolean;
}

export async function readPublicShop(tx: Tx, storeId: string): Promise<PublicShopRows> {
  const [openRow] = await tx.$queryRaw<{ open: boolean }[]>`SELECT app_public_store_open() AS open`;
  const [store, categories, products, delivery] = await Promise.all([
    tx.store.findUniqueOrThrow({ where: { id: storeId }, select: publicStoreSelect }),
    tx.category.findMany({ select: { id: true, nameKm: true, nameEn: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    tx.product.findMany({ where: { deletedAt: null, isVisible: true }, include: productInclude, orderBy: { createdAt: "desc" } }),
    readDeliverySettings(tx, storeId),
  ]);
  return { store, categories, products, delivery, open: openRow?.open ?? false };
}

/** What leaves the API for the shop page: never wholesale prices or drivers. */
export function toPublicShop(rows: PublicShopRows, photoUrl: (key: string) => string) {
  const { logoKey, ...store } = rows.store;
  const { zones, pickup, province } = rows.delivery.settings;
  return {
    store: { ...store, logoUrl: logoKey ? photoUrl(logoKey) : null },
    categories: rows.categories,
    // Wholesale prices are never shown to buyers.
    products: rows.products.map((product) => toProductDto(product, photoUrl)),
    // Drivers are hidden from buyers by the database too; only zones, pickup and provinces go out.
    delivery: { zones, pickup, province },
    // Ordering needs delivery saved at least once; which payment methods fit is worked out per checkout
    // (packages/shared getAvailablePaymentMethods). KHQR joins in step 5.
    ordering: { deliveryConfigured: rows.delivery.configured, khqrReady: false },
    // A paused shop: the page shows "temporarily closed" and orders are refused.
    open: rows.open,
  };
}
