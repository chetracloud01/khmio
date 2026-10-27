import { randomBytes } from "node:crypto";
import { asOrderBuyer, Prisma, withPublicStore, type AppDb, type Tx } from "@khmio/db";
import type { PaymentProvider } from "@khmio/payments";
import {
  checkoutInputSchema,
  computeOrderTotal,
  bookingProblem,
  getAvailablePaymentMethods,
  getInitialOrderStatus,
  getOrderQuote,
  placeOrderRequestSchema,
  takesStockWhenPlaced,
  hasModule,
  toFieldErrors,
  type CheckoutInput,
  type FormErrorCode,
  type PlaceOrderRequest,
} from "@khmio/shared";
import { readDeliverySettings } from "../delivery/delivery";
import { AppException, InvalidInputException } from "../errors";
import { orderItemRows, orderTotalLines, readOrderLines } from "./order-lines";
import { publicKhqrAccount, startKhqrPayment } from "../payments/khqr";
import { publicStorePlan, reserveOrderStock, takeOrderStock, tracksStock } from "../stock/stock";

// Placing an order (roadmap step 4), as the buyer of one shop — no login.
// The API recalculates every amount from the database; it never trusts a
// total from the browser. The same checkout key twice gives back the same
// order. Cash on delivery, or KHQR when it's on (KHQR_PROVIDER) and the shop
// set its Bakong account: the order then waits for payment with its stock held.

export interface PlacedOrder {
  token: string;
  orderNumber: number;
  /** false = this checkout key had already placed the order; this is it again. */
  created: boolean;
}

/** The buyer's order link: 32 random characters, never the order number. */
export function newOrderToken(): string {
  return randomBytes(24).toString("base64url");
}

export const ORDER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

/** Checks the request's shape; the checkout form is checked later, with the store's own settings. */
export function parsePlaceOrder(body: unknown): PlaceOrderRequest {
  const result = placeOrderRequestSchema.safeParse(body);
  if (!result.success) throw new InvalidInputException(toFieldErrors(result.error));
  return result.data;
}

/** Places the order, or returns null when no shop has this link. */
export async function placeOrder(db: AppDb, slug: string, request: PlaceOrderRequest, khqr: PaymentProvider | null): Promise<PlacedOrder | null> {
  try {
    return await withPublicStore(db, slug, (tx, storeId) => placeInStore(tx, storeId, request, khqr));
  } catch (error) {
    // Two copies of the same checkout arrived together and the other one won: answer with its order.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const again = await withPublicStore(db, slug, (tx) => findByKey(tx, request.idempotencyKey));
      if (again) return again;
    }
    throw error;
  }
}

async function findByKey(tx: Tx, key: string): Promise<PlacedOrder | null> {
  const [row] = await tx.$queryRaw<{ token: string | null }[]>`SELECT app_order_token_by_key(${key}::uuid) AS token`;
  if (!row?.token) return null;
  await asOrderBuyer(tx, row.token);
  const order = await tx.order.findFirst({ select: { orderNumber: true } });
  return order ? { token: row.token, orderNumber: order.orderNumber, created: false } : null;
}

