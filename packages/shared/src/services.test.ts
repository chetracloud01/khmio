import { describe, expect, it } from "vitest";
import { bookingProblem, getOrderQuote, isServiceOnly, MAX_BOOKING_DAYS_AHEAD } from "./services";

const now = new Date("2026-10-27T03:00:00Z");
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000).toISOString();
const settings = { zones: [], pickup: { enabled: false, address: "", hours: "" }, province: { enabled: false, note: "" }, drivers: [] };

describe("services", () => {
  it("make a cart service-only only when every line is a service", () => {
    expect(isServiceOnly(["service", "service"])).toBe(true);
    expect(isServiceOnly(["service", "item"])).toBe(false);
    expect(isServiceOnly([])).toBe(false);
  });

  it("need a preferred time that hasn't passed and isn't too far ahead", () => {
    expect(bookingProblem(undefined, now)).toBe("required");
    expect(bookingProblem("next tuesday", now)).toBe("date_invalid");
    expect(bookingProblem(hours(-1), now)).toBe("booking_in_past");
    expect(bookingProblem(hours((MAX_BOOKING_DAYS_AHEAD + 1) * 24), now)).toBe("booking_too_far");
    expect(bookingProblem(hours(26), now)).toBeNull();
  });

  it("can always be done at the shop, free, even when the shop doesn't offer pickup of goods", () => {
    const atShop = { fulfilment: "pickup" as const, area: "phnom_penh" as const };
    expect(getOrderQuote(settings, atShop, true)).toEqual({ status: "ok", fee: {} });
    expect(getOrderQuote(settings, atShop, false)).toEqual({ status: "unavailable" });
  });
});
