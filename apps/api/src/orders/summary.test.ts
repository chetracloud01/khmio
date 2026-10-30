import { describe, expect, it } from "vitest";
import { buildSummary, type OpenRow } from "./summary";

describe("what needs the seller now", () => {
  it("waiting orders follow needsSellerAction; cash to collect keeps dollars and riel apart", () => {
    const open: OpenRow[] = [
      { status: "cod_pending", paymentMethod: "cod", currency: "USD", orders: 2, total: 1500 },
      { status: "out_for_delivery", paymentMethod: "cod", currency: "KHR", orders: 1, total: 80_000 },
      { status: "paid", paymentMethod: "khqr", currency: "USD", orders: 1, total: 900 },
      { status: "awaiting_payment", paymentMethod: "khqr", currency: "USD", orders: 3, total: 3000 },
    ];
    expect(buildSummary(open)).toEqual({ waiting: 4, cashToCollect: { USD: 1500, KHR: 80_000 } });
  });

  it("nothing open: nothing waiting, nothing to collect", () => {
    expect(buildSummary([])).toEqual({ waiting: 0, cashToCollect: { USD: 0, KHR: 0 } });
  });
});
