import { describe, expect, it } from "vitest";
import { applyAdminOverride, canAddProduct, canChangePlan, effectivePlan, getAmountDueForPlanChange, getMinimumPlanFor, getMinimumPlanForProductCount, getPlanPrice, getUpgradeProrationAmount, isStorefrontOpen, isUpgrade, planHasFeature, planIdSchema } from "./plans";

describe("plan features", () => {
  it("matches the blueprint tier table", () => {
    expect(planHasFeature("free", "stock")).toBe(false);
    expect(planHasFeature("basic", "stock")).toBe(false);
    expect(planHasFeature("basic", "wholesalePrice")).toBe(false);
    expect(planHasFeature("pro", "stock")).toBe(true);
    expect(planHasFeature("pro", "wholesalePrice")).toBe(true);
    expect(planHasFeature("pro", "warehouses")).toBe(false);
    expect(planHasFeature("advance", "warehouses")).toBe(true);
  });
});

describe("minimum plan for a feature", () => {
  it("points upgrade prompts at the cheapest plan that unlocks it", () => {
    expect(getMinimumPlanFor("stock")).toBe("pro");
    expect(getMinimumPlanFor("wholesalePrice")).toBe("pro");
    expect(getMinimumPlanFor("warehouses")).toBe("advance");
    expect(getMinimumPlanFor("counterSales")).toBe("basic");
  });
});

describe("product limit", () => {
  it("caps Free at 10 products", () => {
    expect(canAddProduct("free", 9)).toBe(true);
    expect(canAddProduct("free", 10)).toBe(false);
  });

  it("is unlimited on paid plans", () => {
    expect(canAddProduct("basic", 5000)).toBe(true);
  });

  it("offers the cheapest plan with room for one more", () => {
    expect(getMinimumPlanForProductCount(3)).toBe("free");
    expect(getMinimumPlanForProductCount(10)).toBe("basic");
  });
});

describe("prices", () => {
  it("uses the fixed price for each currency, never a conversion", () => {
    expect(getPlanPrice("pro", "USD")).toBe(1200);
    expect(getPlanPrice("pro", "KHR")).toBe(48000);
  });
});

describe("plan changes", () => {
  it("orders plans from lowest to highest", () => {
    expect(isUpgrade("basic", "advance")).toBe(true);
    expect(isUpgrade("advance", "pro")).toBe(false);
  });

  it("never allows moving to Free or staying on the same plan", () => {
    expect(canChangePlan("free", "basic")).toBe(true);
    expect(canChangePlan("pro", "basic")).toBe(true);
    expect(canChangePlan("basic", "free")).toBe(false);
    expect(canChangePlan("pro", "pro")).toBe(false);
  });

  it("rejects unknown plan names at the input boundary", () => {
    expect(planIdSchema.safeParse("enterprise").success).toBe(false);
  });
});

describe("upgrade proration", () => {
  it("charges the price difference for the days left", () => {
    expect(getUpgradeProrationAmount("basic", "pro", "USD", 15)).toBe(350);
    expect(getUpgradeProrationAmount("basic", "pro", "KHR", 15)).toBe(14000);
  });

  it("rounds to a whole cent", () => {
    // 700 × 1 ÷ 30 = 23.33…
    expect(getUpgradeProrationAmount("basic", "pro", "USD", 1)).toBe(23);
  });

  it("charges nothing now for a downgrade", () => {
    expect(getUpgradeProrationAmount("advance", "basic", "USD", 20)).toBe(0);
  });

  it("rejects an impossible number of days", () => {
    expect(() => getUpgradeProrationAmount("basic", "pro", "USD", 31)).toThrow(RangeError);
    expect(() => getUpgradeProrationAmount("basic", "pro", "USD", 2.5)).toThrow(RangeError);
  });
});

describe("amount due for a plan change", () => {
  it("charges a full month when leaving the Free trial", () => {
    expect(getAmountDueForPlanChange("free", "pro", "USD", 9)).toBe(1200);
    expect(getAmountDueForPlanChange("free", "basic", "KHR", 0)).toBe(20000);
  });

  it("prorates an upgrade between paid plans", () => {
    expect(getAmountDueForPlanChange("basic", "pro", "USD", 15)).toBe(350);
  });

  it("charges nothing for a downgrade or a disallowed change", () => {
    expect(getAmountDueForPlanChange("advance", "basic", "USD", 20)).toBe(0);
    expect(getAmountDueForPlanChange("pro", "free", "USD", 20)).toBe(0);
  });
});

describe("admin override", () => {
  it("starts a fresh period when moving a trial or paused store to a paid plan", () => {
    expect(applyAdminOverride({ plan: "free", status: "trialing", daysLeft: 3 }, { kind: "setPlan", plan: "pro" })).toEqual(
      { plan: "pro", status: "active", daysLeft: 30 },
    );
    expect(applyAdminOverride({ plan: "basic", status: "paused", daysLeft: 0 }, { kind: "setPlan", plan: "advance" }))
      .toEqual({ plan: "advance", status: "active", daysLeft: 30 });
  });

  it("keeps the period and status of an active or overdue store", () => {
    expect(applyAdminOverride({ plan: "basic", status: "grace", daysLeft: 4 }, { kind: "setPlan", plan: "pro" })).toEqual(
      { plan: "pro", status: "grace", daysLeft: 4 },
    );
  });

  it("never moves a store to Free", () => {
    expect(() => applyAdminOverride({ plan: "pro", status: "active", daysLeft: 9 }, { kind: "setPlan", plan: "free" }))
      .toThrow(RangeError);
  });

  it("adds days, and reopens a paused or overdue store for exactly those days", () => {
    expect(applyAdminOverride({ plan: "pro", status: "active", daysLeft: 9 }, { kind: "extend", days: 30 }).daysLeft).toBe(39);
    expect(applyAdminOverride({ plan: "pro", status: "paused", daysLeft: 0 }, { kind: "extend", days: 7 })).toEqual(
      { plan: "pro", status: "active", daysLeft: 7 },
    );
    expect(applyAdminOverride({ plan: "free", status: "paused", daysLeft: 0 }, { kind: "extend", days: 7 }).status).toBe(
      "trialing",
    );
  });

  it("rejects impossible extensions", () => {
    expect(() => applyAdminOverride({ plan: "pro", status: "active", daysLeft: 9 }, { kind: "extend", days: 0 })).toThrow(
      RangeError,
    );
    expect(() => applyAdminOverride({ plan: "pro", status: "active", daysLeft: 9 }, { kind: "extend", days: 366 }))
      .toThrow(RangeError);
  });
});

describe("storefront", () => {
  it("closes only when the subscription is paused", () => {
    expect(isStorefrontOpen("grace")).toBe(true);
    expect(isStorefrontOpen("paused")).toBe(false);
  });
});

describe("Release 1 beta", () => {
  it("treats a Free trial shop as Basic while the beta setting is on", () => {
    expect(effectivePlan("free", true)).toBe("basic");
    expect(canAddProduct(effectivePlan("free", true), 500)).toBe(true);
  });

  it("goes back to the plan's own limits when the setting is off", () => {
    expect(effectivePlan("free", false)).toBe("free");
    expect(canAddProduct(effectivePlan("free", false), 10)).toBe(false);
  });

  it("never lowers a paid plan", () => {
    expect(effectivePlan("pro", true)).toBe("pro");
    expect(effectivePlan("advance", false)).toBe("advance");
  });
});