async function placeInStore(tx: Tx, storeId: string, request: PlaceOrderRequest, khqr: PaymentProvider | null): Promise<PlacedOrder> {
  const existing = await findByKey(tx, request.idempotencyKey);
  if (existing) return existing;

  const store = await tx.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { allowCod: true, usdToKhrRate: true, vatPercent: true, pickupAddress: true, pickupHours: true, modules: true },
  });
  // A paused shop keeps its page but takes no orders (blueprint "Subscription life cycle").
  const [openRow] = await tx.$queryRaw<{ open: boolean }[]>`SELECT app_public_store_open() AS open`;
  if (!openRow?.open) throw new AppException(409, "store_closed");
  const { settings: delivery, configured } = await readDeliverySettings(tx, storeId);
  const bakongAccountId = await publicKhqrAccount(tx, khqr);
  // The buyer can only see visible, not-deleted products (step 3 public read), so anything else is simply missing.
  const lines = await readOrderLines(tx, request.lines, hasModule(store.modules, "choices"));
  // Only services (Features › services): a booking, done at the shop or at the buyer's place.
  const serviceOnly = hasModule(store.modules, "services") && lines.serviceOnly;
  // No delivery saved (a booking needs none), or no way at all to pay (cash off, and no KHQR): the shop isn't open for orders.
  if ((!configured && !serviceOnly) || (!store.allowCod && !bakongAccountId)) throw new AppException(409, "not_accepting_orders");

  const checkout = parseCheckout(request.checkout, store.allowCod);
  const errors: Record<string, FormErrorCode> = {};

  const methods = getAvailablePaymentMethods({
    khqrReady: bakongAccountId !== null,
    payWayReady: false,
    storeAllowsCod: store.allowCod,
    area: checkout.area,
    fulfilment: checkout.fulfilment,
  });
  if (methods.length === 0) throw new AppException(409, "not_accepting_orders");
  if (!methods.includes(checkout.paymentMethod)) errors.paymentMethod = "payment_unavailable";

  const choice = {
    fulfilment: checkout.fulfilment,
    area: checkout.area,
    districtId: checkout.fulfilment === "delivery" && checkout.area === "phnom_penh" ? checkout.districtId : undefined,
    provinceId: checkout.fulfilment === "delivery" && checkout.area === "province" ? checkout.provinceId : undefined,
  };
  const quote = getOrderQuote(delivery, choice, serviceOnly);
  if (quote.status !== "ok") {
    errors[checkout.fulfilment === "pickup" ? "fulfilment" : checkout.area === "province" ? "provinceId" : "districtId"] = "delivery_unavailable";
  }
  const booking = serviceOnly ? bookingProblem(checkout.preferredAt, new Date()) : null;
  if (booking) errors.preferredAt = booking;
  Object.assign(errors, lines.errors);
  if (Object.keys(errors).length > 0) throw new InvalidInputException(errors);

  const total = computeOrderTotal({
    lines: orderTotalLines(request.lines, lines),
    currency: checkout.currency,
    usdToKhrRate: store.usdToKhrRate,
    vatPercent: store.vatPercent,
    deliveryFee: quote.status === "ok" ? quote.fee : null,
  });

  const token = newOrderToken();
  await asOrderBuyer(tx, token);
  const [customer] = await tx.$queryRaw<{ id: string }[]>`
    SELECT app_save_customer(${checkout.phone}, ${checkout.name}, ${checkout.area}::"DeliveryArea",
      ${choice.districtId ?? null}, ${choice.provinceId ?? null}, ${checkout.landmark}) AS id`;
  const [number] = await tx.$queryRaw<{ n: number }[]>`SELECT app_next_order_number() AS n`;
  const status = getInitialOrderStatus(checkout.paymentMethod);
  const order = await tx.order.create({
    data: {
      storeId,
      customerId: customer!.id,
      orderNumber: number!.n,
      publicToken: token,
      status,
      paymentMethod: checkout.paymentMethod,
      currency: checkout.currency,
      subtotalMinor: total.subtotal,
      discountMinor: total.discount,
      deliveryFeeMinor: total.deliveryFee,
      vatPercent: store.vatPercent,
      vatMinor: total.vat,
      totalMinor: total.total,
      exchangeRateUsed: store.usdToKhrRate,
      fulfilment: checkout.fulfilment,
      area: checkout.area,
      districtId: choice.districtId ?? null,
      provinceId: choice.provinceId ?? null,
      landmark: checkout.landmark,
      pickupAddress: checkout.fulfilment === "pickup" ? store.pickupAddress : "",
      pickupHours: checkout.fulfilment === "pickup" ? store.pickupHours : "",
      buyerName: checkout.name,
      buyerPhone: checkout.phone,
      preferredAt: serviceOnly && checkout.preferredAt ? new Date(checkout.preferredAt) : null,
      idempotencyKey: request.idempotencyKey,
    },
    select: { id: true, orderNumber: true },
  });
  await tx.orderItem.createMany({ data: orderItemRows(storeId, order.id, total, lines, { currency: checkout.currency, usdToKhrRate: store.usdToKhrRate }) });
  // Pro and Advance: a cash order takes its stock now, a KHQR order holds it until paid;
  // too little left refuses the whole order (docs/blueprint.md "Stock").
  if (tracksStock(await publicStorePlan(tx))) {
    const lineVariantIds = request.lines.map((line) => line.variantId);
    if (takesStockWhenPlaced(checkout.paymentMethod)) await takeOrderStock(tx, order.id, lineVariantIds);
    else await reserveOrderStock(tx, order.id, lineVariantIds);
  }
  if (checkout.paymentMethod === "khqr" && khqr && bakongAccountId) {
    await startKhqrPayment(tx, khqr, { storeId, orderId: order.id, amountMinor: total.total, currency: checkout.currency, bakongAccountId });
  }
  await tx.orderStatusEvent.createMany({ data: [{ storeId, orderId: order.id, status, actor: "buyer" }] });
  // The seller's Telegram alert, sent by the worker — written with the order, so it can't be lost or sent for an order that failed.
  // A KHQR order alerts the seller once it's paid (the worker), not before: until then there's nothing to do.
  if (checkout.paymentMethod === "cod") await tx.outboxEvent.createMany({ data: [{ storeId, kind: "order_placed", payload: { orderId: order.id } }] });
  return { token, orderNumber: order.orderNumber, created: true };
}

/** The buyer's form, checked with the store's own cash-on-delivery setting added. Field names come back as the form's own. */
function parseCheckout(form: Record<string, unknown>, storeAllowsCod: boolean): CheckoutInput {
  const result = checkoutInputSchema.safeParse({ ...form, storeAllowsCod });
  if (!result.success) throw new InvalidInputException(toFieldErrors(result.error));
  return result.data;
}
