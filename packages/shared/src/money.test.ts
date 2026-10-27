import { describe, expect, it } from "vitest";
import { formatKhr, formatUsd, khrInputText, khrTextFromUsdText, usdInputText, usdTextFromKhrText } from "./money";

describe("money formatting", () => {
  it("formats USD cents", () => {
    expect(formatUsd(850)).toBe("$8.50");
  });

  it("groups thousands in USD like KHR", () => {
    expect(formatUsd(190450)).toBe("$1,904.50");
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("formats KHR riel with the currency symbol", () => {
    expect(formatKhr(34850)).toBe("34,850៛");
  });
});

describe("price box text", () => {
  it("shows a saved price in its box, and nothing when there is none", () => {
    expect(usdInputText(850)).toBe("8.50");
    expect(usdInputText(0)).toBe("0.00");
    expect(usdInputText(null)).toBe("");
    expect(khrInputText(34850)).toBe("34850");
    expect(khrInputText(undefined)).toBe("");
  });

  it("fills the other currency at the store's rate", () => {
    expect(khrTextFromUsdText("8.50", 4100)).toBe("34850");
    expect(usdTextFromKhrText("4100", 4100)).toBe("1.00");
    expect(usdTextFromKhrText("1000", 4100)).toBe("0.24");
  });

  it("fills nothing from a blank box or a typo", () => {
    expect(khrTextFromUsdText("", 4100)).toBeUndefined();
    expect(khrTextFromUsdText("8.505", 4100)).toBeUndefined();
    expect(usdTextFromKhrText("abc", 4100)).toBeUndefined();
  });
});
