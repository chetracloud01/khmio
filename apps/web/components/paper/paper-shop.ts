import type { StoreDetails } from "@/lib/api";
import type { PaperShop } from "./paper-parts";

/** The seller's own shop as a document's header shows it (the same details as on their invoices). */
export const paperShopOf = (store: StoreDetails): PaperShop => ({
  name: store.name,
  logoUrl: store.logoUrl,
  phone: store.phone,
  address: store.pickupAddress,
  taxNumber: store.taxNumber,
  telegram: store.telegramLink,
  facebook: store.facebookLink,
});
