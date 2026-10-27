import type { Prisma, Tx } from "@khmio/db";
import type { PaymentProvider } from "@khmio/payments";
import { hasModule, type CustomFieldDefinition, type DeliverySettings } from "@khmio/shared";
import { customFieldSelect, toCustomField } from "../custom-fields/custom-fields";
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
  // Which parts the page offers (choices); not sent on.
  modules: true,
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
  /** The shop's own product fields it shows buyers (the database hides the rest). */
  customFields: CustomFieldDefinition[];
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
  const customFields = hasModule(store.modules, "customFields")
    ? (await tx.customFieldDefinition.findMany({ where: { target: "product", public: true }, select: customFieldSelect, orderBy: { sortOrder: "asc" } })).map(toCustomField)
    : [];
  return { store, categories, products, delivery, open: openRow?.open ?? false, stock, khqrReady, customFields };
}

/** What leaves the API for the shop page: never wholesale prices or drivers. */
export function toPublicShop(rows: PublicShopRows, photoUrl: (key: string) => string) {
  const { logoKey, modules, ...store } = rows.store;
  const { zones, pickup, province } = rows.delivery.settings;
  const choicesOn = hasModule(modules, "choices");
  // Services off: the API takes no bookings, so the page treats every product as an item too.
  const servicesOn = hasModule(modules, "services");
  const publicFieldIds = new Set(rows.customFields.map((field) => field.id));
  return {
    store: { ...store, logoUrl: logoKey ? photoUrl(logoKey) : null },
    categories: rows.categories,
    // Wholesale prices are never shown to buyers; choices only while the shop takes them (an order with one would be refused);
    // of the shop's own fields, only the values of the public ones.
    products: rows.products.map((product) => {
      const dto = toProductDto(product, photoUrl);
      const customValues = Object.fromEntries(Object.entries(dto.customValues).filter(([id]) => publicFieldIds.has(id)));
      return { ...dto, choiceGroups: choicesOn ? dto.choiceGroups : [], customValues, kind: servicesOn ? dto.kind : "item" };
    }),
    /** The public fields' names and pick-lists, to show their values. */
    customFields: rows.customFields,
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
