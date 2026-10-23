import { describe, expect, it } from "vitest";
import { planInForce } from "./plan";

describe("the plan in force", () => {
  it("is Free for a shop with no subscription row", () => {
    expect(planInForce(null, { betaAllBasic: false })).toEqual({ plan: "free", paused: false });
  });

  it("gives Free shops Basic's limits while the beta switch is on, and nothing else changes", () => {
    expect(planInForce({ plan: "free", status: "trialing" }, { betaAllBasic: true })).toEqual({ plan: "basic", paused: false });
    expect(planInForce({ plan: "pro", status: "active" }, { betaAllBasic: true })).toEqual({ plan: "pro", paused: false });
  });

  it("locks only a paused shop; one in its grace days can still change things", () => {
    expect(planInForce({ plan: "basic", status: "paused" }, null).paused).toBe(true);
    expect(planInForce({ plan: "basic", status: "grace" }, null).paused).toBe(false);
  });
});
