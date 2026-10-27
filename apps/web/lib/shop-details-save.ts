import type { ShopDetailsSave } from "@khmio/shared";
import type { StoreDetails } from "./api";

/**
 * PUT /store saves all of Shop details at once (packages/shared
 * shopDetailsSaveSchema): the shop as saved, ready to send with only the
 * changed fields replaced — e.g. onboarding adding a logo.
 */
export function savedShopDetails(store: StoreDetails): ShopDetailsSave {
  return {
    shopName: store.name,
    businessType: store.businessType,
    phone: store.phone,
    area: store.area,
    description: store.description,
    bakongId: store.bakongId,
    logoKey: store.logoKey,
    paymentQrKey: store.paymentQrKey,
    address: store.pickupAddress,
    mapUrl: store.mapUrl,
    pickupEnabled: store.pickupEnabled,
    pickupHours: store.pickupHours,
    defaultCurrency: store.defaultCurrency,
    usdToKhrRate: store.usdToKhrRate,
    allowCod: store.allowCod,
    vatPercent: store.vatPercent,
    taxNumber: store.taxNumber,
    invoiceNote: store.invoiceNote,
    telegramLink: store.telegramLink,
    facebookLink: store.facebookLink,
  };
}
