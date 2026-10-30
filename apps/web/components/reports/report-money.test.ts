import { describe, expect, it } from "vitest";
import { chartAmount, moneyLines, oneAmount } from "./report-money";

describe("a report's money", () => {
  it("each currency apart: the shop's first, the other under it; only the other: it leads", () => {
    expect(moneyLines({ USD: 150_000, KHR: 40_000 }, "USD", null, 4000)).toEqual({ main: "$1,500.00", other: "40,000៛" });
    expect(moneyLines({ USD: 0, KHR: 40_000 }, "USD", null, 4000)).toEqual({ main: "40,000៛", other: null });
    expect(moneyLines({ USD: 0, KHR: 0 }, "USD", null, 4000)).toEqual({ main: "$0.00", other: null });
  });

  it("in one currency: both turned at the shop's rate, marked ≈ only when something was turned", () => {
    expect(moneyLines({ USD: 150_000, KHR: 40_000 }, "USD", "USD", 4000)).toEqual({ main: "≈ $1,510.00", other: null });
    expect(moneyLines({ USD: 150_000, KHR: 0 }, "USD", "USD", 4000).main).toBe("$1,500.00");
  });

  it("writes a sign when asked: a loss with −, a gain with +, nothing with none", () => {
    expect(moneyLines({ USD: -6800, KHR: 0 }, "USD", null, 4000, true).main).toBe("−$68.00");
    expect(moneyLines({ USD: 8400, KHR: 0 }, "USD", null, 4000, true).main).toBe("+$84.00");
    expect(moneyLines({ USD: 0, KHR: 0 }, "USD", null, 4000, true).main).toBe("$0.00");
  });

  it("one item's worth: as it is, or turned into the currency shown", () => {
    expect(oneAmount(40_000, "KHR", null, 4000)).toBe("40,000៛");
    expect(oneAmount(40_000, "KHR", "USD", 4000)).toBe("≈ $10.00");
  });

  it("a chart's amount: the shop's currency only, or both turned into the one shown", () => {
    expect(chartAmount({ USD: 1000, KHR: 40_000 }, "USD", null, 4000)).toBe(1000);
    expect(chartAmount({ USD: 1000, KHR: 40_000 }, "USD", "USD", 4000)).toBe(2000);
    expect(chartAmount({ USD: 1000, KHR: 40_000 }, "USD", "KHR", 4000)).toBe(80_000);
  });
});
