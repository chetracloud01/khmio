import { describe, expect, it } from "vitest";
import { ageBucketOf, amountIn, isDueSoon, payablesInOne, payablesReport, type PayablesBill } from "./payables";
import { reportQuerySchema, reportSeries, seriesKeyOf } from "./report-period";
import { billPaymentState } from "./purchases";

const TODAY = "2026-10-29";
const ALL = { period: "all" } as const;

/** A bill as the report reads it; owed and state worked out like bill-balances.ts does. */
function bill(overrides: Partial<Omit<PayablesBill, "owed" | "state">>): PayablesBill {
  const base = { supplierId: "s1", supplierName: "Angkor Parts", currency: "USD" as const, purchasedOn: "2026-10-20", dueOn: null, received: true, total: 10000, returned: 0, paid: 0, payments: [], ...overrides };
  return { ...base, ...billPaymentState(base, TODAY) };
}

describe("ageing by due day", () => {
  it("puts a bill with no due day, or one not due yet, in not due", () => {
    expect(ageBucketOf(null, TODAY)).toBe("not_due");
    expect(ageBucketOf("2026-11-05", TODAY)).toBe("not_due");
    expect(ageBucketOf(TODAY, TODAY)).toBe("not_due");
  });

  it("counts days past the due day, each bucket's last day included", () => {
    expect(ageBucketOf("2026-10-28", TODAY)).toBe("late_1_30");
    expect(ageBucketOf("2026-09-29", TODAY)).toBe("late_1_30");
    expect(ageBucketOf("2026-09-28", TODAY)).toBe("late_31_60");
    expect(ageBucketOf("2026-08-30", TODAY)).toBe("late_31_60");
    expect(ageBucketOf("2026-08-29", TODAY)).toBe("late_61_90");
    expect(ageBucketOf("2026-07-31", TODAY)).toBe("late_61_90");
    expect(ageBucketOf("2026-07-30", TODAY)).toBe("late_over_90");
  });
});

