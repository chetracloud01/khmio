import { describe, expect, it } from "vitest";
import { photoUrl } from "../testing/rows";
import { toPublicOrder } from "./public-order";

type OrderRow = Parameters<typeof toPublicOrder>[0];

const AT = new Date("2026-10-20T03:00:00Z");
const order = (overrides: Partial<OrderRow> = {}): OrderRow => ({
  orderNumber: 7,
  trackingCode: "7K4P9QXR",
  status: "cod_pending",
  paymentMethod: "cod",
  currency: "USD",
  subtotalMinor: 500,
  discountMinor: 0,
  deliveryFeeMinor: 100,
  vatPercent: 0,
  vatMinor: 0,
  totalMinor: 600,
  exchangeRateUsed: 4100,
  fulfilment: "delivery",
  area: "phnom_penh",
  districtId: "daun-penh",
  provinceId: null,
  landmark: "",
  pickupAddress: "",
  pickupHours: "",
  buyerName: "Sokha",
  cancelReason: null,
  createdAt: AT,
  items: [],
  events: [{ status: "cod_pending", at: AT }],
  dispatches: [],
  ...overrides,
});
const store = { slug: "mekong-auto-garage", name: "Mekong Auto Garage", phone: "85512345678", logoKey: null };

describe("the buyer's order page", () => {
  it("prints the tracking code with the shop's prefix, as on the receipt", () => {
    expect(toPublicOrder(order(), store, 0, photoUrl).trackingCode).toBe("MEK-7K4P-9QXR");
  });

  it("never holds the buyer's phone: the link may be forwarded", () => {
    expect(JSON.stringify(toPublicOrder(order(), store, 0, photoUrl))).not.toContain("buyerPhone");
  });

  it("shows how it was sent, without the driver's phone", () => {
    const dispatch = { route: "driver" as const, driverName: "Dara", busCompany: "", ticketNumber: "", dispatchedAt: AT };
    expect(toPublicOrder(order({ dispatches: [dispatch] }), store, 0, photoUrl).dispatch).toEqual(dispatch);
    expect(toPublicOrder(order(), store, 0, photoUrl).dispatch).toBeNull();
  });

  it("lets the buyer cancel only while nothing has moved", () => {
    expect(toPublicOrder(order(), store, 0, photoUrl).canCancel).toBe(true);
    expect(toPublicOrder(order({ status: "packing" }), store, 0, photoUrl).canCancel).toBe(false);
  });

  it("says whether a Telegram chat follows it", () => {
    expect(toPublicOrder(order(), store, 0, photoUrl).followingOnTelegram).toBe(false);
    expect(toPublicOrder(order(), store, 2, photoUrl).followingOnTelegram).toBe(true);
  });
});
