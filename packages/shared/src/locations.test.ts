import { describe, expect, it } from "vitest";
import { mapSearchUrl, shopMapLink } from "./locations";

describe("mapSearchUrl", () => {
  it("searches the map for the shop's address, Khmer included", () => {
    expect(mapSearchUrl(" No. 12, Street 302 ")).toBe("https://www.google.com/maps/search/?api=1&query=No.%2012%2C%20Street%20302");
    expect(mapSearchUrl("ផ្លូវ 302")).toContain("query=%E1%9E");
  });

  it("gives nothing without an address", () => {
    expect(mapSearchUrl("   ")).toBeNull();
  });
});

describe("shopMapLink", () => {
  it("opens the seller's own map link first, then searches the address", () => {
    expect(shopMapLink(" https://maps.app.goo.gl/abc ", "St. 240")).toBe("https://maps.app.goo.gl/abc");
    expect(shopMapLink("", "St. 240")).toBe("https://www.google.com/maps/search/?api=1&query=St.%20240");
    expect(shopMapLink("", "")).toBeNull();
  });
});
