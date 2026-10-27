import type { AppDb, Prisma, Tx } from "@khmio/db";
import { canBuyerCancel, formatTrackingCode } from "@khmio/shared";
import { invoiceOrderSelect, invoiceStoreSelect, toInvoice } from "../orders/invoice";

// The buyer's own order, reached by its link alone (no login), read and
// written inside withPublicOrder: the database shows only that one order.

export const publicOrderSelect = {
  orderNumber: true,
  channel: true,
  trackingCode: true,
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
  pickupAddress: true,
  pickupHours: true,
  buyerName: true,
  cancelReason: true,
  createdAt: true,
  items: {
    // variantId: "Order again" puts the same options back in the buyer's cart.
    select: { variantId: true, titleKm: true, titleEn: true, variantLabelKm: true, variantLabelEn: true, unitPriceMinor: true, quantity: true, lineTotalMinor: true },
    orderBy: { createdAt: "asc" },
  },
  events: { select: { status: true, at: true }, orderBy: { at: "asc" } },
  // How it was sent: the driver's name or the bus ticket — the driver's phone stays with the shop.
  dispatches: { select: { route: true, driverName: true, busCompany: true, ticketNumber: true, dispatchedAt: true }, orderBy: { dispatchedAt: "desc" }, take: 1 },
  // The KHQR code still waiting to be paid: the order page shows it with its countdown.
  paymentAttempts: { where: { status: "pending" }, select: { providerRef: true, qrPayload: true, amountMinor: true, currency: true, expiresAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.OrderSelect;
type PublicOrderRow = Prisma.OrderGetPayload<{ select: typeof publicOrderSelect }>;

const publicOrderStoreSelect = { slug: true, name: true, phone: true, logoKey: true } satisfies Prisma.StoreSelect;
type PublicOrderStoreRow = Prisma.StoreGetPayload<{ select: typeof publicOrderStoreSelect }>;

/**
 * The order page, or null when this link's order isn't there.
 * testBank: KHQR runs on the stand-in bank (KHQR_PROVIDER=fake), so the page offers "pay (test)".
 */
export async function readPublicOrder(tx: Tx, storeId: string, photoUrl: (key: string) => string, testBank: boolean) {
  const [order, store, followers] = await Promise.all([
    tx.order.findFirst({ select: publicOrderSelect }),
    tx.store.findUniqueOrThrow({ where: { id: storeId }, select: publicOrderStoreSelect }),
    // Whether this order is followed on Telegram (the database shows only this order's followers).
    tx.orderFollower.count({ where: { stoppedAt: null } }),
  ]);
  return order ? toPublicOrder(order, store, followers, photoUrl, testBank) : null;
}

/** The order page's data. The buyer's phone stays off it: the link may be forwarded. */
export function toPublicOrder(order: PublicOrderRow, store: PublicOrderStoreRow, followers: number, photoUrl: (key: string) => string, testBank: boolean) {
  const { logoKey, ...shop } = store;
  const { dispatches, trackingCode, paymentAttempts, ...rest } = order;
  const attempt = order.status === "awaiting_payment" ? paymentAttempts[0] : undefined;
  return {
    ...rest,
    trackingCode: formatTrackingCode(store.slug, trackingCode),
    dispatch: dispatches[0] ?? null,
    /** The KHQR to pay while the order waits for it; null otherwise. testBankRef: what "pay (test)" pays at the stand-in bank. */
    payment: attempt
      ? {
          qrPayload: attempt.qrPayload,
          amountMinor: attempt.amountMinor,
          currency: attempt.currency,
          expiresAt: attempt.expiresAt.toISOString(),
          testBankRef: testBank ? attempt.providerRef : null,
        }
      : null,
    canCancel: canBuyerCancel(order),
    followingOnTelegram: followers > 0,
    store: { ...shop, logoUrl: logoKey ? photoUrl(logoKey) : null },
  };
}

/** The buyer's invoice / receipt (design/screens.md B7): their phone half hidden. */
export async function readPublicInvoice(tx: Tx, storeId: string, photoUrl: (key: string) => string) {
  const order = await tx.order.findFirst({ select: invoiceOrderSelect });
  if (!order) return null;
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: invoiceStoreSelect });
  return toInvoice(order, store, photoUrl, "buyer");
}

/** "Track my order": the link for a tracking code and the phone it was placed with, or null for any wrong pair. */
export async function orderTokenByTracking(db: AppDb, code: string, phone: string): Promise<string | null> {
  const [row] = await db.$queryRaw<{ token: string | null }[]>`SELECT app_order_token_by_tracking(${code}, ${phone}) AS token`;
  return row?.token ?? null;
}

/** Saves a one-time "follow on Telegram" code for this order; false when the order isn't there. */
export async function addFollowCode(tx: Tx, storeId: string, codeHash: string, expiresAt: Date): Promise<boolean> {
  const order = await tx.order.findFirst({ select: { id: true } });
  if (!order) return false;
  // createMany: the buyer may write the code but never read codes back.
  await tx.telegramLinkCode.createMany({ data: [{ kind: "order_follow", codeHash, storeId, orderId: order.id, expiresAt }] });
  return true;
}

export type BuyerCancelOutcome = "missing" | "refused" | "cancelled";

/** The buyer cancels their own order — only while no money has moved and nothing is packed (canBuyerCancel). */
export async function cancelAsBuyer(tx: Tx): Promise<BuyerCancelOutcome> {
  const order = await tx.order.findFirst({ select: { status: true, paymentMethod: true, fulfilment: true, area: true } });
  if (!order) return "missing";
  if (!canBuyerCancel(order)) return "refused";
  // The database function cancels only from the status read here, records the history and tells the seller.
  const [row] = await tx.$queryRaw<{ cancelled: boolean }[]>`SELECT app_buyer_cancel_order(${order.status}::"OrderStatus") AS cancelled`;
  return row?.cancelled ? "cancelled" : "refused";
}
