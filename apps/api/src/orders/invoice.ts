import type { Prisma } from "@khmio/db";
import { formatTrackingCode, getInvoiceState, maskKhmerPhone } from "@khmio/shared";

// The invoice / receipt (design/screens.md B7), for the seller (GET
// /orders/:id/invoice) and the buyer (GET /public/orders/:token/invoice) from
// one place, so the two can't drift apart. Every amount is the order's saved
// amount — an invoice never recalculates a price.

export const invoiceOrderSelect = {
  orderNumber: true,
  trackingCode: true,
  publicToken: true,
  status: true,
  paymentMethod: true,
  currency: true,
  subtotalMinor: true,
  discountMinor: true,
  deliveryFeeMinor: true,
  vatPercent: true,
  vatMinor: true,
  totalMinor: true,
  exchangeRateUsed: true,
  fulfilment: true,
  area: true,
  districtId: true,
  provinceId: true,
  landmark: true,
  buyerName: true,
  buyerPhone: true,
  createdAt: true,
  items: {
    select: { titleKm: true, titleEn: true, variantLabelKm: true, variantLabelEn: true, unitPriceMinor: true, quantity: true, lineTotalMinor: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.OrderSelect;

export const invoiceStoreSelect = {
  slug: true,
  name: true,
  phone: true,
  logoKey: true,
  pickupAddress: true,
  taxNumber: true,
  invoiceNote: true,
  telegramLink: true,
  facebookLink: true,
} satisfies Prisma.StoreSelect;

type InvoiceOrderRow = Prisma.OrderGetPayload<{ select: typeof invoiceOrderSelect }>;
type InvoiceStoreRow = Prisma.StoreGetPayload<{ select: typeof invoiceStoreSelect }>;

/**
 * `viewer` decides the buyer's phone: in full for the seller, with its middle
 * hidden for the buyer, whose link may be forwarded (the order page never
 * shows it at all).
 */
export function toInvoice(order: InvoiceOrderRow, store: InvoiceStoreRow, publicUrl: (key: string) => string, viewer: "seller" | "buyer") {
  const { publicToken, trackingCode, buyerPhone, ...rest } = order;
  const { logoKey, slug, pickupAddress, ...shop } = store;
  return {
    order: {
      ...rest,
      trackingCode: formatTrackingCode(slug, trackingCode),
      buyerPhone: viewer === "seller" ? buyerPhone : maskKhmerPhone(buyerPhone),
      state: getInvoiceState(order),
    },
    shop: { ...shop, slug, address: pickupAddress, logoUrl: logoKey ? publicUrl(logoKey) : null },
    /** For the QR code: the buyer's order page. */
    orderToken: publicToken,
  };
}

export type InvoiceDto = ReturnType<typeof toInvoice>;
