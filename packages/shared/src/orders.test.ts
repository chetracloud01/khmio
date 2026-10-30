import { describe, expect, it } from "vitest";
import { toFieldErrors } from "./form-errors";
import {
  applyOrderAction,
  canBuyerCancel,
  countsAsSale,
  dispatchInputSchema,
  getBuyerProgress,
  getDispatchRoute,
  getInitialOrderStatus,
  getOrderTab,
  getSellerActions,
  orderCancellationSchema,
  orderStatusSchema,
  type OrderAction,
  type OrderFacts,
} from "./orders";

const khqrDelivery: OrderFacts = { status: "awaiting_payment", paymentMethod: "khqr", fulfilment: "delivery", area: "phnom_penh" };
const codDelivery: OrderFacts = { ...khqrDelivery, status: "cod_pending", paymentMethod: "cod" };

/** Runs actions in order and returns every status the order passed through. */
function walk(start: OrderFacts, actions: OrderAction[]) {
  const seen = [start.status];
  let order = start;
  for (const action of actions) {
    const next = applyOrderAction(order, action);
    if (!next) throw new Error(`${action} not allowed from ${order.status}`);
    order = { ...order, status: next };
    seen.push(next);
  }
  return seen;
}

describe("order life cycle", () => {
  it("starts cash orders with the seller and online orders waiting for payment", () => {
    expect(getInitialOrderStatus("cod")).toBe("cod_pending");
    expect(getInitialOrderStatus("khqr")).toBe("awaiting_payment");
  });

  it("completes an online order the moment it's delivered", () => {
    expect(walk(khqrDelivery, ["pay", "confirm", "start_packing", "dispatch", "driver_picked_up", "mark_delivered"])).toEqual([
      "awaiting_payment",
      "paid",
      "confirmed",
      "packing",
      "waiting_for_driver",
      "out_for_delivery",
      "completed",
    ]);
  });

  it("keeps a cash order at delivered until the cash is settled", () => {
    expect(walk(codDelivery, ["confirm", "start_packing", "dispatch", "driver_picked_up", "mark_delivered", "settle_cash"])).toEqual([
      "cod_pending",
      "confirmed",
      "packing",
      "waiting_for_driver",
      "out_for_delivery",
      "delivered",
      "completed",
    ]);
  });

  it("skips waiting for a driver on pickup and bus orders", () => {
    const pickup: OrderFacts = { ...codDelivery, status: "packing", fulfilment: "pickup" };
    const bus: OrderFacts = { ...khqrDelivery, status: "packing", area: "province" };
    expect(getDispatchRoute(pickup)).toBe("pickup");
    expect(getDispatchRoute(bus)).toBe("bus");
    expect(getDispatchRoute(codDelivery)).toBe("driver");
    expect(applyOrderAction(pickup, "dispatch")).toBe("out_for_delivery");
    expect(applyOrderAction(bus, "dispatch")).toBe("out_for_delivery");
  });

  it("lets a failed delivery be rebooked or cancelled", () => {
    expect(walk({ ...codDelivery, status: "out_for_delivery" }, ["fail_delivery", "rebook"])).toEqual([
      "out_for_delivery",
      "failed_delivery",
      "packing",
    ]);
    expect(applyOrderAction({ ...codDelivery, status: "failed_delivery" }, "cancel")).toBe("cancelled");
  });

  it("refuses steps out of order", () => {
    expect(applyOrderAction(khqrDelivery, "confirm")).toBeNull();
    expect(applyOrderAction({ ...khqrDelivery, status: "out_for_delivery" }, "cancel")).toBeNull();
    expect(applyOrderAction({ ...khqrDelivery, status: "completed" }, "settle_cash")).toBeNull();
    expect(applyOrderAction({ ...khqrDelivery, status: "cancelled" }, "confirm")).toBeNull();
  });

  it("offers only actions that are allowed, and none on finished orders", () => {
    for (const status of orderStatusSchema.options) {
      const order = { ...codDelivery, status };
      for (const action of getSellerActions(order)) {
        expect(applyOrderAction(order, action), `${action} from ${status}`).not.toBeNull();
      }
    }
    expect(getSellerActions({ status: "completed" })).toEqual([]);
    expect(getSellerActions({ status: "cancelled" })).toEqual([]);
  });
});

