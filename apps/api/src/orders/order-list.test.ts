import { describe, expect, it } from "vitest";
import { orderSearchWhere, parseOrderListQuery } from "./order-list";

describe("order list search", () => {
  it("searches nothing for an empty box", () => {
    expect(orderSearchWhere("  ")).toBeNull();
  });

  it("finds a buyer by name in any case", () => {
    expect(orderSearchWhere("sophea")).toEqual({ OR: [{ buyerName: { contains: "sophea", mode: "insensitive" } }] });
  });

  it("reads a phone however it was typed, and a number as an order number too", () => {
    const where = orderSearchWhere("012 345 678");
    expect(where?.OR).toContainEqual({ buyerPhone: { contains: "12345678" } });
    expect(orderSearchWhere("+855 12 345 678")?.OR).toContainEqual({ buyerPhone: { contains: "12345678" } });
    expect(orderSearchWhere("16")?.OR).toContainEqual({ orderNumber: 16 });
  });

  it("finds a tracking code with or without the shop part", () => {
    expect(orderSearchWhere("MEK-7K4P-9QXR")?.OR).toContainEqual({ trackingCode: "7K4P9QXR" });
    expect(orderSearchWhere("7k4p9qxr")?.OR).toContainEqual({ trackingCode: "7K4P9QXR" });
  });
});

describe("order list query", () => {
  it("accepts the tabs and filters the list declares", () => {
    expect(parseOrderListQuery({ chip: "packing", "f.payment": "cod", sort: "total", dir: "asc" })).toMatchObject({ chip: "packing", filters: { payment: "cod" }, sort: "total" });
  });

  it("refuses anything else", () => {
    expect(() => parseOrderListQuery({ sort: "buyerPhone" })).toThrow();
    expect(() => parseOrderListQuery({ "f.storeId": "x" })).toThrow();
  });
});
