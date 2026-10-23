import { describe, expect, it } from "vitest";
import { toFieldErrors } from "./form-errors";
import { buyerCancelledAlert, confirmButtonData, newOrderAlert, parseButtonData } from "./notifications";
import { decideOrderAction, isPlainOrderAction, isSellerOrderAction, orderActionRequestSchema, type OrderFacts } from "./orders";

const cashInPhnomPenh: OrderFacts = { status: "packing", paymentMethod: "cod", fulfilment: "delivery", area: "phnom_penh" };

describe("orderActionRequestSchema", () => {
  const errors = (value: unknown) => {
    const result = orderActionRequestSchema.safeParse(value);
    return result.success ? {} : toFieldErrors(result.error);
  };

  it("accepts the plain steps, a dispatch and a cancellation", () => {
    expect(errors({ action: "confirm" })).toEqual({});
    expect(errors({ action: "dispatch", dispatch: { route: "driver", driverName: "Dara", driverPhone: "012 345 678" } })).toEqual({});
    expect(errors({ action: "cancel", cancellation: { reason: "out_of_stock", note: "" } })).toEqual({});
  });

  it("refuses the system's own step and reasons a seller can't give", () => {
    expect(orderActionRequestSchema.safeParse({ action: "pay" }).success).toBe(false);
    expect(errors({ action: "cancel", cancellation: { reason: "payment_timeout", note: "" } })).toEqual({ "cancellation.reason": "reason_required" });
    expect(errors({ action: "cancel", cancellation: { reason: "other", note: "" } })).toEqual({ "cancellation.note": "required" });
  });

  it("needs a driver's name and a real phone, or a bus company and ticket", () => {
    expect(errors({ action: "dispatch", dispatch: { route: "driver", driverName: "D", driverPhone: "1" } })).toEqual({
      "dispatch.driverName": "too_short",
      "dispatch.driverPhone": "phone_invalid",
    });
    expect(errors({ action: "dispatch", dispatch: { route: "bus", busCompany: "Virak Buntham", ticketNumber: "" } })).toEqual({ "dispatch.ticketNumber": "required" });
  });
});

describe("decideOrderAction", () => {
  it("moves an order to its next status", () => {
    expect(decideOrderAction({ ...cashInPhnomPenh, status: "cod_pending" }, { action: "confirm" })).toEqual({ status: "confirmed" });
    expect(decideOrderAction(cashInPhnomPenh, { action: "dispatch", dispatch: { route: "driver", driverName: "Dara", driverPhone: "85512345678" } })).toEqual({
      status: "waiting_for_driver",
    });
  });

  it("refuses a step that doesn't follow, and a route the buyer didn't choose", () => {
    expect(decideOrderAction({ ...cashInPhnomPenh, status: "completed" }, { action: "confirm" })).toEqual({ refused: "not_allowed" });
    expect(decideOrderAction(cashInPhnomPenh, { action: "dispatch", dispatch: { route: "pickup" } })).toEqual({ refused: "wrong_route" });
  });
});

describe("Telegram alerts", () => {
  const facts = { orderNumber: 12, totalMinor: 50800, currency: "KHR" as const, paymentMethod: "cod" as const, fulfilment: "delivery" as const, districtId: "daun-penh", provinceId: null, itemCount: 2 };

  it("say what the order is in Khmer and English, without any phone number", () => {
    const text = newOrderAlert(facts);
    expect(text).toContain("#12");
    expect(text).toContain("50,800៛");
    expect(text).toContain("ដូនពេញ");
    expect(text).toContain("Daun Penh");
    expect(text).toContain("2 items");
    expect(text).not.toMatch(/\d{8,}/);
    expect(buyerCancelledAlert({ orderNumber: 12 })).toContain("#12");
  });

  it("carry only the action and the order id in a button, and read it back", () => {
    const orderId = "4b48c583-15b2-41fe-a0ee-48791767aeb3";
    const data = confirmButtonData(orderId);
    expect(data.length).toBeLessThanOrEqual(64);
    expect(parseButtonData(data)).toEqual({ action: "confirm", orderId });
    expect(parseButtonData("confirm:../../x")).toBeNull();
    expect(parseButtonData("delete:" + orderId)).toBeNull();
  });
});

describe("which steps a seller sends, and with what", () => {
  it("knows the system's own step isn't the seller's", () => {
    expect(isSellerOrderAction("confirm")).toBe(true);
    expect(isSellerOrderAction("cancel")).toBe(true);
    expect(isSellerOrderAction("pay")).toBe(false);
  });

  it("sends the plain steps alone, and dispatch or cancel only with their details", () => {
    expect(isPlainOrderAction("confirm")).toBe(true);
    expect(isPlainOrderAction("fail_delivery")).toBe(true);
    expect(isPlainOrderAction("dispatch")).toBe(false);
    expect(isPlainOrderAction("cancel")).toBe(false);
    expect(isPlainOrderAction("pay")).toBe(false);
  });
});
