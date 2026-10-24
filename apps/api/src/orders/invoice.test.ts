import { describe, expect, it } from "vitest";
import { toInvoice } from "./invoice";

const order = {
  orderNumber: 7,
  channel: "online" as const,
  cashReceivedMinor: null,
  changeMinor: null,
  trackingCode: "7K4P9QXR",
  publicToken: "t".repeat(32),
  status: "delivered" as const,
  paymentMethod: "cod" as const,
  currency: "USD" as const,
  subtotalMinor: 4200,
  discountMinor: 0,
  deliveryFeeMinor: 150,
  vatPercent: 0,
  vatMinor: 0,
  totalMinor: 4350,
  exchangeRateUsed: 4100,
  fulfilment: "delivery" as const,
  area: "phnom_penh" as const,
  districtId: "tuol-kouk",
  provinceId: null,
  landmark: "",
  buyerName: "Sokha",
  buyerPhone: "85512345678",
  createdAt: new Date("2026-10-22T03:00:00Z"),
  items: [],
};
const store = {
  slug: "mekong-auto-garage",
  name: "Mekong Auto Garage",
  phone: "85512777888",
  logoKey: null,
  pickupAddress: "No. 25, Street 271",
  taxNumber: "K001-900112233",
  invoiceNote: "Warranty 12 months",
  telegramLink: "",
  facebookLink: "",
};

describe("invoice", () => {
  it("shows the seller the buyer's phone in full and the buyer only its ends", () => {
    expect(toInvoice(order, store, (key) => key, "seller").order.buyerPhone).toBe("85512345678");
    expect(toInvoice(order, store, (key) => key, "buyer").order.buyerPhone).toBe("012 ••• 678");
  });

  it("prints the code with the shop's letters, the pickup address and the saved amounts", () => {
    const invoice = toInvoice(order, store, (key) => key, "buyer");
    expect(invoice.order.trackingCode).toBe("MEK-7K4P-9QXR");
    expect(invoice.shop.address).toBe("No. 25, Street 271");
    expect(invoice.order.totalMinor).toBe(4350);
    // Cash handed over at delivery: a receipt.
    expect(invoice.order.state).toBe("paid");
  });
});
