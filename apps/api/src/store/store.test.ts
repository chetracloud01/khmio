import { describe, expect, it } from "vitest";
import { photoUrl } from "../testing/rows";
import { SUGGESTED_DELIVERY_SETTINGS } from "@khmio/shared";
import { isReadyToShare, pickupSwitchProblem, storeSettingsChanged, toStoreDetails, type StoreDetailsRows } from "./store";

const rows = (overrides: Partial<StoreDetailsRows> = {}, store: Partial<StoreDetailsRows["store"]> = {}): StoreDetailsRows => ({
  store: {
    slug: "sokha-coffee",
    name: "Sokha Coffee",
    businessType: "shop",
    modules: ["options", "customFields"],
    phone: "85512345678",
    area: "phnom_penh",
    description: "",
    logoKey: null,
    usdToKhrRate: 4100,
    defaultCurrency: "USD",
    allowCod: true,
    vatPercent: 0,
    deliveryConfiguredAt: new Date("2026-10-01T03:00:00Z"),
    linkSharedAt: null,
    taxNumber: "",
    invoiceNote: "",
    telegramLink: "",
    facebookLink: "",
    pickupEnabled: false,
    pickupAddress: "",
    pickupHours: "",
    mapUrl: "",
    paymentQrKey: "",
    ...store,
  },
  bakongId: null,
  plan: { plan: "basic", paused: false },
  visibleProducts: 3,
  productsWithPhoto: 2,
  rateBand: { min: 3900, max: 4300 },
  ...overrides,
});

describe("the seller's shop details", () => {
  it("turns the saved columns into the setup checklist's facts", () => {
    expect(toStoreDetails(rows(), photoUrl)).toMatchObject({
      bakongId: "",
      plan: "basic",
      paused: false,
      readiness: { visibleProducts: 3, productsWithPhoto: 2, deliveryConfigured: true, khqrReady: false, codEnabled: true },
      linkShared: false,
    });
  });

  it("counts KHQR as ready once a Bakong ID is saved", () => {
    expect(toStoreDetails(rows({ bakongId: "sokha@aclb" }), photoUrl)).toMatchObject({ bakongId: "sokha@aclb", readiness: { khqrReady: true } });
  });

  it("gives the logo's address and keeps the raw columns to itself", () => {
    const details = toStoreDetails(rows({}, { logoKey: "stores/store-1/logo.jpg" }), photoUrl);
    expect(details.logoUrl).toBe("https://files.test/stores/store-1/logo.jpg");
    expect(details).not.toHaveProperty("deliveryConfiguredAt");
    expect(details).not.toHaveProperty("linkSharedAt");
  });
});

describe("sharing the shop link", () => {
  it("is allowed once there's a product with a photo, a phone, delivery and a way to pay", () => {
    expect(isReadyToShare(toStoreDetails(rows(), photoUrl))).toBe(true);
  });

  it("waits for delivery to be saved, and for some way to pay", () => {
    expect(isReadyToShare(toStoreDetails(rows({}, { deliveryConfiguredAt: null }), photoUrl))).toBe(false);
    expect(isReadyToShare(toStoreDetails(rows({}, { allowCod: false }), photoUrl))).toBe(false);
    expect(isReadyToShare(toStoreDetails(rows({ bakongId: "sokha@aclb" }, { allowCod: false }), photoUrl))).toBe(true);
  });

  it("asks a service shop for a priced product, not a photo", () => {
    expect(isReadyToShare(toStoreDetails(rows({ productsWithPhoto: 0 }), photoUrl))).toBe(false);
    expect(isReadyToShare(toStoreDetails(rows({ productsWithPhoto: 0 }, { businessType: "service" }), photoUrl))).toBe(true);
  });
});

describe("switching pickup on Shop details", () => {
  const noOtherWay = { ...SUGGESTED_DELIVERY_SETTINGS, zones: [], province: { ...SUGGESTED_DELIVERY_SETTINGS.province, enabled: false } };

  it("refuses to switch off the shop's last way to get an order", () => {
    expect(pickupSwitchProblem({ settings: noOtherWay, configured: true }, false)).toBe("delivery_required");
    expect(pickupSwitchProblem({ settings: noOtherWay, configured: true }, true)).toBeUndefined();
  });

  it("lets it go when delivery or provinces still work", () => {
    expect(pickupSwitchProblem({ settings: SUGGESTED_DELIVERY_SETTINGS, configured: true }, false)).toBeUndefined();
  });

  it("doesn't block a shop that hasn't set up delivery yet", () => {
    expect(pickupSwitchProblem({ settings: noOtherWay, configured: false }, false)).toBeUndefined();
  });
});

describe("the audit entry for prices and tax", () => {
  const saved = { defaultCurrency: "USD" as const, usdToKhrRate: 4100, allowCod: true, vatPercent: 0 };

  it("is written when what buyers pay could change", () => {
    expect(storeSettingsChanged(saved, { ...saved, usdToKhrRate: 4050 })).toBe(true);
    expect(storeSettingsChanged(saved, { ...saved, vatPercent: 10 })).toBe(true);
    expect(storeSettingsChanged(saved, { ...saved, allowCod: false })).toBe(true);
    expect(storeSettingsChanged(saved, { ...saved, defaultCurrency: "KHR" })).toBe(true);
  });

  it("is left out when only the shop's other details were saved", () => {
    expect(storeSettingsChanged(saved, { ...saved })).toBe(false);
  });
});

describe("the details page's rate box", () => {
  it("gets today's allowed band, cash on delivery and VAT with the details", () => {
    expect(toStoreDetails(rows(), photoUrl)).toMatchObject({ rateBand: { min: 3900, max: 4300 }, allowCod: true, vatPercent: 0 });
  });
});

describe("the payment QR on the details page", () => {
  it("gives the picture's address, not its storage key, and none when there isn't one", () => {
    expect(toStoreDetails(rows({}, { paymentQrKey: "stores/store-1/qr.jpg" }), photoUrl)).toMatchObject({ paymentQrKey: "stores/store-1/qr.jpg", paymentQrUrl: "https://files.test/stores/store-1/qr.jpg" });
    expect(toStoreDetails(rows(), photoUrl)).toMatchObject({ paymentQrKey: null, paymentQrUrl: null });
  });
});
