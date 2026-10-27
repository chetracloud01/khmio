import { afterEach, describe, expect, it, vi } from "vitest";
import { readBuyerDetails, saveBuyerDetails } from "./cart";

function stubStorage(kept: Record<string, string> = {}) {
  const items = new Map(Object.entries(kept));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    },
  });
  return items;
}

describe("the buyer's remembered details", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("are empty, and not remembered, on a new phone", () => {
    stubStorage();
    expect(readBuyerDetails()).toEqual({
      details: { name: "", phone: "", fulfilment: "delivery", area: "phnom_penh", districtId: "", provinceId: "", landmark: "" },
      remembered: false,
    });
  });

  it("fill in what they can when kept by an older version, field by field", () => {
    stubStorage({ "khmio:buyer": JSON.stringify({ name: "Sokha", phone: 12345, fulfilment: "drone", area: "province" }) });
    expect(readBuyerDetails()).toEqual({
      details: { name: "Sokha", phone: "", fulfilment: "delivery", area: "province", districtId: "", provinceId: "", landmark: "" },
      remembered: true,
    });
  });

  it("are forgotten when the buyer unticks Remember", () => {
    const items = stubStorage({ "khmio:buyer": "{}" });
    saveBuyerDetails({ name: "Sokha", phone: "85512345678", fulfilment: "pickup", area: "phnom_penh", districtId: "", provinceId: "", landmark: "" }, false);
    expect(items.has("khmio:buyer")).toBe(false);
  });
});
