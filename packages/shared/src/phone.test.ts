import { describe, expect, it } from "vitest";
import { maskKhmerPhone, normalizeKhmerPhone } from "./phone";

describe("normalizeKhmerPhone", () => {
  it("normalizes a 9-digit number with leading 0", () => {
    expect(normalizeKhmerPhone("012 345 678")).toBe("85512345678");
  });

  it("normalizes a 10-digit number with leading 0", () => {
    expect(normalizeKhmerPhone("097 123 4567")).toBe("855971234567");
  });

  it("normalizes a +855 prefixed number", () => {
    expect(normalizeKhmerPhone("+855 97 123 4567")).toBe("855971234567");
  });

  it("normalizes a bare 855-prefixed number", () => {
    expect(normalizeKhmerPhone("855971234567")).toBe("855971234567");
  });

  it("rejects too few digits", () => {
    expect(normalizeKhmerPhone("012 34")).toBeNull();
  });
});

describe("maskKhmerPhone", () => {
  it("hides the middle and keeps the ends", () => {
    expect(maskKhmerPhone("85512345678")).toBe("012 ••• 678");
    expect(maskKhmerPhone("855971234567")).toBe("097 ••• 4567");
  });
});
