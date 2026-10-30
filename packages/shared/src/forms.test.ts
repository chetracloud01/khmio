import { describe, expect, it } from "vitest";
import { canUnlinkLoginMethod, otpCodeSchema, phoneLoginSchema } from "./auth";
import { checkoutInputSchema, getAvailablePaymentMethods } from "./checkout";
import { deliveryFeeIn, deliverySettingsSchema, deliverySettingsShape, getDeliveryQuote, type DeliverySettings } from "./delivery";
import { toFieldErrors } from "./form-errors";
import { parseKhrInput, parseUsdInput } from "./money";
import { formatKhmerPhoneLocal } from "./phone";
import { MAX_PRODUCT_DESCRIPTION_LENGTH, productInputSchema, type ProductFormInput } from "./product";
import { kycRejectionSchema, kycSubmissionSchema } from "./kyc";
import {
  getBuyerStockState,
  stockChangeInputSchema,
  stockTrackInputSchema,
  maxOrderQuantity,
  parseQuantityInput,
  stockMovementInputSchema,
  stockMovementSign,
  stockTransferInputSchema,
  takesStockWhenPlaced,
} from "./stock";
import { clampExchangeRate, storeProfileSchema, storeSettingsSchema } from "./store";

function errorsOf(result: { success: boolean; error?: Parameters<typeof toFieldErrors>[0] }) {
  return result.error ? toFieldErrors(result.error) : {};
}

describe("price box parsing", () => {
  it("reads USD as cents and KHR as riel", () => {
    expect(parseUsdInput("8.5")).toBe(850);
    expect(parseUsdInput("1,200.00")).toBe(120000);
    expect(parseKhrInput("34,850")).toBe(34850);
  });

  it("treats blank as no price and junk as invalid", () => {
    expect(parseUsdInput("  ")).toBeUndefined();
    expect(parseUsdInput("-1")).toBeNaN();
    expect(parseUsdInput("1.005")).toBeNaN();
    expect(parseKhrInput("5000.5")).toBeNaN();
    expect(parseKhrInput("abc")).toBeNaN();
  });
});

describe("product", () => {
  const base: ProductFormInput = { titleKm: "កាហ្វេ", titleEn: "", categoryId: "drinks", retailPriceUsdCents: 150 };

  it("accepts a product priced in one currency", () => {
    expect(productInputSchema.safeParse(base).success).toBe(true);
    expect(productInputSchema.safeParse({ ...base, retailPriceUsdCents: undefined, retailPriceKhr: 6000 }).success).toBe(true);
  });

  it("rejects a product with no price", () => {
    const result = productInputSchema.safeParse({ ...base, retailPriceUsdCents: undefined });
    expect(errorsOf(result)).toEqual({ retailPrice: "price_required" });
  });

  it("is visible with no description unless the seller says otherwise", () => {
    const result = productInputSchema.parse(base);
    expect(result).toMatchObject({ isVisible: true, descriptionKm: "", descriptionEn: "" });
    expect(productInputSchema.parse({ ...base, isVisible: false, descriptionKm: "  ឆ្ងាញ់  " })).toMatchObject({
      isVisible: false,
      descriptionKm: "ឆ្ងាញ់",
    });
  });

  it("rejects a description longer than the limit", () => {
    const result = productInputSchema.safeParse({ ...base, descriptionEn: "a".repeat(MAX_PRODUCT_DESCRIPTION_LENGTH + 1) });
    expect(errorsOf(result)).toEqual({ descriptionEn: "too_long" });
  });

  it("rejects a discount outside 0–90%", () => {
    expect(errorsOf(productInputSchema.safeParse({ ...base, discountPercent: 150 }))).toEqual({ discountPercent: "discount_range" });
    expect(productInputSchema.safeParse({ ...base, discountPercent: 90 }).success).toBe(true);
  });

  it("rejects a price that could not be read", () => {
    expect(errorsOf(productInputSchema.safeParse({ ...base, retailPriceUsdCents: Number.NaN }))).toMatchObject({
      retailPriceUsdCents: "price_invalid",
    });
  });

  it("rejects a wholesale price above retail in the same currency", () => {
    const result = productInputSchema.safeParse({ ...base, wholesalePriceUsdCents: 200 });
    expect(errorsOf(result)).toEqual({ wholesalePrice: "wholesale_above_retail" });
  });

  it("checks each option's name, price and SKU", () => {
    const result = productInputSchema.safeParse({
      ...base,
      options: [
        { id: "a", sku: "CUP-S", labelKm: "តូច", labelEn: "", retailPriceUsdCents: 100 },
        { id: "b", sku: "cup-s", labelKm: "", labelEn: "", retailPriceKhr: undefined },
      ],
    });
    expect(errorsOf(result)).toEqual({
      "options.1.label": "option_label_required",
      "options.1.retailPrice": "price_required",
      "options.1.sku": "sku_duplicate",
    });
  });
});

