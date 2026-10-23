import { describe, expect, it } from "vitest";
import { backToShopHref, shopFromSearch, withShop } from "./buyer-back";

describe("back to the shop from My orders and Track my order", () => {
  it("carries the shop in the address", () => {
    expect(withShop("/km/orders", "mekong-auto-garage")).toBe("/km/orders?shop=mekong-auto-garage");
    expect(withShop("/km/track", null)).toBe("/km/track");
  });

  it("reads back only a real shop link", () => {
    expect(shopFromSearch("?shop=mekong-auto-garage")).toBe("mekong-auto-garage");
    expect(shopFromSearch("?shop=https://evil.example")).toBeNull();
    expect(shopFromSearch("?shop=../admin")).toBeNull();
    expect(shopFromSearch("")).toBeNull();
  });

  it("goes to the shop it came from, else the latest order's shop, else home", () => {
    expect(backToShopHref("en", "sokha-coffee", "mekong-auto-garage")).toBe("/en/s/sokha-coffee");
    expect(backToShopHref("en", null, "mekong-auto-garage")).toBe("/en/s/mekong-auto-garage");
    expect(backToShopHref("en", null, null)).toBe("/en");
  });
});
