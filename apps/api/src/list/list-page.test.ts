import type { ListQuery } from "@khmio/shared";
import { describe, expect, it } from "vitest";
import { readListPage } from "./list-page";

// An in-memory "table": each where is a predicate, combined with AND.
type Row = { id: number; kind: "a" | "b" | "c"; name: string };
type W = { AND?: W[]; test?: (row: Row) => boolean };
const matches = (where: W, row: Row): boolean => (where.test ? where.test(row) : true) && (where.AND ?? []).every((part) => matches(part, row));
const table: Row[] = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, kind: (["a", "b", "c"] as const)[index % 3]!, name: `row ${index + 1}` }));

function source(query: Partial<ListQuery>, sections = false) {
  const full: ListQuery = { q: "", chip: "all", sort: "id", dir: "asc", page: 1, pageSize: 10, filters: {}, ...query };
  const kind = (value: Row["kind"]): W => ({ test: (row) => row.kind === value });
  return readListPage<Row, W, "id">({
    query: full,
    base: { test: (row) => row.id <= 24 },
    search: full.q ? { test: (row) => row.name.includes(full.q) } : null,
    chips: { a: kind("a"), b: kind("b") },
    filters: full.filters.kind ? { kind: kind(full.filters.kind as Row["kind"]) } : {},
    filterOptions: { kind: { a: kind("a"), b: kind("b"), c: kind("c") }, small: { yes: { test: (row) => row.id <= 5 }, no: { test: (row) => row.id > 5 } } },
    orderBy: ["id"],
    sections: sections ? [{ key: "c", where: kind("c") }, { key: "a", where: kind("a") }, { key: "b", where: kind("b") }] : undefined,
    count: async (where) => table.filter((row) => matches(where, row)).length,
    find: async ({ where, skip, take }) => table.filter((row) => matches(where, row)).slice(skip, skip + take),
  });
}

describe("readListPage", () => {
  it("pages within the base filter and counts every chip", async () => {
    const page = await source({ page: 3 });
    expect(page.total).toBe(24);
    expect(page.rows.map((row) => row.id)).toEqual([21, 22, 23, 24]);
    expect(page.chipCounts).toEqual({ all: 24, a: 8, b: 8 });
  });

  it("applies the chip and the search to the rows and the counts", async () => {
    const page = await source({ chip: "a", q: "row 1" });
    expect(page.rows.every((row) => row.kind === "a" && row.name.includes("row 1"))).toBe(true);
    expect(page.total).toBe(page.chipCounts.a);
  });

  it("walks sections in their order across pages", async () => {
    const first = await source({ pageSize: 10 }, true);
    const second = await source({ pageSize: 10, page: 2 }, true);
    expect(first.groupCounts).toEqual({ c: 8, a: 8, b: 8 });
    expect(first.rows.map((row) => row.kind)).toEqual([..."cccccccc", "a", "a"]);
    expect(second.rows.map((row) => row.kind)).toEqual([..."aaaaaa", "b", "b", "b", "b"]);
  });

  it("counts each filter value with the other filters but not its own", async () => {
    const page = await source({ filters: { kind: "a" } });
    expect(page.total).toBe(8);
    // Its own values still count across all kinds…
    expect(page.filterCounts?.kind).toEqual({ a: 8, b: 8, c: 8 });
    // …another filter's values count within kind "a" (ids 1, 4 are ≤ 5).
    expect(page.filterCounts?.small).toEqual({ yes: 2, no: 6 });
  });

  it("returns no rows past the end", async () => {
    expect((await source({ page: 9 })).rows).toEqual([]);
  });
});
