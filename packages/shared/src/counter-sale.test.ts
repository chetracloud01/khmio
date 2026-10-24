import { describe, expect, it } from "vitest";
import { cashChange, counterSaleInputSchema, quickCashAmounts } from "./counter-sale";

describe("cash at the counter", () => {
  it("gives the change, or nothing when the buyer gave too little", () => {
    expect(cashChange(1250, 2000)).toBe(750);
    expect(cashChange(1250, 1250)).toBe(0);
    expect(cashChange(1250, 1000)).toBeNull();
  });

  it("offers the exact amount and the notes a buyer hands over, in dollars", () => {
    expect(quickCashAmounts(1250, "USD")).toEqual([1250, 1300, 1500, 2000]);
    expect(quickCashAmounts(500, "USD")).toEqual([500, 1000, 2000, 5000]);
  });

  it("does the same in riel, never offering less than the total", () => {
    expect(quickCashAmounts(13500, "KHR")).toEqual([13500, 14000, 15000, 20000]);
    expect(quickCashAmounts(13500, "KHR").every((amount) => amount >= 13500)).toBe(true);
  });
});

describe("a counter sale as sent", () => {
  const sale = {
    idempotencyKey: "6f1c2a7e-3b9d-4e8f-a1b2-c3d4e5f60718",
    currency: "USD",
    lines: [{ variantId: "0b5e5f3e-8f6c-4c2a-9d7e-1a2b3c4d5e6f", quantity: 2 }],
    payment: { method: "cash", receivedMinor: 1000 },
    buyerName: "",
    buyerPhone: "",
  };

  it("takes cash with what the buyer handed over, and no phone", () => {
    expect(counterSaleInputSchema.safeParse(sale).success).toBe(true);
  });

  it("takes the shop's QR only with the seller's tick", () => {
    expect(counterSaleInputSchema.safeParse({ ...sale, payment: { method: "shop_qr", sellerConfirmed: true } }).success).toBe(true);
    expect(counterSaleInputSchema.safeParse({ ...sale, payment: { method: "shop_qr", sellerConfirmed: false } }).success).toBe(false);
  });

  it("refuses an empty sale and a phone that isn't Cambodian", () => {
    expect(counterSaleInputSchema.safeParse({ ...sale, lines: [] }).success).toBe(false);
    const phone = counterSaleInputSchema.safeParse({ ...sale, buyerPhone: "12" });
    expect(phone.success ? null : phone.error.issues[0]?.message).toBe("phone_invalid");
    expect(counterSaleInputSchema.parse({ ...sale, buyerPhone: "012 345 678" }).buyerPhone).toBe("85512345678");
  });
});
