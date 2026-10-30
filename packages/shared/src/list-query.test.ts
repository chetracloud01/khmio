import { describe, expect, it } from "vitest";
import { listQueryFromParams, listQuerySchemaFor, listQueryToSearchParams, type ListSpec } from "./list-query";
import { ORDER_TABS, orderStatusesForTab } from "./orders";

const spec: ListSpec = { sorts: ["date", "name"], chips: ["open", "done"], filters: { pay: ["cash", "online"] }, defaultSort: { key: "date", dir: "desc" } };
const schema = listQuerySchemaFor(spec);

describe("list query", () => {
  it("fills the defaults", () => {
    expect(schema.parse(listQueryFromParams({}))).toEqual({ q: "", chip: "all", sort: "date", dir: "desc", page: 1, pageSize: 20, filters: {} });
  });

  it("reads the address's strings, filters included", () => {
    const query = schema.parse(listQueryFromParams({ q: " Sok ", chip: "open", sort: "name", dir: "asc", page: "3", pageSize: "50", "f.pay": "cash" }));
    expect(query).toEqual({ q: "Sok", chip: "open", sort: "name", dir: "asc", page: 3, pageSize: 50, filters: { pay: "cash" } });
  });

  it("refuses what the list didn't plan for", () => {
    expect(schema.safeParse(listQueryFromParams({ sort: "password" })).success).toBe(false);
    expect(schema.safeParse(listQueryFromParams({ chip: "secret" })).success).toBe(false);
    expect(schema.safeParse(listQueryFromParams({ "f.pay": "free" })).success).toBe(false);
    expect(schema.safeParse(listQueryFromParams({ "f.other": "x" })).success).toBe(false);
    expect(schema.safeParse(listQueryFromParams({ pageSize: "1000" })).success).toBe(false);
    expect(schema.safeParse(listQueryFromParams({ page: "0" })).success).toBe(false);
    expect(schema.safeParse(listQueryFromParams({ q: "x".repeat(101) })).success).toBe(false);
  });

  it("goes to the address and back unchanged", () => {
    const query = schema.parse(listQueryFromParams({ q: "Sok & co", chip: "done", sort: "name", dir: "asc", page: "2", pageSize: "10", "f.pay": "online" }));
    const text = listQueryToSearchParams(query);
    const params = Object.fromEntries(text.split("&").map((part) => part.split("=").map(decodeURIComponent) as [string, string]));
    expect(schema.parse(listQueryFromParams(params))).toEqual(query);
  });
});

describe("order list", () => {
  it("puts every status under exactly one tab", () => {
    const tabs = [...ORDER_TABS, "awaiting" as const];
    const all = tabs.flatMap((tab) => orderStatusesForTab(tab));
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(11);
    expect(orderStatusesForTab("to_confirm")).toEqual(["paid", "cod_pending"]);
  });
});