describe("buyer side of an order", () => {
  it("lets the buyer cancel only before money moves or packing starts", () => {
    expect(canBuyerCancel(khqrDelivery)).toBe(true);
    expect(canBuyerCancel(codDelivery)).toBe(true);
    expect(canBuyerCancel({ ...codDelivery, status: "confirmed" })).toBe(true);
    expect(canBuyerCancel({ ...khqrDelivery, status: "paid" })).toBe(false);
    expect(canBuyerCancel({ ...khqrDelivery, status: "confirmed" })).toBe(false);
    expect(canBuyerCancel({ ...codDelivery, status: "packing" })).toBe(false);
  });

  it("shows waiting-for-driver as still packing, and no progress on problems", () => {
    expect(getBuyerProgress("paid")).toBe(0);
    expect(getBuyerProgress("packing")).toBe(2);
    expect(getBuyerProgress("waiting_for_driver")).toBe(2);
    expect(getBuyerProgress("out_for_delivery")).toBe(3);
    expect(getBuyerProgress("completed")).toBe(4);
    expect(getBuyerProgress("cancelled")).toBeNull();
    expect(getBuyerProgress("failed_delivery")).toBeNull();
  });
});

describe("seller tabs", () => {
  it("groups statuses into the five tabs", () => {
    expect(getOrderTab("paid")).toBe("to_confirm");
    expect(getOrderTab("cod_pending")).toBe("to_confirm");
    expect(getOrderTab("confirmed")).toBe("packing");
    expect(getOrderTab("waiting_for_driver")).toBe("sending");
    expect(getOrderTab("completed")).toBe("delivered");
    expect(getOrderTab("failed_delivery")).toBe("problems");
    expect(getOrderTab("awaiting_payment")).toBe("awaiting");
  });
});

describe("sending and cancelling forms", () => {
  it("needs a driver's name and phone, or a bus company and ticket number", () => {
    expect(dispatchInputSchema.safeParse({ route: "driver", driverName: "Rith", driverPhone: "012 345 678" }).success).toBe(true);
    const badDriver = dispatchInputSchema.safeParse({ route: "driver", driverName: "R", driverPhone: "12" });
    expect(badDriver.success ? {} : toFieldErrors(badDriver.error)).toEqual({ driverName: "too_short", driverPhone: "phone_invalid" });
    const badBus = dispatchInputSchema.safeParse({ route: "bus", busCompany: "Vireak Buntham", ticketNumber: " " });
    expect(badBus.success ? {} : toFieldErrors(badBus.error)).toEqual({ ticketNumber: "required" });
    expect(dispatchInputSchema.safeParse({ route: "pickup" }).success).toBe(true);
  });

  it("needs a note when the cancel reason is other", () => {
    const result = orderCancellationSchema.safeParse({ reason: "other", note: "" });
    expect(result.success ? {} : toFieldErrors(result.error)).toEqual({ note: "required" });
    expect(orderCancellationSchema.safeParse({ reason: "out_of_stock", note: "" }).success).toBe(true);
  });
});

describe("which orders count as sales", () => {
  it("leaves out cancelled orders and ones still waiting for an online payment", () => {
    expect(countsAsSale("cancelled")).toBe(false);
    expect(countsAsSale("awaiting_payment")).toBe(false);
  });

  it("counts every other order, cash on delivery included", () => {
    expect(countsAsSale("cod_pending")).toBe(true);
    expect(countsAsSale("paid")).toBe(true);
    expect(countsAsSale("completed")).toBe(true);
  });
});
