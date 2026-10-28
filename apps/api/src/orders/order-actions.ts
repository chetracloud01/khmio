import { merchantActor, type Prisma, type Tx, writeAudit } from "@khmio/db";
import { decideOrderAction, formatTrackingCode, getDispatchRoute, getSellerActions, type OrderActionRequest } from "@khmio/shared";
import { NotFoundException } from "@nestjs/common";
import { AppException } from "../errors";
import type { MerchantStore } from "../merchant/store.guard";
import { returnOrderStock } from "../stock/stock";
import { orderItemSelect, toOrderItem } from "./order-lines";

// The seller moving an order on (roadmap step 6). Every change goes through
// packages/shared decideOrderAction — the same rule the screens and the
// Telegram buttons follow — and is written to the order's history, its
// dispatch record and the audit log, all in the seller's own transaction.

export const orderDetailSelect = {
  id: true,
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
  buyerPhone: true,
  // Their page in Customers; empty for a walk-in at the counter who gave no phone.
  customerId: true,
  // A booking: when the buyer would like it done.
  preferredAt: true,
  // Dine-in: the table it was for ("" = none).
  tableName: true,
  cancelReason: true,
  cancelNote: true,
  createdAt: true,
  items: { select: orderItemSelect, orderBy: { createdAt: "asc" } },
  events: { select: { status: true, actor: true, at: true }, orderBy: { at: "asc" } },
  dispatches: {
    select: { route: true, driverName: true, driverPhone: true, busCompany: true, ticketNumber: true, dispatchedAt: true, pickedUpAt: true, deliveredAt: true, failedAt: true },
    orderBy: { dispatchedAt: "desc" },
  },
} satisfies Prisma.OrderSelect;

type OrderDetailRow = Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>;

/** The order as the seller's detail page shows it: with the steps the seller may take now and how it must be sent. */
export function toOrderDetail(order: OrderDetailRow, storeSlug: string) {
  return {
    ...order,
    items: order.items.map(toOrderItem),
    trackingCode: formatTrackingCode(storeSlug, order.trackingCode),
    actions: getSellerActions(order),
    route: getDispatchRoute(order),
  };
}

export async function readOrderDetail(tx: Tx, orderId: string) {
  const order = await tx.order.findFirst({ where: { id: orderId }, select: { ...orderDetailSelect, store: { select: { slug: true } } } });
  if (!order) throw new NotFoundException();
  const { store, ...detail } = order;
  return toOrderDetail(detail, store.slug);
}

export async function runSellerAction(tx: Tx, context: MerchantStore, orderId: string, request: OrderActionRequest) {
  const order = await tx.order.findFirst({ where: { id: orderId }, select: { id: true, status: true, paymentMethod: true, fulfilment: true, area: true } });
  if (!order) throw new NotFoundException();
  const decision = decideOrderAction(order, request);
  if ("refused" in decision) throw new AppException(409, "action_not_allowed");

  // Only from the status the seller saw: a second tap, or the same order moved from Telegram meanwhile, changes nothing.
  const { count } = await tx.order.updateMany({
    where: { id: order.id, status: order.status },
    data: {
      status: decision.status,
      ...(request.action === "cancel" ? { cancelReason: request.cancellation.reason, cancelNote: request.cancellation.note } : {}),
    },
  });
  if (count === 0) throw new AppException(409, "action_not_allowed");
  // A cancelled order's stock goes back on the shelf (nothing happens if it took none).
  if (decision.status === "cancelled") await returnOrderStock(tx, order.id);
  await tx.orderStatusEvent.create({ data: { storeId: context.storeId, orderId: order.id, status: decision.status, actor: "merchant", actorMerchantId: context.merchantId } });
  // Buyers following the order on Telegram hear about it (sent by the worker).
  await tx.outboxEvent.createMany({ data: [{ storeId: context.storeId, kind: "order_status_changed", payload: { orderId: order.id, status: decision.status } }] });

  const now = new Date();
  const latestDispatch = () => tx.deliveryDispatch.findFirst({ where: { orderId: order.id }, orderBy: { dispatchedAt: "desc" }, select: { id: true } });
  if (request.action === "dispatch") {
    const sent = request.dispatch;
    // A driver from the shop's saved list keeps the link to them; anyone else is just their name and phone.
    const savedDriver =
      sent.route === "driver"
        ? await tx.storeDriver.findFirst({ where: { phone: sent.driverPhone }, select: { id: true } })
        : null;
    await tx.deliveryDispatch.create({
      data: {
        storeId: context.storeId,
        orderId: order.id,
        route: sent.route,
        driverId: savedDriver?.id ?? null,
        ...(sent.route === "driver" ? { driverName: sent.driverName, driverPhone: sent.driverPhone } : {}),
        ...(sent.route === "bus" ? { busCompany: sent.busCompany, ticketNumber: sent.ticketNumber } : {}),
      },
    });
  } else if (request.action === "driver_picked_up" || request.action === "mark_delivered" || request.action === "fail_delivery") {
    const dispatch = await latestDispatch();
    const field = request.action === "driver_picked_up" ? "pickedUpAt" : request.action === "mark_delivered" ? "deliveredAt" : "failedAt";
    if (dispatch) await tx.deliveryDispatch.update({ where: { id: dispatch.id }, data: { [field]: now } });
  }

  await writeAudit(tx, merchantActor(context), { action: `order.${request.action}`, entity: "order", entityId: order.id, before: { status: order.status }, after: { status: decision.status } });
  return readOrderDetail(tx, order.id);
}
