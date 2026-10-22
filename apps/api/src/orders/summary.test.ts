import { describe, expect, it } from "vitest";
import { buildSummary, phnomPenhDate, SUMMARY_DAYS, type DayRow, type ItemRow, type OpenRow } from "./summary";

// 2026-10-08 23:30 in Phnom Penh is 16:30 UTC — still the 8th there, already the 9th nowhere else.
const now = new Date("2026-10-08T16:30:00Z");

describe("seller home summary", () => {
  it("counts days in Phnom Penh time", () => {
    expect(phnomPenhDate(now)).toBe("2026-10-08");
    expect(phnomPenhDate(new Date("2026-10-08T17:30:00Z"))).toBe("2026-10-09");
    expect(phnomPenhDate(now, 6)).toBe("2026-10-02");
  });

  it("waiting orders follow needsSellerAction; cash to collect keeps dollars and riel apart", () => {
    const open: OpenRow[] = [
      { status: "cod_pending", paymentMethod: "cod", currency: "USD", orders: 2, total: 1500 },
      { status: "out_for_delivery", paymentMethod: "cod", currency: "KHR", orders: 1, total: 80_000 },
      { status: "paid", paymentMethod: "khqr", currency: "USD", orders: 1, total: 900 },
      { status: "awaiting_payment", paymentMethod: "khqr", currency: "USD", orders: 3, total: 3000 },
    ];
    const summary = buildSummary(open, [], [], now);
    expect(summary.waiting).toBe(4);
    expect(summary.cashToCollect).toEqual({ USD: 1500, KHR: 80_000 });
  });

  it("60 days, oldest first, with empty days filled in; today's sales and the two weeks", () => {
    const daily: DayRow[] = [
      { day: "2026-10-08", currency: "USD", orders: 2, total: 2400 },
      { day: "2026-10-08", currency: "KHR", orders: 1, total: 40_000 },
      { day: "2026-10-02", currency: "USD", orders: 3, total: 3000 },
      { day: "2026-10-01", currency: "USD", orders: 4, total: 4000 },
      { day: "2026-08-01", currency: "USD", orders: 9, total: 9000 },
    ];
    const summary = buildSummary([], daily, [], now);
    expect(summary.days).toHaveLength(SUMMARY_DAYS);
    expect(summary.days[0]!.date).toBe("2026-08-10");
    expect(summary.days.at(-1)).toEqual({ date: "2026-10-08", orders: 3, ordersUSD: 2, ordersKHR: 1, USD: 2400, KHR: 40_000 });
    expect(summary.salesToday).toEqual({ USD: 2400, KHR: 40_000 });
    expect(summary.ordersLast7Days).toBe(6);
    expect(summary.ordersPrevious7Days).toBe(4);
  });

  it("top products per period: most earned in the main currency first, dollars and riel apart, five at most", () => {
    const items: ItemRow[] = [
      { day: "2026-10-08", nameKm: "ប្រេង", nameEn: "Oil", currency: "USD", quantity: 2, total: 8400 },
      { day: "2026-10-08", nameKm: "ប្រេង", nameEn: "Oil", currency: "KHR", quantity: 1, total: 172_000 },
      { day: "2026-10-05", nameKm: "ឡាន", nameEn: "Car", currency: "USD", quantity: 1, total: 1_480_000 },
      { day: "2026-09-20", nameKm: "កង់", nameEn: "Tyre", currency: "USD", quantity: 4, total: 46_000 },
      ...Array.from({ length: 6 }, (_, index) => ({ day: "2026-09-15", nameKm: `ក${index}`, nameEn: `P${index}`, currency: "USD" as const, quantity: 1, total: 100 + index })),
    ];
    const { topProducts } = buildSummary([], [], items, now);
    expect(topProducts.today).toEqual([{ nameKm: "ប្រេង", nameEn: "Oil", quantity: 3, USD: 8400, KHR: 172_000 }]);
    expect(topProducts.week.map((item) => item.nameEn)).toEqual(["Car", "Oil"]);
    expect(topProducts.month.map((item) => item.nameEn)).toEqual(["Car", "Tyre", "Oil", "P5", "P4"]);
    // A riel shop ranks by riel first.
    expect(buildSummary([], [], items, now, "KHR").topProducts.today[0]!.KHR).toBe(172_000);
  });
});
