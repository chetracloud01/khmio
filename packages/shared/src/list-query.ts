import { z } from "zod";

// One request format for every long list read page by page from the server
// (the data grid's server mode): search, a quick-filter chip, filter values,
// a sort and the page. Each list declares what it allows (listQuerySchemaFor);
// anything else is refused, so a list query can't name a column or a value
// the API didn't plan for.

export const LIST_PAGE_SIZES = [10, 20, 50, 100] as const;
export const MAX_LIST_SEARCH_LENGTH = 100;
/** Filter values travel as "f.<key>=<value>" in the address. */
const FILTER_PREFIX = "f.";

/** What a list allows: its sort keys, chips and each filter's values. */
export interface ListSpec {
  sorts: readonly string[];
  chips: readonly string[];
  filters: Readonly<Record<string, readonly string[]>>;
  defaultSort: { key: string; dir: "asc" | "desc" };
}

export interface ListQuery {
  q: string;
  /** "all" or one of the list's chips. */
  chip: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
  filters: Record<string, string>;
}

/** One page of a list, with what the toolbar needs: the total, each chip's count, and the size of each group shown. */
export interface ListPage<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  /** "all" and every chip, counted with the search and filters applied. */
  chipCounts: Record<string, number>;
  /** Rows in each group header's group across all pages, when the list knows them (e.g. per order step). */
  groupCounts?: Record<string, number>;
  /**
   * How many rows each filter value would show (with the search, the chip and
   * the other filters applied), so the filter panel offers only values the
   * data has: filterCounts.payment.cod = 12.
   */
  filterCounts?: Record<string, Record<string, number>>;
}

const oneOf = (values: readonly string[]) => z.string().refine((value) => values.includes(value), "invalid_option");

/** The checked query of one list: an unknown sort, chip, filter or value is refused. */
export function listQuerySchemaFor(spec: ListSpec) {
  const filterShape: Record<string, z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>> = {};
  for (const [key, values] of Object.entries(spec.filters)) filterShape[key] = oneOf(values).optional();
  return z
    .object({
      q: z.string().trim().max(MAX_LIST_SEARCH_LENGTH, "too_long").default(""),
      chip: oneOf(["all", ...spec.chips]).default("all"),
      sort: oneOf(spec.sorts).default(spec.defaultSort.key),
      dir: z.enum(["asc", "desc"]).default(spec.defaultSort.dir),
      page: z.coerce.number().int().min(1).max(100_000).default(1),
      pageSize: z.coerce
        .number()
        .int()
        .refine((size) => (LIST_PAGE_SIZES as readonly number[]).includes(size), "invalid_option")
        .default(20),
      filters: z.object(filterShape).strict().default({}),
    })
    .transform((query): ListQuery => ({
      ...query,
      filters: Object.fromEntries(Object.entries(query.filters).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
    }));
}

/** The address's query (strings from the URL) as the object listQuerySchemaFor checks: "f.payment=cod" → filters.payment. */
export function listQueryFromParams(params: Record<string, unknown>): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith(FILTER_PREFIX)) filters[key.slice(FILTER_PREFIX.length)] = value;
    else rest[key] = value;
  }
  return { ...rest, filters };
}

/**
 * A list query as the address's search part ("q=Sok&page=2&f.payment=cod"),
 * for the API call. Empty values are left out. Built by hand so this package
 * needs no browser types (the API and worker use it too).
 */
export function listQueryToSearchParams(query: ListQuery): string {
  const parts: [string, string][] = [];
  if (query.q) parts.push(["q", query.q]);
  if (query.chip !== "all") parts.push(["chip", query.chip]);
  // No sort: the list's own default order.
  if (query.sort) parts.push(["sort", query.sort], ["dir", query.dir]);
  parts.push(["page", String(query.page)], ["pageSize", String(query.pageSize)]);
  for (const [key, value] of Object.entries(query.filters)) if (value) parts.push([`${FILTER_PREFIX}${key}`, value]);
  return parts.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
}
