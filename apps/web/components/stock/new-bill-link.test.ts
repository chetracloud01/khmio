import { describe, expect, it } from "vitest";
import { billLinesFromAddress, billSupplierFromAddress, newBillHref } from "./new-bill-link";

const id = (n: number) => `0b9f3c3e-1d2a-4c1f-9a51-${String(n).padStart(12, "0")}`;

describe("Create bill from the Stock list", () => {
  it("carries each item at its suggested order, and the supplier they share", () => {
    const href = newBillHref("en", [
      { variantId: id(1), suggested: 9, lastSupplierId: id(7) },
      { variantId: id(2), suggested: null, lastSupplierId: id(7) },
    ]);
    const address = new URL(href, "http://shop");
    expect(address.pathname).toBe("/en/m/purchases/new");
    expect(billLinesFromAddress(address.searchParams.get("lines"))).toEqual([{ variantId: id(1), quantity: 9 }, { variantId: id(2), quantity: 1 }]);
    expect(billSupplierFromAddress(address.searchParams.get("supplier"))).toBe(id(7));
  });

  it("leaves the supplier out when the items come from different ones", () => {
    expect(newBillHref("en", [{ variantId: id(1), suggested: 1, lastSupplierId: id(7) }, { variantId: id(2), suggested: 1, lastSupplierId: null }])).not.toContain("supplier=");
  });

  it("drops anything in the address that isn't a line", () => {
    expect(billLinesFromAddress(`${id(1)}:3,nope:2,${id(2)}:0,${id(3)}:x`)).toEqual([{ variantId: id(1), quantity: 3 }]);
    expect(billSupplierFromAddress("drop table")).toBeNull();
  });
});
