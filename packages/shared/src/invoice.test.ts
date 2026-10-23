import { describe, expect, it } from "vitest";
import { formatTrackingCode, getInvoiceState, parseTrackingCode, socialLinkUrl, trackingCodePrefix, trackOrderInputSchema } from "./invoice";

describe("invoice state", () => {
  it("is a receipt once cash is handed over, never before", () => {
    expect(getInvoiceState({ status: "cod_pending", paymentMethod: "cod" })).toBe("unpaid");
    expect(getInvoiceState({ status: "out_for_delivery", paymentMethod: "cod" })).toBe("unpaid");
    expect(getInvoiceState({ status: "delivered", paymentMethod: "cod" })).toBe("paid");
    expect(getInvoiceState({ status: "completed", paymentMethod: "cod" })).toBe("paid");
  });

  it("is a receipt from the moment KHQR is paid", () => {
    expect(getInvoiceState({ status: "awaiting_payment", paymentMethod: "khqr" })).toBe("unpaid");
    expect(getInvoiceState({ status: "paid", paymentMethod: "khqr" })).toBe("paid");
    expect(getInvoiceState({ status: "packing", paymentMethod: "khqr" })).toBe("paid");
  });

  it("says cancelled whatever the payment", () => {
    expect(getInvoiceState({ status: "cancelled", paymentMethod: "khqr" })).toBe("cancelled");
    expect(getInvoiceState({ status: "cancelled", paymentMethod: "cod" })).toBe("cancelled");
  });
});

describe("tracking codes", () => {
  it("puts the shop's first three letters in front", () => {
    expect(trackingCodePrefix("mekong-auto-garage")).toBe("MEK");
    expect(formatTrackingCode("mekong-auto-garage", "7K4P9QXR")).toBe("MEK-7K4P-9QXR");
    expect(formatTrackingCode("", "7K4P9QXR")).toBe("7K4P-9QXR");
  });

  it("reads a code however the buyer typed it", () => {
    expect(parseTrackingCode("MEK-7K4P-9QXR")).toBe("7K4P9QXR");
    expect(parseTrackingCode(" mek 7k4p 9qxr ")).toBe("7K4P9QXR");
    expect(parseTrackingCode("7k4p-9qxr")).toBe("7K4P9QXR");
  });

  it("refuses look-alikes and the wrong length", () => {
    expect(parseTrackingCode("7K4P-9QX0")).toBeNull();
    expect(parseTrackingCode("7K4P-9QXI")).toBeNull();
    expect(parseTrackingCode("7K4P")).toBeNull();
  });

  it("needs both the code and a Cambodian phone", () => {
    expect(trackOrderInputSchema.safeParse({ code: "MEK-7K4P-9QXR", phone: "012 345 678" }).success).toBe(true);
    expect(trackOrderInputSchema.safeParse({ code: "MEK-7K4P-9QXR", phone: "" }).success).toBe(false);
    expect(trackOrderInputSchema.safeParse({ code: "hello", phone: "012 345 678" }).success).toBe(false);
  });
});

describe("tracking code in Telegram messages", () => {
  it("adds the code to the seller's alert and the buyer's update when there is one", async () => {
    const { buyerUpdateText, newOrderAlert } = await import("./notifications");
    const alert = newOrderAlert({ orderNumber: 7, totalMinor: 4350, currency: "USD", paymentMethod: "cod", fulfilment: "pickup", districtId: null, provinceId: null, itemCount: 1, trackingCode: "MEK-7K4P-9QXR" });
    expect(alert).toContain("MEK-7K4P-9QXR");
    const update = buyerUpdateText({ orderNumber: 7, shopName: "Mekong", status: "confirmed", fulfilment: "pickup", dispatch: null, trackingCode: "MEK-7K4P-9QXR" });
    expect(update).toContain("MEK-7K4P-9QXR");
    expect(buyerUpdateText({ orderNumber: 7, shopName: "Mekong", status: "confirmed", fulfilment: "pickup", dispatch: null })).not.toContain("Tracking");
  });
});

describe("socialLinkUrl", () => {
  it("opens whatever the seller typed as a web link", () => {
    expect(socialLinkUrl("telegram", "t.me/sokhacoffee")).toBe("https://t.me/sokhacoffee");
    expect(socialLinkUrl("telegram", "@sokhacoffee")).toBe("https://t.me/sokhacoffee");
    expect(socialLinkUrl("facebook", "sokhacoffee")).toBe("https://facebook.com/sokhacoffee");
    expect(socialLinkUrl("facebook", " https://fb.com/sokha ")).toBe("https://fb.com/sokha");
  });

  it("gives nothing for an empty field or a non-web link", () => {
    expect(socialLinkUrl("telegram", "  ")).toBeNull();
    expect(socialLinkUrl("facebook", "javascript:alert(1)")).toBeNull();
  });
});
