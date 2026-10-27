import { describe, expect, it } from "vitest";
import { pathInLocale } from "./locale-path";

describe("the same page in another language", () => {
  it("swaps the language and keeps the rest of the address, query included", () => {
    expect(pathInLocale("/km/m/orders?tab=packing", "en")).toBe("/en/m/orders?tab=packing");
    expect(pathInLocale("/en/s/srey-neang", "km")).toBe("/km/s/srey-neang");
    expect(pathInLocale("/en", "km")).toBe("/km");
  });

  it("only reads a whole first segment as the language", () => {
    expect(pathInLocale("/enroll", "km")).toBe("/km/enroll");
    expect(pathInLocale("/km-shop/x", "en")).toBe("/en/km-shop/x");
  });

  it("adds the language to an address without one", () => {
    expect(pathInLocale("/", "en")).toBe("/en");
  });
});
