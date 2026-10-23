"use client";

import {
  formatKhr,
  formatUsd,
  PHNOM_PENH_DISTRICTS,
  placeName,
  PROVINCES,
  type Currency,
  type DeliveryArea,
  type DispatchRoute,
  type Fulfilment,
  type OrderAction,
  type OrderStatus,
  type OrderTab,
  type PaymentMethod,
} from "@khmio/shared";
import { cn, StatusPill, type Tone } from "@khmio/ui";
import {
  AlertTriangle,
  BellRing,
  CircleCheckBig,
  HandCoins,
  Hourglass,
  PackageOpen,
  PackageX,
  Store,
  ThumbsUp,
  Truck,
  UserRoundSearch,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useDateText } from "./use-date-text";

// One wording and one colour per order status, for the buyer's order page,
// the seller's dashboard and (later) Telegram — design/design-standard.md §7.

/** The parts of an order these helpers read; the mockup's sample orders and the API's orders both fit. */
export interface OrderFactsForText {
  status: OrderStatus;
  fulfilment: Fulfilment;
  paymentMethod: PaymentMethod;
  area: DeliveryArea;
  districtId?: string | null;
  provinceId?: string | null;
}

/**
 * Each status's colour role (design/design-standard.md §7): waiting = warning,
 * being prepared = info, on its way = brand, done = success, stopped = danger.
 */
export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  awaiting_payment: "warning",
  paid: "success",
  cod_pending: "warning",
  confirmed: "info",
  packing: "info",
  waiting_for_driver: "brand",
  out_for_delivery: "brand",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
  failed_delivery: "danger",
};

/** One icon per status, the same everywhere (design/design-standard.md §7). */
export const ORDER_STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  awaiting_payment: Hourglass,
  paid: BellRing,
  cod_pending: BellRing,
  confirmed: ThumbsUp,
  packing: PackageOpen,
  waiting_for_driver: UserRoundSearch,
  out_for_delivery: Truck,
  delivered: HandCoins,
  completed: CircleCheckBig,
  cancelled: XCircle,
  failed_delivery: PackageX,
};

/** The status's icon; a pickup order "out for delivery" is waiting at the shop. */
export function orderStatusIcon(order: { status: OrderStatus; fulfilment?: Fulfilment }): LucideIcon {
  if (order.status === "out_for_delivery" && order.fulfilment === "pickup") return Store;
  if (order.status === "delivered" && order.fulfilment === "pickup") return HandCoins;
  return ORDER_STATUS_ICON[order.status];
}

/** The orders list's steps (its tabs and status groups), in the order work happens. */
export const ORDER_TAB_ICON: Record<OrderTab, LucideIcon> = {
  to_confirm: BellRing,
  packing: PackageOpen,
  sending: Truck,
  delivered: CircleCheckBig,
  problems: AlertTriangle,
  awaiting: Hourglass,
};
export const ORDER_TAB_TONE: Record<OrderTab, Tone> = {
  to_confirm: "warning",
  packing: "info",
  sending: "brand",
  delivered: "success",
  problems: "danger",
  awaiting: "muted",
};
/** Text colour per tone, for icons and headers on a plain background. */
export const TONE_TEXT: Record<Tone, string> = {
  brand: "text-brand",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  muted: "text-muted",
};

export function formatMoney(amount: number, currency: Currency): string {
  return currency === "USD" ? formatUsd(amount) : formatKhr(amount);
}

/** Translated texts that depend on an order. */
export function useOrderText() {
  const t = useTranslations("Orders");
  const tCheckout = useTranslations("Checkout");
  const { timeAgo, clockTime } = useDateText();
  const locale = useLocale();

  /** A pickup order is never "out for delivery": at that point it's waiting at the shop. */
  function statusLabel(order: Pick<OrderFactsForText, "status" | "fulfilment">): string {
    if (order.status === "out_for_delivery" && order.fulfilment === "pickup") return t("status_ready_for_pickup");
    if (order.status === "failed_delivery" && order.fulfilment === "pickup") return t("status_not_collected");
    return t(`status_${order.status}`);
  }

  /** A seller's button. Pass the route to name how the order is sent ("Send to driver"); without it, "Send order". */
  function actionLabel(order: Pick<OrderFactsForText, "fulfilment">, action: OrderAction, route?: DispatchRoute): string {
    const pickup = order.fulfilment === "pickup";
    if (action === "dispatch") return pickup ? t("action_dispatch_pickup") : route ? t(`action_dispatch_${route}`) : t("action_dispatch");
    if (action === "mark_delivered" && pickup) return t("action_handed_over");
    if (action === "fail_delivery" && pickup) return t("action_fail_pickup");
    if (action === "rebook" && pickup) return t("action_rebook_pickup");
    return t(`action_${action}`);
  }

  function paymentLabel(order: Pick<OrderFactsForText, "paymentMethod" | "status" | "fulfilment">): string {
    if (order.paymentMethod === "cod") return order.fulfilment === "pickup" ? t("payAtPickup") : t("payCod");
    return order.status === "awaiting_payment" ? t("payOnlinePending") : t("payOnlinePaid");
  }

  /** "Daun Penh, Phnom Penh", "Kampot", or "Pickup". */
  function placeLabel(order: Pick<OrderFactsForText, "fulfilment" | "area" | "districtId" | "provinceId">): string {
    if (order.fulfilment === "pickup") return tCheckout("pickup");
    const district = PHNOM_PENH_DISTRICTS.find((place) => place.id === order.districtId);
    if (district) return `${placeName(district, locale)}, ${tCheckout("phnomPenh")}`;
    const province = PROVINCES.find((place) => place.id === order.provinceId);
    if (province) return placeName(province, locale);
    return order.area === "phnom_penh" ? tCheckout("phnomPenh") : tCheckout("otherProvince");
  }

  return { statusLabel, actionLabel, paymentLabel, placeLabel, timeAgo, clockTime };
}

export function OrderStatusPill({ order, className }: { order: Pick<OrderFactsForText, "status" | "fulfilment">; className?: string }) {
  const { statusLabel } = useOrderText();
  const Icon = orderStatusIcon(order);
  return (
    <StatusPill tone={ORDER_STATUS_TONE[order.status]} className={cn("items-center gap-1", className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {statusLabel(order)}
    </StatusPill>
  );
}
