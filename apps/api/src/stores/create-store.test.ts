import { BUSINESS_TYPE_DEFAULTS, DAY_MS, DEFAULT_UNITS, FREE_TRIAL_DAYS } from "@khmio/shared";
import { describe, expect, it } from "vitest";
import { newShopData, usableSlug } from "./create-store";

const now = new Date("2026-10-23T03:00:00Z");

describe("a new shop", () => {
  const shop = newShopData("store-1", "merchant-1", { slug: "sokha-coffee", shopName: "Sokha Coffee", businessType: "restaurant" }, now);

  it("belongs to the merchant who made it, as owner", () => {
    expect(shop.members).toEqual({ create: { merchantId: "merchant-1", role: "owner" } });
  });

  it("starts on the Free trial for the days plans.ts gives", () => {
    expect(shop.subscription.create).toMatchObject({ plan: "free", status: "trialing", currentPeriodStart: now });
    expect(shop.subscription.create.trialEndsAt.getTime() - now.getTime()).toBe(FREE_TRIAL_DAYS * DAY_MS);
  });

  it("gets its business type's categories in order, and the standard units", () => {
    expect(shop.categories.create.map((category) => category.nameEn)).toEqual(BUSINESS_TYPE_DEFAULTS.restaurant.categories.map((category) => category.nameEn));
    expect(shop.categories.create.map((category) => category.sortOrder)).toEqual(BUSINESS_TYPE_DEFAULTS.restaurant.categories.map((_, index) => index));
    expect(shop.units.create).toHaveLength(DEFAULT_UNITS.length);
  });
});

describe("a shop link", () => {
  it("may be any well-formed link Khmio doesn't keep for itself", () => {
    expect(usableSlug("sokha-coffee")).toBe("sokha-coffee");
    expect(usableSlug("admin")).toBeNull();
    expect(usableSlug("Not A Link!")).toBeNull();
    expect(usableSlug(undefined)).toBeNull();
  });
});
