import type { ListPage, ListQuery } from "@khmio/shared";

/** A where-filter that can be combined with AND (every Prisma *WhereInput can). */
type Where = { AND?: unknown };

/** A slice of the list shown under its own header, in this order, when the list is grouped across pages (e.g. order steps). */
export interface ListSection<W extends Where> {
  key: string;
  where: W;
}

export interface ListSource<Row, W extends Where, O> {
  query: ListQuery;
  /** Always applied (the store; never left out). */
  base: W;
  /** From the search box; null when it's empty. */
  search: W | null;
  /** Each chip's filter ("all" needs none). */
  chips: Record<string, W>;
  /** The filters chosen in the filter panel, by filter key. */
  filters: Record<string, W>;
  /** Every value of every filter, to count what each would show (filterCounts). */
  filterOptions?: Record<string, Record<string, W>>;
  orderBy: O[];
  /** Walk these in order across pages (grouped lists); their sizes come back as groupCounts. */
  sections?: ListSection<W>[];
  count: (where: W) => Promise<number>;
  find: (args: { where: W; orderBy: O[]; skip: number; take: number }) => Promise<Row[]>;
}

const and = <W extends Where>(...parts: (W | null | undefined)[]): W => ({ AND: parts.filter((part): part is W => part != null) }) as W;

/**
 * One page of a list for the data grid's server mode: the rows, the total,
 * each chip's count (with the search and filters applied), and — for a list
 * grouped in sections — the rows of each section across all pages. Generic
 * over the table: the caller turns the query into where/orderBy and passes
 * its count and findMany.
 */
export async function readListPage<Row, W extends Where, O>(source: ListSource<Row, W, O>): Promise<ListPage<Row>> {
  const { query } = source;
  const narrowed = and(source.base, source.search, ...Object.values(source.filters));
  const chipKeys = Object.keys(source.chips);
  const [allCount, ...counts] = await Promise.all([source.count(narrowed), ...chipKeys.map((key) => source.count(and(narrowed, source.chips[key])))]);
  const chipCounts: Record<string, number> = { all: allCount ?? 0 };
  chipKeys.forEach((key, index) => (chipCounts[key] = counts[index] ?? 0));

  const where = query.chip === "all" ? narrowed : and(narrowed, source.chips[query.chip]);
  const total = chipCounts[query.chip] ?? 0;
  const skip = (query.page - 1) * query.pageSize;

  // Each filter value counted with everything else applied but that filter itself (so its other values still show).
  const filterCounts: Record<string, Record<string, number>> = {};
  const chipWhere = query.chip === "all" ? null : source.chips[query.chip];
  await Promise.all(
    Object.entries(source.filterOptions ?? {}).flatMap(([key, values]) => {
      const others = Object.entries(source.filters).filter(([otherKey]) => otherKey !== key).map(([, filter]) => filter);
      filterCounts[key] = {};
      return Object.entries(values).map(async ([value, valueWhere]) => {
        filterCounts[key]![value] = await source.count(and(source.base, source.search, chipWhere, ...others, valueWhere));
      });
    }),
  );
  const extras = source.filterOptions ? { filterCounts } : {};

  if (!source.sections) {
    const rows = total > skip ? await source.find({ where, orderBy: source.orderBy, skip, take: query.pageSize }) : [];
    return { rows, total, page: query.page, pageSize: query.pageSize, chipCounts, ...extras };
  }

  // Grouped: section after section, each in the chosen order, cut to this page.
  const sectionCounts = await Promise.all(source.sections.map((section) => source.count(and(where, section.where))));
  const groupCounts: Record<string, number> = {};
  source.sections.forEach((section, index) => (groupCounts[section.key] = sectionCounts[index] ?? 0));
  const rows: Row[] = [];
  let offset = skip;
  for (const [index, section] of source.sections.entries()) {
    const size = sectionCounts[index] ?? 0;
    if (rows.length >= query.pageSize) break;
    if (offset >= size) {
      offset -= size;
      continue;
    }
    const take = Math.min(query.pageSize - rows.length, size - offset);
    rows.push(...(await source.find({ where: and(where, section.where), orderBy: source.orderBy, skip: offset, take })));
    offset = 0;
  }
  return { rows, total, page: query.page, pageSize: query.pageSize, chipCounts, groupCounts, ...extras };
}