describe("the payables report", () => {
  it("adds bought, paid and owed, returns lowering both, a supplier owing back not netted off", () => {
    const report = payablesReport(
      [
        bill({ total: 10000, paid: 4000 }),
        bill({ total: 5000, returned: 1000 }),
        // Paid, then goods sent back: the supplier owes the shop $20 — not taken off what the shop owes.
        bill({ total: 3000, paid: 3000, returned: 2000 }),
      ],
      ALL,
      TODAY,
    );
    const { figures } = report.currencies.USD;
    expect(figures.billCount).toBe(3);
    expect(figures.bought).toBe(15000);
    expect(figures.returned).toBe(1000 + 2000);
    expect(figures.paid).toBe(7000);
    expect(figures.owed).toBe(10000);
  });

  it("never adds dollars and riel together", () => {
    const report = payablesReport([bill({ total: 10000 }), bill({ currency: "KHR", total: 400000 })], ALL, TODAY);
    expect(report.currencies.USD.figures.owed).toBe(10000);
    expect(report.currencies.KHR.figures.owed).toBe(400000);
    expect(report.suppliers.map((row) => row.key)).toEqual(["s1:KHR", "s1:USD"]);
  });

  it("splits what's owed into overdue, due within 7 days, and later", () => {
    const report = payablesReport(
      [bill({ total: 1000, dueOn: "2026-10-20" }), bill({ total: 2000, dueOn: "2026-11-05" }), bill({ total: 4000, dueOn: "2026-11-06" }), bill({ total: 8000 })],
      ALL,
      TODAY,
    );
    const { figures, ageing } = report.currencies.USD;
    expect(figures.overdue).toBe(1000);
    expect(figures.dueSoon).toBe(2000);
    expect(figures.dueSoonCount).toBe(1);
    expect(figures.owed).toBe(15000);
    expect(ageing).toEqual({ not_due: 14000, late_1_30: 1000, late_31_60: 0, late_61_90: 0, late_over_90: 0 });
  });

  it("sets each payment standing against whether the goods arrived", () => {
    const report = payablesReport([bill({ received: false, total: 5000 }), bill({ received: false, total: 2000, paid: 2000 }), bill({ total: 3000, paid: 1000 })], ALL, TODAY);
    const { status, figures } = report.currencies.USD;
    expect(status.unpaid.not_received).toEqual({ count: 1, bought: 5000, owed: 5000 });
    expect(status.paid.not_received).toEqual({ count: 1, bought: 2000, owed: 0 });
    expect(status.part.received).toEqual({ count: 1, bought: 3000, owed: 2000 });
    expect(status.unpaid.received.count).toBe(0);
    expect(figures.notReceived).toEqual({ count: 2, bought: 7000, owed: 5000 });
  });

  it("reads only the period's bills, by the day on the bill: the last 7 days, or from one day to another", () => {
    const bills = [bill({ purchasedOn: "2026-10-23" }), bill({ purchasedOn: "2026-10-22" }), bill({ purchasedOn: "2026-10-01" })];
    const week = payablesReport(bills, { period: "week" }, TODAY);
    expect(week.days).toEqual({ from: "2026-10-23", to: "2026-10-29" });
    expect(week.currencies.USD.figures.billCount).toBe(1);
    const custom = payablesReport(bills, { period: "custom", from: "2026-10-01", to: "2026-10-22" }, TODAY);
    expect(custom.currencies.USD.figures.billCount).toBe(2);
    expect(payablesReport(bills, { period: "today" }, TODAY).currencies.USD.figures.billCount).toBe(0);
  });

  it("draws bought by the bill's day and paid by the payment's, day by day for a short range", () => {
    const report = payablesReport(
      [bill({ purchasedOn: "2026-10-27", total: 5000, returned: 1000, payments: [{ paidOn: "2026-10-28", amount: 2000 }, { paidOn: "2026-10-01", amount: 500 }] }), bill({ currency: "KHR", purchasedOn: "2026-10-28", total: 40_000 })],
      { period: "week" },
      TODAY,
    );
    expect(report.unit).toBe("day");
    expect(report.series).toHaveLength(7);
    expect(report.series.find((point) => point.key === "2026-10-27")?.bought).toEqual({ USD: 4000, KHR: 0 });
    // A payment outside the range isn't drawn in it.
    expect(report.series.reduce((sum, point) => sum + point.paid.USD, 0)).toBe(2000);
    expect(report.series.find((point) => point.key === "2026-10-28")?.bought.KHR).toBe(40_000);
  });

  it("draws every bill month by month, from the oldest to this month", () => {
    const report = payablesReport([bill({ purchasedOn: "2025-12-15" }), bill({ purchasedOn: "2026-10-02" })], ALL, TODAY);
    expect(report.unit).toBe("month");
    expect(report.series.map((point) => point.key)).toEqual(["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(report.series[0]?.bought.USD).toBe(10000);
  });

  it("lists suppliers most owed first, a bill without one apart", () => {
    const report = payablesReport(
      [bill({ supplierId: "s1", supplierName: "Angkor Parts", total: 1000 }), bill({ supplierId: "s2", supplierName: "Chhay Tyres", total: 9000 }), bill({ supplierId: null, supplierName: "", total: 500 })],
      ALL,
      TODAY,
    );
    expect(report.suppliers.map((row) => [row.key, row.owed])).toEqual([
      ["s2:USD", 9000],
      ["s1:USD", 1000],
      ["none:USD", 500],
    ]);
  });

  it("reads every bill unless a known period is asked for; a custom range needs both days, in order, not ahead", () => {
    expect(reportQuerySchema.parse({}).period).toBe("all");
    expect(reportQuerySchema.safeParse({ period: "forever" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ period: "custom", from: "2026-10-01" }).error?.issues[0]).toMatchObject({ path: ["to"], message: "required" });
    expect(reportQuerySchema.safeParse({ period: "custom", from: "2026-10-09", to: "2026-10-01" }).error?.issues[0]).toMatchObject({ path: ["to"], message: "ends_before_start" });
    expect(reportQuerySchema.safeParse({ period: "custom", from: "2026-10-01", to: "2999-01-01" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ period: "custom", from: "2026-10-01", to: "2026-10-09" }).success).toBe(true);
  });
});

describe("due soon", () => {
  it("owed, not late, due within 7 days; never a paid, overdue or undated bill", () => {
    expect(isDueSoon({ owed: 100, state: "unpaid", dueOn: "2026-11-05" }, TODAY)).toBe(true);
    expect(isDueSoon({ owed: 100, state: "part", dueOn: TODAY }, TODAY)).toBe(true);
    expect(isDueSoon({ owed: 100, state: "unpaid", dueOn: "2026-11-06" }, TODAY)).toBe(false);
    expect(isDueSoon({ owed: 0, state: "paid", dueOn: "2026-11-01" }, TODAY)).toBe(false);
    expect(isDueSoon({ owed: 100, state: "overdue", dueOn: "2026-10-01" }, TODAY)).toBe(false);
    expect(isDueSoon({ owed: 100, state: "unpaid", dueOn: null }, TODAY)).toBe(false);
  });
});

describe("the payables report in one currency", () => {
  const RATE = 4000;
  const report = payablesReport(
    [
      bill({ supplierId: "s1", total: 10000, paid: 4000, payments: [{ paidOn: "2026-10-21", amount: 4000 }] }),
      bill({ supplierId: "s1", currency: "KHR", total: 200_000, received: false }),
      bill({ supplierId: "s2", supplierName: "Chhay Tyres", currency: "KHR", total: 41_000, dueOn: "2026-10-01" }),
    ],
    { period: "week" },
    "2026-10-23",
  );

  it("turns each amount at the shop's rate, rounded like a price", () => {
    expect(amountIn(10000, "USD", "KHR", RATE)).toBe(400_000);
    expect(amountIn(41_000, "KHR", "USD", RATE)).toBe(1025);
    expect(amountIn(500, "USD", "USD", RATE)).toBe(500);
  });

  it("adds both currencies into dollars: figures, standing, ageing and the bars", () => {
    const inUsd = payablesInOne(report, "USD", RATE);
    expect(inUsd.report.figures).toMatchObject({ billCount: 3, bought: 10000 + 5000 + 1025, paid: 4000, owed: 6000 + 5000 + 1025, overdue: 1025 });
    expect(inUsd.report.figures.notReceived).toEqual({ count: 1, bought: 5000, owed: 5000 });
    expect(inUsd.report.status.unpaid.not_received).toEqual({ count: 1, bought: 5000, owed: 5000 });
    expect(inUsd.report.ageing.late_1_30).toBe(1025);
    expect(inUsd.series.reduce((sum, point) => sum + point.bought, 0)).toBe(16025);
    expect(inUsd.series.reduce((sum, point) => sum + point.paid, 0)).toBe(4000);
  });

  it("one row per supplier, both currencies together, most owed first", () => {
    const inKhr = payablesInOne(report, "KHR", RATE);
    expect(inKhr.suppliers.map((row) => [row.key, row.currency, row.owed])).toEqual([
      ["s1", "KHR", 240_000 + 200_000],
      ["s2", "KHR", 41_000],
    ]);
  });
});

describe("a report's bars", () => {
  it("day by day for a short range, month by month for a long one", () => {
    expect(reportSeries("2026-10-01", "2026-10-03")).toEqual({ unit: "day", keys: ["2026-10-01", "2026-10-02", "2026-10-03"] });
    const long = reportSeries("2026-01-15", "2026-10-29");
    expect(long.unit).toBe("month");
    expect(long.keys[0]).toBe("2026-01");
    expect(long.keys.at(-1)).toBe("2026-10");
    expect(seriesKeyOf("2026-10-08", "month")).toBe("2026-10");
  });
});
