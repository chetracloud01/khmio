import { describe, expect, it } from "vitest";
import { tileFigures, tileOf, tileSearch } from "./purchase-tiles";

const cell = (count: number, bought: number, owed: number) => ({ count, bought, owed });
const none = cell(0, 0, 0);
const side = (overrides: { status?: Partial<Record<"unpaid" | "part" | "paid" | "overdue", { received: ReturnType<typeof cell>; not_received: ReturnType<typeof cell> }>>; dueSoon?: number; dueSoonCount?: number; notReceived?: ReturnType<typeof cell>; overdue?: number }) => ({
  figures: { billCount: 0, bought: 0, returned: 0, paid: 0, owed: 0, overdue: overrides.overdue ?? 0, dueSoon: overrides.dueSoon ?? 0, dueSoonCount: overrides.dueSoonCount ?? 0, notReceived: overrides.notReceived ?? none },
  status: { unpaid: { received: none, not_received: none }, part: { received: none, not_received: none }, paid: { received: none, not_received: none }, overdue: { received: none, not_received: none }, ...overrides.status },
  ageing: { not_due: 0, late_1_30: 0, late_31_60: 0, late_61_90: 0, late_over_90: 0 },
});

describe("the Purchases page's tiles", () => {
  const report = {
    currencies: {
      USD: side({
        status: { unpaid: { received: cell(1, 3100, 3100), not_received: cell(1, 1350, 1350) }, part: { received: cell(1, 1000, 400), not_received: none }, paid: { received: cell(5, 347650, 0), not_received: none }, overdue: { received: cell(2, 72100, 72100), not_received: none } },
        overdue: 72100,
        dueSoon: 3100,
        dueSoonCount: 1,
        notReceived: cell(1, 1350, 1350),
      }),
      KHR: side({ status: { paid: { received: cell(2, 641000, 0), not_received: none } } }),
    },
  };

  it("count bills in both currencies; amounts in the one shown — owed, or bought for Paid and Not received", () => {
    const usd = tileFigures(report, "USD");
    expect(usd.overdue).toEqual({ count: 2, amount: 72100 });
    expect(usd.due_soon).toEqual({ count: 1, amount: 3100 });
    expect(usd.open).toEqual({ count: 3, amount: 3100 + 1350 + 400 });
    expect(usd.not_received).toEqual({ count: 1, amount: 1350 });
    expect(usd.paid).toEqual({ count: 7, amount: 347650 });
    expect(tileFigures(report, "KHR").paid).toEqual({ count: 7, amount: 641000 });
  });

  it("know which tile a list query shows", () => {
    expect(tileOf({ chip: "all", filters: { payment: "overdue" } })).toBe("overdue");
    expect(tileOf({ chip: "not_received", filters: {} })).toBe("not_received");
    expect(tileOf({ chip: "all", filters: { due: "due_soon", supplier: "x" } })).toBe("due_soon");
    expect(tileOf({ chip: "all", filters: { payment: "unpaid" } })).toBeNull();
  });

  it("write the list's address: the tile's filter, everything else of the list's cleared", () => {
    expect(tileSearch("f.payment=paid&q=abc&page=3&tab=return&sort=date:desc", "overdue")).toBe("sort=date%3Adesc&f.payment=overdue");
    expect(tileSearch("f.payment=overdue", "not_received")).toBe("tab=not_received");
    expect(tileSearch("f.payment=overdue", null)).toBe("");
  });
});
