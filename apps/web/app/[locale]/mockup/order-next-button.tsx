"use client";

import { getDispatchRoute, getSellerActions, type OrderAction } from "@khmio/shared";
import { Button } from "@khmio/ui";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import type { OrderRecord } from "@/mock/mock-orders";
import { useOrderText } from "@/components/order-ui";
import { useOrders } from "./orders-context";

/** Actions that need nothing more than one tap. Sending and cancelling ask for details, so they open the order. */
const ONE_TAP: readonly OrderAction[] = ["confirm", "start_packing", "driver_picked_up", "mark_delivered", "settle_cash", "rebook"];

/** The seller's next step for an order, or null when there's nothing to do but look. */
export function getNextAction(order: OrderRecord): OrderAction | null {
  const action = getSellerActions(order)[0];
  return action && action !== "cancel" ? action : null;
}

export function sellerOrderHref(locale: string, orderNumber: string): string {
  return `/${locale}/mockup/dashboard/orders/${encodeURIComponent(orderNumber)}`;
}

/**
 * An order's main button on the orders list and the dashboard home: does the
 * step if it's one tap, otherwise opens the order. Renders nothing when the
 * order has no next step.
 */
export function OrderNextButton({ order, fullWidth = false }: { order: OrderRecord; fullWidth?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const { act } = useOrders();
  const { actionLabel } = useOrderText();
  const action = getNextAction(order);
  if (!action) return null;

  return (
    <Button
      variant="primary"
      className={fullWidth ? "w-full" : "whitespace-nowrap px-3 text-sm"}
      onClick={(event) => {
        // Inside a row that opens the order: this button must not.
        event.stopPropagation();
        if (ONE_TAP.includes(action)) act(order.orderNumber, action);
        // A pickup order is "sent" by marking it ready: nothing to fill in.
        else if (action === "dispatch" && getDispatchRoute(order) === "pickup") act(order.orderNumber, "dispatch", { dispatch: { route: "pickup" } });
        else router.push(sellerOrderHref(locale, order.orderNumber));
      }}
    >
      {actionLabel(order, action)}
    </Button>
  );
}
