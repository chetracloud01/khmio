"use client";

import { getDispatchRoute, getSellerActions, type OrderActionRequest, type SellerOrderAction } from "@khmio/shared";
import { Button } from "@khmio/ui";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useOrderText } from "@/components/order-ui";
import { api, ApiError, type SellerOrder } from "@/lib/api";
import { useMerchant } from "./merchant-context";

/**
 * Steps that need nothing more than one tap. Sending by driver or bus and
 * cancelling ask for details, so they open the order; a pickup order is "sent"
 * by marking it ready, which needs nothing more (isOneTap).
 */
const ONE_TAP: readonly SellerOrderAction[] = ["confirm", "start_packing", "driver_picked_up", "mark_delivered", "settle_cash", "rebook"];

/** Whether this step happens with one tap from the list. */
function isOneTap(order: SellerOrder, action: SellerOrderAction): boolean {
  return ONE_TAP.includes(action) || (action === "dispatch" && getDispatchRoute(order) === "pickup");
}

/** The order's next step, or null when there's nothing to do but look. */
export function nextAction(order: SellerOrder): SellerOrderAction | null {
  const action = getSellerActions(order)[0];
  return action && action !== "cancel" ? (action as SellerOrderAction) : null;
}

/**
 * An order's one next step, for the Orders list and the home page: a button
 * when it's one tap, otherwise a link into the order. `onDone` reloads the
 * list after a step; `onProblem` shows why one didn't happen.
 */
export function OrderNextStep({
  order,
  fullWidth = false,
  onDone,
  onProblem,
}: {
  order: SellerOrder;
  fullWidth?: boolean;
  onDone: () => void;
  onProblem: (message: string | null) => void;
}) {
  const t = useTranslations("Orders");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const { actionLabel } = useOrderText();
  const { refreshSummary } = useMerchant();
  const [busy, setBusy] = useState(false);
  const action = nextAction(order);

  async function doStep(step: SellerOrderAction) {
    setBusy(true);
    onProblem(null);
    try {
      // "Ready for pickup" is the dispatch step with the pickup route, which carries no details.
      const body: OrderActionRequest = step === "dispatch" ? { action: "dispatch", dispatch: { route: "pickup" } } : ({ action: step } as OrderActionRequest);
      await api(`/orders/${order.id}/actions`, { method: "POST", body });
    } catch (failure) {
      onProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : failure instanceof ApiError && failure.code === "action_not_allowed" ? tApp("orderMovedOn") : tApp("saveFailed"));
    } finally {
      setBusy(false);
      onDone();
      // The Orders badge and the home page's numbers follow at once.
      void refreshSummary();
    }
  }

  if (action && isOneTap(order, action)) {
    return (
      <Button
        variant="primary"
        fullWidth={fullWidth}
        className="whitespace-nowrap px-3 text-sm"
        loading={busy}
        onClick={(event) => {
          event.stopPropagation();
          void doStep(action);
        }}
      >
        {actionLabel(order, action)}
      </Button>
    );
  }
  return (
    <Link
      href={`/${locale}/m/orders/${order.id}`}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex min-h-touch items-center justify-center gap-1 text-sm font-medium text-brand"
    >
      {action ? actionLabel(order, action) : t("view")}
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