describe("store profile", () => {
  const profile = {
    shopName: "Sokha Coffee",
    businessType: "restaurant",
    phone: "",
    area: "phnom_penh",
    description: "",
    bakongId: "sokha@aclb",
  };

  it("accepts a blank phone and normalises a real one", () => {
    expect(storeProfileSchema.safeParse(profile).success).toBe(true);
    const result = storeProfileSchema.safeParse({ ...profile, phone: "012 345 678" });
    expect(result.success && result.data.phone).toBe("85512345678");
  });

  it("shows a saved phone back in local format", () => {
    expect(formatKhmerPhoneLocal("85512345678")).toBe("012 345 678");
    expect(formatKhmerPhoneLocal("855971234567")).toBe("097 123 4567");
    expect(formatKhmerPhoneLocal("")).toBe("");
  });

  it("saves without a Bakong ID — getting paid is set up later", () => {
    expect(storeProfileSchema.safeParse({ ...profile, bakongId: "" }).success).toBe(true);
  });

  it("reports a bad phone and Bakong ID by code", () => {
    const result = storeProfileSchema.safeParse({ ...profile, phone: "123", bakongId: "sokha" });
    expect(errorsOf(result)).toEqual({ phone: "phone_invalid", bakongId: "bakong_invalid" });
  });
});

describe("checkout", () => {
  const order = {
    name: "Dara",
    phone: "097 123 4567",
    currency: "KHR",
    fulfilment: "delivery",
    area: "phnom_penh",
    districtId: "daun-penh",
    landmark: "",
    paymentMethod: "cod",
    storeAllowsCod: true,
  };

  it("allows cash for Phnom Penh delivery and for pickup, never for province delivery", () => {
    expect(checkoutInputSchema.safeParse(order).success).toBe(true);
    expect(checkoutInputSchema.safeParse({ ...order, fulfilment: "pickup", districtId: undefined }).success).toBe(true);
    expect(
      errorsOf(checkoutInputSchema.safeParse({ ...order, area: "province", districtId: undefined, provinceId: "kampot" })),
    ).toEqual({ paymentMethod: "cod_unavailable" });
    expect(errorsOf(checkoutInputSchema.safeParse({ ...order, storeAllowsCod: false }))).toEqual({ paymentMethod: "cod_unavailable" });
  });

  it("needs a district for Phnom Penh delivery and a province outside it, nothing for pickup", () => {
    const paid = { ...order, paymentMethod: "khqr" };
    expect(errorsOf(checkoutInputSchema.safeParse({ ...paid, districtId: undefined }))).toEqual({ districtId: "district_required" });
    expect(errorsOf(checkoutInputSchema.safeParse({ ...paid, districtId: "nowhere" }))).toEqual({ districtId: "district_required" });
    expect(errorsOf(checkoutInputSchema.safeParse({ ...paid, area: "province", districtId: undefined }))).toEqual({
      provinceId: "province_required",
    });
    expect(checkoutInputSchema.safeParse({ ...paid, fulfilment: "pickup", districtId: undefined }).success).toBe(true);
  });
});

