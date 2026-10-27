import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES } from "./business";
import { BUSINESS_TYPE_MODULES, hasModule, storeModulesInputSchema } from "./business-modules";

describe("business modules", () => {
  it("gives every kind of business a starting set", () => {
    for (const type of BUSINESS_TYPES) expect(BUSINESS_TYPE_MODULES[type].length).toBeGreaterThan(0);
    expect(hasModule(BUSINESS_TYPE_MODULES.restaurant, "choices")).toBe(true);
    expect(hasModule(BUSINESS_TYPE_MODULES.garage, "jobCards")).toBe(true);
    expect(hasModule(BUSINESS_TYPE_MODULES.shop, "tables")).toBe(false);
  });

  it("saves each module once, in a fixed order, and nothing unknown", () => {
    expect(storeModulesInputSchema.parse({ modules: ["tables", "options", "tables"] }).modules).toEqual(["options", "tables"]);
    expect(storeModulesInputSchema.parse({ modules: [] }).modules).toEqual([]);
    expect(storeModulesInputSchema.safeParse({ modules: ["accounting"] }).success).toBe(false);
  });
});
