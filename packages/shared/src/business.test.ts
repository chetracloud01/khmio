import { describe, expect, it } from "vitest";
import { BUSINESS_TYPE_DEFAULTS, BUSINESS_TYPES, DEFAULT_UNITS, OFFERED_BUSINESS_TYPES } from "./business";

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

describe("business types offered (garage first)", () => {
  it("offers the garage, and only real business types, each once", () => {
    expect(OFFERED_BUSINESS_TYPES).toContain("garage");
    expect(OFFERED_BUSINESS_TYPES.every((type) => BUSINESS_TYPES.includes(type))).toBe(true);
    expect(new Set(OFFERED_BUSINESS_TYPES).size).toBe(OFFERED_BUSINESS_TYPES.length);
  });
});
