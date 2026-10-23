import { describe, expect, it } from "vitest";
import { toCatalog } from "./catalog";

const unit = (id: string, key: string | null) => ({ id, nameKm: id, nameEn: id, key });

describe("the product form's lists", () => {
  it("starts new products with the business type's own unit", () => {
    const units = [unit("u-piece", "piece"), unit("u-plate", "plate")];
    expect(toCatalog("shop", [], [], units).defaultUnitId).toBe("u-piece");
    expect(toCatalog("restaurant", [], [], units).defaultUnitId).toBe("u-plate");
  });

  it("falls back to the first unit when the shop has removed or renamed its default, and to none without units", () => {
    expect(toCatalog("restaurant", [], [], [unit("u-own", null)]).defaultUnitId).toBe("u-own");
    expect(toCatalog("restaurant", [], [], []).defaultUnitId).toBeNull();
  });

  it("keeps the units' internal keys to itself", () => {
    expect(toCatalog("shop", [], [], [unit("u-piece", "piece")]).units).toEqual([{ id: "u-piece", nameKm: "u-piece", nameEn: "u-piece" }]);
  });
});
