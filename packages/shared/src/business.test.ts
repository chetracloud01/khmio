import { describe, expect, it } from "vitest";
import { BUSINESS_TYPE_DEFAULTS, BUSINESS_TYPES, DEFAULT_UNITS } from "./business";

describe("business type defaults", () => {
  it("gives every type a unit every store has, and at least one category", () => {
    const unitKeys = DEFAULT_UNITS.map((unit) => unit.key);
    for (const type of BUSINESS_TYPES) {
      expect(unitKeys).toContain(BUSINESS_TYPE_DEFAULTS[type].unitKey);
      expect(BUSINESS_TYPE_DEFAULTS[type].categories.length).toBeGreaterThan(0);
    }
  });

  it("starts a garage with cars, parts and workshop services, and the units they sell by", () => {
    const keys = BUSINESS_TYPE_DEFAULTS.garage.categories.map((category) => category.key);
    expect(keys).toEqual(expect.arrayContaining(["cars", "engine-oil", "tyres", "batteries", "parts", "services"]));
    expect(DEFAULT_UNITS.map((unit) => unit.key)).toEqual(expect.arrayContaining(["litre", "set", "vehicle"]));
  });
});