describe("delivery settings and quotes", () => {
  const settings: DeliverySettings = {
    zones: [
      { id: "z1", name: "Central", districtIds: ["daun-penh", "chamkar-mon"], feeUsdCents: 100 },
      { id: "z2", name: "Outer", districtIds: ["sen-sok"], feeKhr: 6000 },
    ],
    pickup: { enabled: true, address: "St. 240, Daun Penh", hours: "8am–6pm" },
    province: { enabled: true, note: "", feeUsdCents: 200 },
    drivers: [],
  };
  const pp = { fulfilment: "delivery", area: "phnom_penh" } as const;

  it("quotes the fee of the zone the district is in", () => {
    expect(getDeliveryQuote(settings, { ...pp, districtId: "chamkar-mon" })).toEqual({ status: "ok", fee: { feeUsdCents: 100 } });
    expect(getDeliveryQuote(settings, { ...pp, districtId: "sen-sok" })).toEqual({ status: "ok", fee: { feeKhr: 6000 } });
  });

  it("waits for a district, and refuses one the shop doesn't cover", () => {
    expect(getDeliveryQuote(settings, pp)).toEqual({ status: "incomplete" });
    expect(getDeliveryQuote(settings, { ...pp, districtId: "kamboul" })).toEqual({ status: "unavailable" });
  });

  it("makes pickup free and follows the on/off switches", () => {
    expect(getDeliveryQuote(settings, { fulfilment: "pickup", area: "phnom_penh" })).toEqual({ status: "ok", fee: {} });
    const off = { ...settings, pickup: { ...settings.pickup, enabled: false }, province: { ...settings.province, enabled: false } };
    expect(getDeliveryQuote(off, { fulfilment: "pickup", area: "phnom_penh" })).toEqual({ status: "unavailable" });
    expect(getDeliveryQuote(off, { fulfilment: "delivery", area: "province", provinceId: "kampot" })).toEqual({ status: "unavailable" });
  });

  it("turns a fee into the order's currency, converting only when that currency is missing", () => {
    expect(deliveryFeeIn({ feeUsdCents: 100 }, "USD", 4100)).toBe(100);
    expect(deliveryFeeIn({ feeUsdCents: 100 }, "KHR", 4100)).toBe(4100);
    expect(deliveryFeeIn({ feeUsdCents: 100, feeKhr: 4000 }, "KHR", 4100)).toBe(4000);
    expect(deliveryFeeIn({}, "USD", 4100)).toBe(0);
  });

  it("rejects a district in two zones, an empty zone, and pickup with no address", () => {
    const twoZones = { ...settings, zones: [settings.zones[0]!, { ...settings.zones[1]!, districtIds: ["daun-penh"] }] };
    expect(errorsOf(deliverySettingsSchema.safeParse(twoZones))).toEqual({ "zones.1.districtIds": "district_duplicate" });
    const emptyZone = { ...settings, zones: [{ ...settings.zones[0]!, districtIds: [] }] };
    expect(errorsOf(deliverySettingsSchema.safeParse(emptyZone))).toEqual({ "zones.0.districtIds": "zone_empty" });
    const noAddress = { ...settings, pickup: { enabled: true, address: " ", hours: "" } };
    expect(errorsOf(deliverySettingsSchema.safeParse(noAddress))).toEqual({ "pickup.address": "required" });
  });

  it("needs at least one way to get an order to a buyer", () => {
    const nothing = { zones: [], pickup: { enabled: false, address: "", hours: "" }, province: { enabled: false, note: "" }, drivers: [] };
    expect(errorsOf(deliverySettingsSchema.safeParse(nothing))).toEqual({ zones: "delivery_required" });
  });

  it("reads a shop's saved settings by their shape alone, even before delivery is set up", () => {
    const notSetUp = { zones: [], pickup: { enabled: false, address: "", hours: "" }, province: { enabled: false, note: "" }, drivers: [] };
    expect(deliverySettingsShape.safeParse(notSetUp).success).toBe(true);
    expect(deliverySettingsShape.safeParse({ ...notSetUp, pickup: { enabled: "yes" } }).success).toBe(false);
  });
});

describe("store settings", () => {
  const band = { min: 3900, max: 4300 };
  const settings = { defaultCurrency: "USD", usdToKhrRate: 4100, allowCod: true, vatPercent: 10 };

  it("accepts valid settings", () => {
    expect(storeSettingsSchema(band).safeParse(settings).success).toBe(true);
  });

  it("rejects a rate outside the platform band instead of clamping it", () => {
    expect(errorsOf(storeSettingsSchema(band).safeParse({ ...settings, usdToKhrRate: 41000 }))).toEqual({
      usdToKhrRate: "rate_out_of_band",
    });
  });

  it("rejects VAT above 20%", () => {
    expect(errorsOf(storeSettingsSchema(band).safeParse({ ...settings, vatPercent: 25 }))).toEqual({ vatPercent: "vat_range" });
  });

  it("clamps an old rate to a band the admin narrowed later", () => {
    expect(clampExchangeRate(4400, band)).toBe(4300);
    expect(clampExchangeRate(4100, band)).toBe(4100);
  });
});

