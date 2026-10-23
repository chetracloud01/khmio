import { describe, expect, it } from "vitest";
import { deliverySettingsSchema, getDeliveryQuote, offersAnyFulfilment, shopLocationSchema, SUGGESTED_DELIVERY_SETTINGS } from "./delivery";

describe("SUGGESTED_DELIVERY_SETTINGS", () => {
  it("passes the same check the delivery page saves with, so a new seller can save it as it is", () => {
    expect(deliverySettingsSchema.safeParse(SUGGESTED_DELIVERY_SETTINGS).success).toBe(true);
  });

  it("quotes a central district, an outer one and a province", () => {
    expect(getDeliveryQuote(SUGGESTED_DELIVERY_SETTINGS, { fulfilment: "delivery", area: "phnom_penh", districtId: "daun-penh" })).toEqual({
      status: "ok",
      fee: { feeUsdCents: 100, feeKhr: 4000 },
    });
    expect(getDeliveryQuote(SUGGESTED_DELIVERY_SETTINGS, { fulfilment: "delivery", area: "phnom_penh", districtId: "sen-sok" })).toMatchObject({ status: "ok" });
    expect(getDeliveryQuote(SUGGESTED_DELIVERY_SETTINGS, { fulfilment: "delivery", area: "province", provinceId: "kampot" })).toMatchObject({ status: "ok" });
  });

  it("starts with pickup off and no drivers — the shop's own details", () => {
    expect(SUGGESTED_DELIVERY_SETTINGS.pickup.enabled).toBe(false);
    expect(SUGGESTED_DELIVERY_SETTINGS.drivers).toEqual([]);
  });
});

describe("offersAnyFulfilment", () => {
  const off = { zones: [], pickup: { enabled: false }, province: { enabled: false } };
  it("needs one way for a buyer to get an order", () => {
    expect(offersAnyFulfilment(off)).toBe(false);
    expect(offersAnyFulfilment({ ...off, pickup: { enabled: true } })).toBe(true);
    expect(offersAnyFulfilment({ ...off, province: { enabled: true } })).toBe(true);
    expect(offersAnyFulfilment({ ...off, zones: [{}] })).toBe(true);
  });
});

describe("shopLocationSchema", () => {
  const location = { address: "St. 240", mapUrl: "", pickupEnabled: true, pickupHours: "7–17" };
  it("takes a Google Maps link, or none", () => {
    expect(shopLocationSchema.safeParse({ ...location, mapUrl: "https://maps.app.goo.gl/abc" }).success).toBe(true);
    expect(shopLocationSchema.safeParse(location).success).toBe(true);
  });

  it("refuses anything that isn't a web link", () => {
    const result = shopLocationSchema.safeParse({ ...location, mapUrl: "javascript:alert(1)" });
    expect(result.success ? null : result.error.issues[0]?.message).toBe("map_link_invalid");
  });

  it("asks for the address when buyers can pick up", () => {
    const result = shopLocationSchema.safeParse({ ...location, address: " " });
    expect(result.success ? null : result.error.issues[0]?.path).toEqual(["address"]);
    expect(shopLocationSchema.safeParse({ ...location, address: "", pickupEnabled: false }).success).toBe(true);
  });
});
