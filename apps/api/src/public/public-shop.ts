import type { Prisma, Tx } from "@khmio/db";
import type { PaymentProvider } from "@khmio/payments";
import type { DeliverySettings } from "@khmio/shared";
import { readDeliverySettings } from "../delivery/delivery";
import { publicKhqrAccount } from "../payments/khqr";
import { productInclude, toProductDto, type ProductRow } from "../products/products";
import { publicStorePlan, readPublicStock } from "../stock/stock";

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
  /** Free stock per tracked option (Pro, Advance); empty on other plans. */
  stock: Record<string, number>;
  /** KHQR is on (KHQR_PROVIDER) and the shop set its Bakong account. */
  khqrReady: boolean;
}

export async function readPublicShop(tx: Tx, storeId: string, khqr: PaymentProvider | null): Promise<PublicShopRows> {
  const [openRow] = await tx.$queryRaw<{ open: boolean }[]>`SELECT app_public_store_open() AS open`;
  const [store, categories, products, delivery] = await Promise.all([
    tx.store.findUniqueOrThrow({ where: { id: storeId }, select: publicStoreSelect }),
    tx.category.findMany({ select: { id: true, nameKm: true, nameEn: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    tx.product.findMany({ where: { deletedAt: null, isVisible: true }, include: productInclude, orderBy: { createdAt: "desc" } }),
    readDeliverySettings(tx, storeId),
  ]);
  const stock = await readPublicStock(tx, storeId, await publicStorePlan(tx));
  const khqrReady = (await publicKhqrAccount(tx, khqr)) !== null;
  return { store, categories, products, delivery, open: openRow?.open ?? false, stock, khqrReady };
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
    ordering: { deliveryConfigured: rows.delivery.configured, khqrReady: rows.khqrReady },
    // A paused shop: the page shows "temporarily closed" and orders are refused.
    open: rows.open,
    // "Sold out" / "Only N left" and the cart's limit, per tracked option; an option not in it sells without a limit.
    stock: rows.stock,
  };
}