describe("stock transfer and correction", () => {
  const item = { productId: "p1", quantity: 5 };

  it("adds for purchase, transfer in and adjust in; takes away for the rest", () => {
    expect(["purchase", "transfer_in", "adjust_in"].map((type) => stockMovementSign(type as "purchase"))).toEqual([1, 1, 1]);
    expect(["sale", "transfer_out", "adjust_out"].map((type) => stockMovementSign(type as "sale"))).toEqual([-1, -1, -1]);
  });

  it("refuses a transfer to the same place", () => {
    const place = { type: "warehouse", id: "main-wh" };
    expect(errorsOf(stockTransferInputSchema.safeParse({ ...item, from: place, to: place }))).toEqual({ to: "same_location" });
    expect(
      stockTransferInputSchema.safeParse({ ...item, from: place, to: { type: "branch", id: "main-branch" } }).success,
    ).toBe(true);
  });

  it("needs a reason for a correction, and a note when the reason is other", () => {
    const base = { ...item, type: "adjust_out", locationType: "branch", locationId: "main-branch" };
    expect(errorsOf(stockMovementInputSchema.safeParse(base))).toEqual({ reason: "reason_required" });
    expect(errorsOf(stockMovementInputSchema.safeParse({ ...base, reason: "other" }))).toEqual({ note: "required" });
    expect(stockMovementInputSchema.safeParse({ ...base, reason: "damaged" }).success).toBe(true);
  });
});

describe("merchant login", () => {
  it("accepts a 6-digit code, spaces ignored, and nothing else", () => {
    expect(otpCodeSchema.safeParse("123 456").success).toBe(true);
    expect(errorsOf(otpCodeSchema.safeParse("12345"))).toEqual({ "": "otp_invalid" });
    expect(errorsOf(otpCodeSchema.safeParse("12a456"))).toEqual({ "": "otp_invalid" });
  });

  it("normalises the phone number to log in with", () => {
    const result = phoneLoginSchema.safeParse({ phone: "012 345 678" });
    expect(result.success && result.data.phone).toBe("85512345678");
  });

  it("never lets the last login method be removed", () => {
    expect(canUnlinkLoginMethod(1)).toBe(false);
    expect(canUnlinkLoginMethod(2)).toBe(true);
  });
});

describe("payment methods offered at checkout", () => {
  const base = { khqrReady: true, payWayReady: false, storeAllowsCod: true, area: "phnom_penh" as const };

  it("offers KHQR only once the Bakong account is set up", () => {
    expect(getAvailablePaymentMethods(base)).toEqual(["khqr", "cod"]);
    expect(getAvailablePaymentMethods({ ...base, khqrReady: false })).toEqual(["cod"]);
  });

  it("offers nothing when no online payment is set up and cash isn't possible", () => {
    expect(getAvailablePaymentMethods({ ...base, khqrReady: false, area: "province" })).toEqual([]);
  });
});

describe("buyer stock state", () => {
  it("never limits a store that doesn't track stock (Free, Basic)", () => {
    const state = getBuyerStockState(false, 0);
    expect(state).toEqual({ kind: "untracked" });
    expect(maxOrderQuantity(state)).toBeNull();
  });

  it("is sold out at zero or below, low at 5 or fewer, in stock above", () => {
    expect(getBuyerStockState(true, 0)).toEqual({ kind: "sold_out" });
    expect(getBuyerStockState(true, -3)).toEqual({ kind: "sold_out" });
    expect(getBuyerStockState(true, 5)).toEqual({ kind: "low", available: 5 });
    expect(getBuyerStockState(true, 6)).toEqual({ kind: "in_stock", available: 6 });
    expect(maxOrderQuantity(getBuyerStockState(true, 0))).toBe(0);
    expect(maxOrderQuantity(getBuyerStockState(true, 12))).toBe(12);
  });
});

