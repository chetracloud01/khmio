import { describe, expect, it } from "vitest";
import { formatDocumentNumber, parseDocumentNumber } from "./documents";

describe("document numbers", () => {
  it("print with their prefix, padded to four digits, growing past them", () => {
    expect(formatDocumentNumber("bill", 7)).toBe("BILL-0007");
    expect(formatDocumentNumber("return", 1)).toBe("RET-0001");
    expect(formatDocumentNumber("payment", 12345)).toBe("PAY-12345");
  });

  it("are found however they're typed", () => {
    expect(parseDocumentNumber("BILL-0007")).toEqual({ series: "bill", number: 7 });
    expect(parseDocumentNumber("bill 7")).toEqual({ series: "bill", number: 7 });
    expect(parseDocumentNumber("ret-12")).toEqual({ series: "return", number: 12 });
    expect(parseDocumentNumber("#7")).toEqual({ series: null, number: 7 });
    expect(parseDocumentNumber(" 0007 ")).toEqual({ series: null, number: 7 });
  });

  it("leave other text to the text search", () => {
    expect(parseDocumentNumber("INV-77")).toBeNull();
    expect(parseDocumentNumber("Chhay")).toBeNull();
    expect(parseDocumentNumber("")).toBeNull();
  });
});
