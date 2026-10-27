import { describe, expect, it } from "vitest";
import { phnomPenhDay, phnomPenhTime, startOfPhnomPenhDay } from "./time";

describe("Phnom Penh time", () => {
  it("is seven hours ahead of UTC, all year", () => {
    expect(phnomPenhTime("2026-01-15T03:04:00Z")).toEqual({ year: 2026, month: 1, day: 15, hour: 10, minute: 4, dayKey: "2026-01-15", clock: "10:04" });
    expect(phnomPenhTime("2026-07-15T03:04:00Z").hour).toBe(10);
  });

  it("starts the new day at 17:00 UTC, so a late-evening order counts for the next day", () => {
    expect(phnomPenhDay("2026-10-22T16:59:00Z")).toBe("2026-10-22");
    expect(phnomPenhDay("2026-10-22T17:00:00Z")).toBe("2026-10-23");
    expect(phnomPenhTime("2026-12-31T18:30:00Z")).toMatchObject({ year: 2027, month: 1, day: 1, clock: "01:30" });
  });

  it("starts the day at midnight Phnom Penh time, which is 17:00 UTC the day before", () => {
    expect(startOfPhnomPenhDay("2026-10-23T02:00:00Z").toISOString()).toBe("2026-10-22T17:00:00.000Z");
    expect(startOfPhnomPenhDay("2026-10-22T18:00:00Z").toISOString()).toBe("2026-10-22T17:00:00.000Z");
  });

  it("takes a Date as well as an ISO time", () => {
    expect(phnomPenhDay(new Date("2026-10-22T17:00:00Z"))).toBe("2026-10-23");
  });
});