describe("KYC", () => {
  const photo = "data:image/jpeg;base64,AAAA";
  const idCard = { idType: "national_id", fullName: "Chan Sokha", idNumber: "0123 45678", frontPhoto: photo, backPhoto: photo };

  it("accepts an ID card with both sides and tidies the number", () => {
    const result = kycSubmissionSchema.safeParse(idCard);
    expect(result.success && result.data.idNumber).toBe("012345678");
  });

  it("needs the back of an ID card, but not of a passport", () => {
    const front = { ...idCard, backPhoto: undefined };
    expect(errorsOf(kycSubmissionSchema.safeParse(front))).toEqual({ backPhoto: "photo_required" });
    expect(kycSubmissionSchema.safeParse({ ...front, idType: "passport", idNumber: "N1234567" }).success).toBe(true);
  });

  it("rejects a non-image upload and a malformed number", () => {
    const result = kycSubmissionSchema.safeParse({ ...idCard, frontPhoto: "data:text/html;base64,AAAA", idNumber: "12-3" });
    expect(errorsOf(result)).toEqual({ frontPhoto: "photo_required", idNumber: "id_number_invalid" });
  });

  it("needs a note when the reject reason is other", () => {
    expect(errorsOf(kycRejectionSchema.safeParse({ reason: "other", note: "" }))).toEqual({ note: "required" });
    expect(kycRejectionSchema.safeParse({ reason: "photo_unclear", note: "" }).success).toBe(true);
  });
});

describe("stock movement", () => {
  const movement = { type: "purchase", productId: "p1", locationType: "warehouse", locationId: "main-wh", quantity: 5 };

  it("needs a whole quantity of at least 1", () => {
    expect(stockMovementInputSchema.safeParse(movement).success).toBe(true);
    expect(errorsOf(stockMovementInputSchema.safeParse({ ...movement, quantity: parseQuantityInput("0") }))).toEqual({
      quantity: "quantity_invalid",
    });
    expect(errorsOf(stockMovementInputSchema.safeParse({ ...movement, quantity: parseQuantityInput("2.5") }))).toEqual({
      quantity: "quantity_invalid",
    });
  });
});

describe("a stock change on the Stock page", () => {
  const variantId = "0b5e5f3e-8f6c-4c2a-9d7e-1a2b3c4d5e6f";
  it("leaves stock arriving to a supplier bill (purchases.ts)", () => {
    expect(stockChangeInputSchema.safeParse({ variantId, type: "purchase", quantity: 12 }).success).toBe(false);
  });
  it("asks a correction why, and \"other\" for a note", () => {
    const noReason = stockChangeInputSchema.safeParse({ variantId, type: "adjust_out", quantity: 1 });
    expect(noReason.success ? null : noReason.error.issues[0]?.message).toBe("reason_required");
    expect(stockChangeInputSchema.safeParse({ variantId, type: "adjust_out", quantity: 1, reason: "other" }).success).toBe(false);
    expect(stockChangeInputSchema.safeParse({ variantId, type: "adjust_out", quantity: 1, reason: "damaged" }).success).toBe(true);
  });
  it("refuses zero, negative or partial quantities, and a sale typed by hand", () => {
    for (const quantity of [0, -1, 1.5]) expect(stockChangeInputSchema.safeParse({ variantId, type: "adjust_in", reason: "count_correction", quantity }).success).toBe(false);
    expect(stockChangeInputSchema.safeParse({ variantId, type: "sale", quantity: 1 }).success).toBe(false);
  });
  it("starts tracking from any whole count, zero included", () => {
    expect(stockTrackInputSchema.safeParse({ variantId, onHand: 0 }).success).toBe(true);
    expect(stockTrackInputSchema.safeParse({ variantId, onHand: -1 }).success).toBe(false);
  });
});

describe("when an online order takes its stock", () => {
  it("takes it at once for cash on delivery, never for an order still waiting to be paid online", () => {
    expect(takesStockWhenPlaced("cod")).toBe(true);
    expect(takesStockWhenPlaced("khqr")).toBe(false);
    expect(takesStockWhenPlaced("aba_payway")).toBe(false);
  });
});
