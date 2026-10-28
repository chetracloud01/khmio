import { describe, expect, it } from "vitest";
import { formatMoney } from "../order-ui";
import { spentLines } from "./spent";

describe("what a customer spent", () => {
  it("shows the shop's main currency first, then the other only when they paid in it", () => {
    expect(spentLines({ USD: 2450, KHR: 48000 }, "USD")).toEqual([formatMoney(2450, "USD"), formatMoney(48000, "KHR")]);
    expect(spentLines({ USD: 2450, KHR: 48000 }, "KHR")).toEqual([formatMoney(48000, "KHR"), formatMoney(2450, "USD")]);
    expect(spentLines({ USD: 2450, KHR: 0 }, "USD")).toEqual([formatMoney(2450, "USD")]);
  });

  it("puts a riel-only customer's riel first, even in a dollar shop", () => {
    expect(spentLines({ USD: 0, KHR: 62000 }, "USD")).toEqual([formatMoney(62000, "KHR")]);
  });

  it("shows zero in the main currency when nothing counts yet", () => {
    expect(spentLines({ USD: 0, KHR: 0 }, "KHR")).toEqual([formatMoney(0, "KHR")]);
  });
});
