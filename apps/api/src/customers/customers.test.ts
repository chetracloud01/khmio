import { describe, expect, it } from "vitest";
import { customerChipSql, customerOrderBySql, customerSearchSql, parseCustomerListQuery, toCustomerRow } from "./customers";

describe("customer list query", () => {
  it("opens sorted by the newest order", () => {
    expect(parseCustomerListQuery({})).toMatchObject({ sort: "lastOrder", dir: "desc", page: 1 });
  });

  it("accepts the sorts the list declares and refuses anything else", () => {
    expect(parseCustomerListQuery({ sort: "spent", dir: "asc" })).toMatchObject({ sort: "spent", dir: "asc" });
    expect(() => parseCustomerListQuery({ sort: "phone; drop table customers" })).toThrow();
  });
});

describe("customer list search", () => {
  it("searches nothing for an empty box", () => {
    expect(customerSearchSql("  ").sql).toBe("TRUE");
  });

  it("finds a name in any case, with % and _ taken as themselves", () => {
    const search = customerSearchSql("50%_off");
    expect(search.sql).toContain("ILIKE");
    expect(search.values).toEqual(["%50\\%\\_off%"]);
  });

  it("also finds a phone however it was typed", () => {
    const search = customerSearchSql("+855 12 345");
    expect(search.sql).toContain("customers.phone LIKE");
    expect(search.values).toContain("%12345%");
  });
});

describe("customer list sort", () => {
  it("sorts spending in the shop's main currency only", () => {
    expect(customerOrderBySql("spent", "desc", "USD").sql).toContain('"spentUsd" DESC');
    expect(customerOrderBySql("spent", "desc", "KHR").sql).toContain('"spentKhr" DESC');
  });

  it("puts customers with nothing counted yet last, then the newest", () => {
    expect(customerOrderBySql("lastOrder", "asc", "USD").sql).toMatch(/"lastOrderAt" ASC NULLS LAST, customers\.created_at DESC/);
  });

  it("falls back to the newest order for a sort it doesn't know", () => {
    expect(customerOrderBySql("unknown", "desc", "USD").sql).toContain('"lastOrderAt" DESC');
  });
});

describe("a customer as the API answers", () => {
  it("gives money as numbers per currency and dates as text", () => {
    const at = new Date("2026-10-20T03:00:00.000Z");
    expect(
      toCustomerRow({ id: "c1", name: "Dara", phone: "85512345678", createdAt: at, orderCount: 2, spentUsd: 2450n, spentKhr: 48000n, firstOrderAt: at, lastOrderAt: null }),
    ).toEqual({
      id: "c1",
      name: "Dara",
      phone: "85512345678",
      orderCount: 2,
      spent: { USD: 2450, KHR: 48000 },
      firstOrderAt: "2026-10-20T03:00:00.000Z",
      lastOrderAt: null,
      createdAt: "2026-10-20T03:00:00.000Z",
    });
  });
});

describe("customer list views", () => {
  const now = new Date("2026-10-29T05:00:00Z");

  it("new: saved in the last 30 days; coming back: 2 orders or more; not back: no order in 60 days", () => {
    expect(customerChipSql("new", now).values).toEqual([new Date("2026-09-29T05:00:00Z")]);
    expect(customerChipSql("returning", now).sql).toContain("count(orders.id) >=");
    expect(customerChipSql("returning", now).values).toEqual([2]);
    expect(customerChipSql("lapsed", now).sql).toContain("max(orders.created_at) <");
    expect(customerChipSql("lapsed", now).values).toEqual([new Date("2026-08-30T05:00:00Z")]);
  });

  it("anything else is every customer, never built from the request's text", () => {
    expect(customerChipSql("all", now).sql).toBe("TRUE");
    expect(customerChipSql("1=1; drop table customers", now).sql).toBe("TRUE");
  });
});
