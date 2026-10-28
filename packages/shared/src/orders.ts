import { z } from "zod";
import type { OrderPaymentMethod, PaymentMethod } from "./checkout";
import type { OrderFulfilment } from "./delivery";
import type { ListSpec } from "./list-query";
import { khmerPhoneSchema } from "./phone";

// The life of an order (docs/blueprint.md "Workflows from start to end", workflow 4). One fixed set
// of statuses, and one place that says which step may follow which — the
// buyer's order page, the seller's dashboard, the API and the Telegram
// messages all read from here.

export const orderStatusSchema = z.enum([
  "awaiting_payment",
  "paid",
  "cod_pending",
  "confirmed",
  "packing",
  "waiting_for_driver",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "failed_delivery",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

/** Orders that don't count as sales (home figures, profit, customers): cancelled, or still waiting for an online payment. */
export const NOT_SALE_STATUSES = ["cancelled", "awaiting_payment"] as const satisfies readonly OrderStatus[];

export function countsAsSale(status: OrderStatus): boolean {
  return !NOT_SALE_STATUSES.some((notSale) => notSale === status);
}

/** What a seller (or the system, for "pay") can do to an order. */
export type OrderAction =
  | "pay"
  | "confirm"
  | "start_packing"
  | "dispatch"
  | "driver_picked_up"
  | "mark_delivered"
  | "settle_cash"
  | "fail_delivery"
  | "rebook"
  | "cancel";

/** The three ways an order leaves the shop (docs/blueprint.md "Workflows from start to end", workflow 3). */
export type DispatchRoute = "driver" | "pickup" | "bus";

/** The parts of an order the rules below need. */
export interface OrderFacts {
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  fulfilment: OrderFulfilment;
  area: "phnom_penh" | "province";
}

export function isCashOrder(order: Pick<OrderFacts, "paymentMethod">): boolean {
  return order.paymentMethod === "cod";
}

/** The status a new order starts in: cash orders go straight to the seller, online ones wait for payment. */
export function getInitialOrderStatus(paymentMethod: PaymentMethod): OrderStatus {
  return paymentMethod === "cod" ? "cod_pending" : "awaiting_payment";
}

/** How this order must be sent: the buyer chose it at checkout, the seller doesn't pick. */
export function getDispatchRoute(order: Pick<OrderFacts, "fulfilment" | "area">): DispatchRoute {
  // Collected at the shop, or handed over at the counter.
  if (order.fulfilment !== "delivery") return "pickup";
  return order.area === "province" ? "bus" : "driver";
}

const CANCELLABLE: readonly OrderStatus[] = ["awaiting_payment", "paid", "cod_pending", "confirmed", "packing", "failed_delivery"];

/** The seller's buttons for an order, the main one first. Empty = nothing left to do. */
export function getSellerActions(order: Pick<OrderFacts, "status">): OrderAction[] {
  switch (order.status) {
    case "awaiting_payment":
      return ["cancel"];
    case "paid":
    case "cod_pending":
      return ["confirm", "cancel"];
    case "confirmed":
      return ["start_packing", "cancel"];
    case "packing":
      return ["dispatch", "cancel"];
    case "waiting_for_driver":
      return ["driver_picked_up", "fail_delivery"];
    case "out_for_delivery":
      return ["mark_delivered", "fail_delivery"];
    case "delivered":
      return ["settle_cash"];
    case "failed_delivery":
      return ["rebook", "cancel"];
    case "completed":
    case "cancelled":
      return [];
  }
}

/**
 * The status after an action, or null if the action isn't allowed now.
 * An order paid online is complete the moment it's delivered; a cash order
 * stays "delivered" until the seller has the cash from the driver.
 */
export function applyOrderAction(order: OrderFacts, action: OrderAction): OrderStatus | null {
  const { status } = order;
  switch (action) {
    case "pay":
      return status === "awaiting_payment" ? "paid" : null;
    case "confirm":
      return status === "paid" || status === "cod_pending" ? "confirmed" : null;
    case "start_packing":
      return status === "confirmed" ? "packing" : null;
    case "dispatch":
      if (status !== "packing") return null;
      // A driver has to come and collect; a bus parcel or a pickup is ready as soon as it's handed over / packed.
      return getDispatchRoute(order) === "driver" ? "waiting_for_driver" : "out_for_delivery";
    case "driver_picked_up":
      return status === "waiting_for_driver" ? "out_for_delivery" : null;
    case "mark_delivered":
      if (status !== "out_for_delivery") return null;
      return isCashOrder(order) ? "delivered" : "completed";
    case "settle_cash":
      return status === "delivered" && isCashOrder(order) ? "completed" : null;
    case "fail_delivery":
      return status === "waiting_for_driver" || status === "out_for_delivery" ? "failed_delivery" : null;
    case "rebook":
      return status === "failed_delivery" ? "packing" : null;
    case "cancel":
      return CANCELLABLE.includes(status) ? "cancelled" : null;
  }
}

/**
 * A buyer can cancel by themselves only while no money has moved and nothing
 * is packed. After paying online they ask the shop (a refund is the shop's call).
 */
export function canBuyerCancel(order: OrderFacts): boolean {
  if (order.status === "awaiting_payment" || order.status === "cod_pending") return true;
  return order.status === "confirmed" && isCashOrder(order);
}

/** The seller's order tabs. "awaiting" (not paid yet) shows under All only — there's nothing for the seller to do. */
export const ORDER_TABS = ["to_confirm", "packing", "sending", "delivered", "problems"] as const;
export type OrderTab = (typeof ORDER_TABS)[number] | "awaiting";

export function getOrderTab(status: OrderStatus): OrderTab {
  switch (status) {
    case "awaiting_payment":
      return "awaiting";
    case "paid":
    case "cod_pending":
      return "to_confirm";
    case "confirmed":
    case "packing":
      return "packing";
    case "waiting_for_driver":
    case "out_for_delivery":
      return "sending";
    case "delivered":
    case "completed":
      return "delivered";
    case "cancelled":
    case "failed_delivery":
      return "problems";
  }
}

/** The statuses under each tab, in the order work happens ("awaiting" last). */
export function orderStatusesForTab(tab: OrderTab): OrderStatus[] {
  return orderStatusSchema.options.filter((status) => getOrderTab(status) === tab);
}

/** The seller's order list read page by page (the data grid's server mode): what it may be searched, filtered and sorted by. */
export const ORDER_LIST_SPEC = {
  sorts: ["order", "buyer", "total", "status"],
  chips: ORDER_TABS,
  filters: { payment: ["online", "cod"], fulfilment: ["delivery", "pickup", "in_store"] },
  defaultSort: { key: "order", dir: "desc" },
} as const satisfies ListSpec;

/** Whether the seller still has to act on it (the dashboard's "needs action" list). */
export function needsSellerAction(status: OrderStatus): boolean {
  return status !== "awaiting_payment" && status !== "completed" && status !== "cancelled";
}

/** The steps a buyer sees, in order. */
export const BUYER_ORDER_STEPS = ["placed", "confirmed", "packing", "sending", "delivered"] as const;
export type BuyerOrderStep = (typeof BUYER_ORDER_STEPS)[number];

/**
 * How far along the buyer's steps an order is (index into BUYER_ORDER_STEPS),
 * or null when it left the normal path (cancelled, failed delivery).
 * "Waiting for driver" is still "packing" to the buyer — nothing changed for them yet.
 */
export function getBuyerProgress(status: OrderStatus): number | null {
  switch (status) {
    case "awaiting_payment":
    case "paid":
    case "cod_pending":
      return 0;
    case "confirmed":
      return 1;
    case "packing":
    case "waiting_for_driver":
      return 2;
    case "out_for_delivery":
      return 3;
    case "delivered":
    case "completed":
      return 4;
    case "cancelled":
    case "failed_delivery":
      return null;
  }
}

/** What the seller fills in when sending an order. Which shape applies comes from getDispatchRoute. */
export const dispatchInputSchema = z.discriminatedUnion("route", [
  z.object({
    route: z.literal("driver"),
    driverName: z.string().trim().min(2, "too_short").max(60, "too_long"),
    driverPhone: khmerPhoneSchema,
  }),
  z.object({
    route: z.literal("bus"),
    busCompany: z.string().trim().min(2, "too_short").max(60, "too_long"),
    ticketNumber: z.string().trim().min(1, "required").max(40, "too_long"),
  }),
  z.object({ route: z.literal("pickup") }),
]);
export type DispatchInput = z.infer<typeof dispatchInputSchema>;

export const orderCancelReasonSchema = z.enum(["payment_timeout", "buyer_cancelled", "out_of_stock", "cannot_deliver", "other", "counter_void"]);

/** Where an order was made: the shop page, or the counter (design/screens.md P1). */
export const orderChannelSchema = z.enum(["online", "in_store"]);
export type OrderChannel = z.infer<typeof orderChannelSchema>;
export type OrderCancelReason = z.infer<typeof orderCancelReasonSchema>;

/** Reasons a seller can pick (the other two are set by the system and the buyer). */
export const SELLER_CANCEL_REASONS: readonly OrderCancelReason[] = ["out_of_stock", "cannot_deliver", "other"];

export const orderCancellationSchema = z
  .object({
    reason: orderCancelReasonSchema,
    /** Shown to the buyer. Required for "other", which says nothing on its own. */
    note: z.string().trim().max(200, "too_long"),
  })
  .refine((cancellation) => cancellation.reason !== "other" || cancellation.note.length >= 3, {
    message: "required",
    path: ["note"],
  });
export type OrderCancellation = z.infer<typeof orderCancellationSchema>;

/** The seller's actions in the dashboard and from a Telegram button ("pay" is the system's, after a confirmed payment). */
export const SELLER_ORDER_ACTIONS = [
  "confirm",
  "start_packing",
  "dispatch",
  "driver_picked_up",
  "mark_delivered",
  "settle_cash",
  "fail_delivery",
  "rebook",
  "cancel",
] as const satisfies readonly OrderAction[];
export type SellerOrderAction = (typeof SELLER_ORDER_ACTIONS)[number];

const sellerOrderActions: readonly string[] = SELLER_ORDER_ACTIONS;
export const isSellerOrderAction = (action: OrderAction): action is SellerOrderAction => sellerOrderActions.includes(action);

/** The steps a request carries nothing else for: no driver, ticket or reason. */
const plainOrderActionSchema = z.enum(["confirm", "start_packing", "driver_picked_up", "mark_delivered", "settle_cash", "fail_delivery", "rebook"]);
export type PlainOrderAction = z.infer<typeof plainOrderActionSchema>;
export const isPlainOrderAction = (action: OrderAction): action is PlainOrderAction => plainOrderActionSchema.safeParse(action).success;

/**
 * What the dashboard sends to move an order on. Sending needs how it went
 * (driver, bus or pickup); cancelling needs a reason the seller may give.
 */
export const orderActionRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: plainOrderActionSchema }),
  z.object({ action: z.literal("dispatch"), dispatch: dispatchInputSchema }),
  z.object({
    action: z.literal("cancel"),
    cancellation: orderCancellationSchema.refine((cancellation) => SELLER_CANCEL_REASONS.includes(cancellation.reason), {
      message: "reason_required",
      path: ["reason"],
    }),
  }),
]);
export type OrderActionRequest = z.infer<typeof orderActionRequestSchema>;

export type OrderActionRefusal =
  /** This step doesn't follow the order's current status. */
  | "not_allowed"
  /** Sent another way than the buyer chose at checkout (getDispatchRoute). */
  | "wrong_route";

/**
 * The status an action leads to, or why it can't happen — the one check the
 * API runs for the dashboard and for Telegram buttons alike.
 */
export function decideOrderAction(order: OrderFacts, request: OrderActionRequest): { status: OrderStatus } | { refused: OrderActionRefusal } {
  if (request.action === "dispatch" && request.dispatch.route !== getDispatchRoute(order)) return { refused: "wrong_route" };
  const status = applyOrderAction(order, request.action);
  return status ? { status } : { refused: "not_allowed" };
}
