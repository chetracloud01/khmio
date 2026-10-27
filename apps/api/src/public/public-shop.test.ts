import { describe, expect, it } from "vitest";
import { photoUrl, productRow } from "../testing/rows";
import { toPublicShop, type PublicShopRows } from "./public-shop";

const rows = (overrides: Partial<PublicShopRows> = {}): PublicShopRows => ({
  store: {
    slug: "sokha-coffee",
    name: "Sokha Coffee",
    businessType: "restaurant",
    phone: "85512345678",
    area: "phnom_penh",
    description: "",
    logoKey: "stores/store-1/logo.jpg",
    defaultCurrency: "USD",
    usdToKhrRate: 4100,
    allowCod: true,
    vatPercent: 0,
    telegramLink: "t.me/sokhacoffee",
    facebookLink: "",
    mapUrl: "https://maps.app.goo.gl/abc",
  },
  categories: [{ id: "category-1", nameKm: "ភេសជ្ជៈ", nameEn: "Drinks" }],
  products: [productRow()],
  delivery: {
    settings: {
      zones: [{ id: "zone-1", name: "Central", districtIds: ["daun-penh"], feeUsdCents: 100 }],
      pickup: { enabled: true, address: "St. 240", hours: "7–17" },
      province: { enabled: false, note: "" },
      drivers: [{ id: "driver-1", name: "Dara", phone: "85512345678", kind: "own" }],
    },
    configured: true,
  },
  open: true,
  stock: {},
  khqrReady: false,
  ...overrides,
});

describe("the buyer's shop page", () => {
  it("never shows wholesale prices", () => {
    const [variant] = toPublicShop(rows(), photoUrl).products[0]!.variants;
    expect(variant).not.toHaveProperty("wholesalePriceUsdCents");
    expect(variant).not.toHaveProperty("wholesalePriceKhr");
    expect(variant?.priceUsdCents).toBe(250);
  });

  it("never sends the drivers, only zones, pickup and provinces", () => {
    const shop = toPublicShop(rows(), photoUrl);
    expect(shop.delivery).not.toHaveProperty("drivers");
    expect(Object.keys(shop.delivery)).toEqual(["zones", "pickup", "province"]);
  });

  it("gives the logo's address, not its storage key", () => {
    expect(toPublicShop(rows(), photoUrl).store).toMatchObject({ logoUrl: "https://files.test/stores/store-1/logo.jpg" });
    expect(toPublicShop(rows(), photoUrl).store).not.toHaveProperty("logoKey");
    expect(toPublicShop(rows({ store: { ...rows().store, logoKey: null } }), photoUrl).store.logoUrl).toBeNull();
  });

  it("gives the shop's Telegram and Facebook as the seller typed them, never its tax number or invoice note", () => {
    const { store } = toPublicShop(rows(), photoUrl);
    expect(store).toMatchObject({ telegramLink: "t.me/sokhacoffee", facebookLink: "" });
    expect(store).not.toHaveProperty("taxNumber");
    expect(store).not.toHaveProperty("invoiceNote");
  });

  it("says whether it can take orders: delivery saved, and not paused", () => {
    expect(toPublicShop(rows(), photoUrl)).toMatchObject({ ordering: { deliveryConfigured: true, khqrReady: false }, open: true });
    expect(toPublicShop(rows({ open: false, delivery: { ...rows().delivery, configured: false } }), photoUrl)).toMatchObject({ ordering: { deliveryConfigured: false }, open: false });
  });
});

describe("KHQR on the shop page", () => {
  it("is offered only when the API says the shop can take it", () => {
    expect(toPublicShop(rows(), photoUrl).ordering.khqrReady).toBe(false);
    expect(toPublicShop(rows({ khqrReady: true }), photoUrl).ordering.khqrReady).toBe(true);
  });
});

describe("stock on the shop page", () => {
  it("sends free stock only for tracked options, as counted", () => {
    expect(toPublicShop(rows({ stock: { "variant-1": 3 } }), photoUrl).stock).toEqual({ "variant-1": 3 });
    expect(toPublicShop(rows(), photoUrl).stock).toEqual({});
  });
});
