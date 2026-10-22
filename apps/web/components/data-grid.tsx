"use client";

import type { ListPage, ListQuery } from "@khmio/shared";
import { BottomSheet, Button, Card, Checkbox, cn, GroupTitle, Notice, SearchInput, Skeleton } from "@khmio/ui";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Download, ListFilter, Settings2, SquareCheckBig, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// The standard data grid for every list in the app (admin and merchant):
// search, quick-filter chips, a filter panel, sortable columns, row selection
// with bulk actions, CSV export, show/hide columns, density and page size.
// Laptop and up shows a table; phones and tablets show cards.
//
// Two ways to feed it: `rows` (it searches, filters, sorts and pages them in
// the browser — fine for a few hundred), or `server` (each page is asked from
// the API with packages/shared ListQuery and comes back as a ListPage — for
// lists that keep growing, like orders). The screen is the same either way.

export interface DataGridColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Plain value for sorting (and CSV export). Columns without one can't sort or export. */
  value?: (row: T) => string | number;
  /** What the CSV shows, when the sort value isn't human-readable (e.g. a plan's rank). */
  exportValue?: (row: T) => string | number;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  /** false = always visible (e.g. the name column). */
  hideable?: boolean;
  defaultHidden?: boolean;
  /** Kept in view while a wide table scrolls sideways on a laptop: "start" (e.g. the order number) or "end" (its next step). */
  pin?: "start" | "end";
}

/** What the search box holds, for DataGridHighlight inside the cells. */
const GridSearchContext = createContext("");

/** Text with what was searched for highlighted (use it inside a column's cell or a card). */
export function DataGridHighlight({ text }: { text: string }) {
  const query = useContext(GridSearchContext).trim();
  if (!query) return <>{text}</>;
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-warning/25 text-inherit">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

/** Whether the screen is laptop-wide (the table, numbered pages); phones and tablets get cards and "Show more". Null until the browser has said. */
function useWide(): boolean | null {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return wide;
}

/** Page numbers to show: the first, the last, and the ones around the current page, with gaps as null. */
function pageNumbers(current: number, count: number): (number | null)[] {
  const wanted = new Set([1, count, current - 1, current, current + 1].filter((page) => page >= 1 && page <= count));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((page, index) => (index > 0 && page - sorted[index - 1]! > 1 ? [null, page] : [page]));
}

export interface DataGridChip<T> {
  value: string;
  label: string;
  /** Which rows it keeps (browser mode); the server decides in server mode. */
  predicate?: (row: T) => boolean;
  /** An icon before the label; `iconClass` colours it while the chip isn't the chosen one. */
  icon?: LucideIcon;
  iconClass?: string;
}

/**
 * Group headers in the list and the table. `key` decides the group and
 * `label` names it; with `sortKey`, groups show only while sorted by that
 * column (days, for a date sort); with `rank`, groups come in that order
 * (statuses in the order work happens), each keeping the chosen sort inside.
 */
export interface DataGridGroup<T> {
  sortKey?: string;
  key: (row: T) => string;
  label: (row: T) => string;
  rank?: (row: T) => number;
  /** Shown before the label in the header, e.g. a coloured status icon. */
  icon?: (row: T) => ReactNode;
  labelClass?: (row: T) => string;
}

export interface DataGridFilter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  /** Which rows a value keeps (browser mode); the server decides in server mode. */
  predicate?: (row: T, value: string) => boolean;
}

export interface DataGridBulkAction<T> {
  key: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  /** Rows the action applies to; defaults to all selected rows. */
  applies?: (row: T) => boolean;
  run: (rows: T[]) => void;
}

type SortState = { key: string; direction: "asc" | "desc" } | null;
type Density = "comfortable" | "compact";

interface StoredPrefs {
  hidden: string[];
  density: Density;
  pageSize: number;
}

const PAGE_SIZES = [10, 20, 50, 100];

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Server mode: each page is asked from the API. */
export interface DataGridServer<T> {
  load: (query: ListQuery) => Promise<ListPage<T>>;
  /** Change it to read the page again (e.g. after an order moved on). */
  reloadKey?: unknown;
  /** Told about each page read (e.g. the chip counts). */
  onPage?: (page: ListPage<T>) => void;
}

/** How long typing pauses before the search goes to the server. */
const SERVER_SEARCH_DELAY_MS = 300;
/** Export in server mode reads every matching row, a page of 100 at a time, up to this many. */
const SERVER_EXPORT_MAX_ROWS = 10_000;

export function DataGrid<T>({
  rows = [],
  server,
  getRowId,
  columns,
  searchText,
  searchPlaceholder,
  chips,
  initialChip = "all",
  initialChipFallback,
  initialSearch = "",
  filters,
  bulkActions,
  onRowClick,
  renderCard,
  renderCardAction,
  initialSort = null,
  exportFileName,
  storageKey,
  emptyTitle,
  emptyArt,
  groupBy,
  defaultPageSize,
  selectOnDemand = false,
  renderCardAside,
  syncUrl = false,
  rowNumbers = false,
}: {
  /** All rows, in browser mode. Leave out with `server`. */
  rows?: T[];
  server?: DataGridServer<T>;
  getRowId: (row: T) => string;
  columns: DataGridColumn<T>[];
  /** Text the search box matches against (browser mode; the server searches in server mode). */
  searchText?: (row: T) => string;
  searchPlaceholder: string;
  /** Quick one-tap filters shown as chips; "all" is added automatically. */
  chips?: DataGridChip<T>[];
  initialChip?: string;
  /** When the opening chip has nothing in it, open this one instead (e.g. "all" when nothing is waiting). */
  initialChipFallback?: string;
  /** Opens with the search box already filled — for links like "this store's invoices". */
  initialSearch?: string;
  /** Extra filters in the filter panel (dropdowns). */
  filters?: DataGridFilter<T>[];
  bulkActions?: DataGridBulkAction<T>[];
  onRowClick?: (row: T) => void;
  /** How one row looks as a card on phones and tablets. */
  renderCard: (row: T) => ReactNode;
  /** A button under the card. Kept outside the card's own tap area, so it can't be a button inside a button. */
  renderCardAction?: (row: T) => ReactNode;
  initialSort?: SortState;
  exportFileName: string;
  /** Remembers column, density and page-size choices per viewer. */
  storageKey?: string;
  emptyTitle?: string;
  /** A picture above the empty message, such as Mio. */
  emptyArt?: ReactNode;
  /**
   * Group headers in the list and the table (e.g. Today · Yesterday · 20 Oct)
   * while it's sorted by `sortKey`; `key` decides the group, `label` names it.
   */
  groupBy?: DataGridGroup<T> | ((chip: string) => DataGridGroup<T> | null);
  /** Rows per page until the viewer picks another (10, 20, 50 or 100). */
  defaultPageSize?: number;
  /** Checkboxes only after "Select" is tapped (bulk actions are occasional); otherwise always shown. */
  selectOnDemand?: boolean;
  /** Beside a phone card, outside its tap area (e.g. a show/hide switch); it replaces the card's arrow. */
  renderCardAside?: (row: T) => ReactNode;
  /** A "#" column counting the rows (on, across pages: page 2 starts at 21). Phones show it on each card. */
  rowNumbers?: boolean;
  /** Keeps the tab, search, sort, filters and page in the address, so refresh and Back return to the same place. One grid per page. */
  syncUrl?: boolean;
}) {
  const t = useTranslations("DataGrid");
  const [search, setSearch] = useState(initialSearch);
  const [chip, setChip] = useState(() => {
    if (server || !initialChipFallback) return initialChip;
    const predicate = chips?.find((item) => item.value === initialChip)?.predicate;
    return predicate && !rows.some(predicate) ? initialChipFallback : initialChip;
  });
  /** Server mode: the fallback is checked on the first page only. */
  const firstServerPage = useRef(true);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  /** The toolbar menu that's open, if any. */
  const [menu, setMenu] = useState<"filter" | "sort" | "view" | null>(null);
  const measuredWide = useWide();
  const wide = measuredWide ?? false;
  const searchBox = useRef<HTMLInputElement>(null);
  /** Phone "Show more": the next page is added under the rows already shown. */
  const appendNext = useRef(false);
  /** With syncUrl: whether the address has been read (the first server page waits for it). */
  const [urlReady, setUrlReady] = useState(!syncUrl);
  const [sort, setSort] = useState<SortState>(initialSort);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** With selectOnDemand: whether "Select" was tapped, showing the checkboxes. */
  const [selecting, setSelecting] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((column) => column.defaultHidden).map((column) => column.key)),
  );
  const [density, setDensity] = useState<Density>("comfortable");
  const [pageSize, setPageSize] = useState(defaultPageSize && PAGE_SIZES.includes(defaultPageSize) ? defaultPageSize : (PAGE_SIZES[0] ?? 10));
  // State, not a ref: saving must wait until the loaded values have actually
  // rendered, or the defaults get written over the saved choice first.
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Per-viewer display preferences (a convenience only — safe to lose).
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(`khmio:grid:${storageKey}`);
      if (raw) {
        const prefs = JSON.parse(raw) as Partial<StoredPrefs>;
        if (prefs.hidden) setHidden(new Set(prefs.hidden));
        if (prefs.density === "compact" || prefs.density === "comfortable") setDensity(prefs.density);
        if (prefs.pageSize && PAGE_SIZES.includes(prefs.pageSize)) setPageSize(prefs.pageSize);
      }
    } catch {
      // Storage unavailable — keep defaults.
    }
    setPrefsLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !prefsLoaded) return;
    try {
      const prefs: StoredPrefs = { hidden: [...hidden], density, pageSize };
      window.localStorage.setItem(`khmio:grid:${storageKey}`, JSON.stringify(prefs));
    } catch {
      // Storage unavailable — preferences just won't be remembered.
    }
  }, [storageKey, prefsLoaded, hidden, density, pageSize]);

  // syncUrl: read the address once (tab, search, sort, filters, page)…
  useEffect(() => {
    if (!syncUrl) return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && (tab === "all" || chips?.some((item) => item.value === tab))) {
      setChip(tab);
      firstServerPage.current = false; // the address chose the tab: no fallback
    }
    const q = params.get("q");
    if (q) {
      setSearch(q);
      setServerSearch(q);
    }
    const [sortKey, sortDir] = (params.get("sort") ?? "").split(":");
    if (sortKey && (sortDir === "asc" || sortDir === "desc") && columns.some((column) => column.key === sortKey)) setSort({ key: sortKey, direction: sortDir });
    const chosen: Record<string, string> = {};
    for (const filter of filters ?? []) {
      const value = params.get(`f.${filter.key}`);
      if (value && filter.options.some((option) => option.value === value)) chosen[filter.key] = value;
    }
    setFilterValues(chosen);
    const pageParam = Number(params.get("page"));
    if (Number.isInteger(pageParam) && pageParam > 1) setPage(pageParam);
    setUrlReady(true);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // …and keep it up to date (replacing the entry, so Back still leaves the page).
  useEffect(() => {
    if (!syncUrl || !urlReady) return;
    const params = new URLSearchParams(window.location.search);
    const set = (key: string, value: string | null) => (value ? params.set(key, value) : params.delete(key));
    set("tab", chip === initialChip ? null : chip);
    set("q", search.trim() || null);
    set("sort", sort && (sort.key !== initialSort?.key || sort.direction !== initialSort?.direction) ? `${sort.key}:${sort.direction}` : null);
    for (const filter of filters ?? []) set(`f.${filter.key}`, filterValues[filter.key] || null);
    if (measuredWide !== null) set("page", wide && page > 1 ? String(page) : null);
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", next);
  }, [syncUrl, urlReady, chip, initialChip, search, sort, initialSort, filters, filterValues, page, wide, measuredWide]);

  // "/" jumps to the search box on a laptop; Esc closes a toolbar menu.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchBox.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Server mode: the search waits for a pause in typing; each change asks for the page again.
  const [serverSearch, setServerSearch] = useState(initialSearch);
  useEffect(() => {
    if (!server) return;
    const timer = window.setTimeout(() => setServerSearch(search), SERVER_SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [server, search]);
  const [serverPage, setServerPage] = useState<ListPage<T> | null>(null);
  /** Phone: every row shown so far (the pages added by "Show more"). */
  const [serverShown, setServerShown] = useState<T[]>([]);
  const [serverState, setServerState] = useState<"loading" | "ready" | "failed">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const latestRequest = useRef(0);
  const serverQuery = (pageNumber: number, size: number): ListQuery => ({
    q: serverSearch.trim(),
    chip,
    sort: sort?.key ?? "",
    dir: sort?.direction ?? "desc",
    page: pageNumber,
    pageSize: size,
    filters: Object.fromEntries(Object.entries(filterValues).filter(([, value]) => value)),
  });
  const serverQueryKey = JSON.stringify(serverQuery(page, pageSize));
  const serverLoad = server?.load;
  const serverOnPage = server?.onPage;
  useEffect(() => {
    if (!serverLoad || (storageKey && !prefsLoaded) || !urlReady) return;
    const request = ++latestRequest.current;
    setServerState("loading");
    serverLoad(JSON.parse(serverQueryKey) as ListQuery).then(
      (result) => {
        if (request !== latestRequest.current) return; // a newer request is on its way
        if (firstServerPage.current) {
          firstServerPage.current = false;
          if (initialChipFallback && result.chipCounts[initialChip] === 0 && initialChip !== initialChipFallback) {
            setChip(initialChipFallback);
            return; // the fallback chip's page is asked next
          }
        }
        const appending = appendNext.current;
        appendNext.current = false;
        setServerShown((shown) => (appending ? [...shown, ...result.rows] : result.rows));
        setServerPage(result);
        setServerState("ready");
        serverOnPage?.(result);
        // A page past the end (rows went away): go to the last one.
        const last = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (result.page > last) setPage(last);
      },
      () => request === latestRequest.current && setServerState("failed"),
    );
    // serverQueryKey stands for the query; reloadKey and retries ask again.
  }, [serverLoad, serverOnPage, serverQueryKey, server?.reloadKey, retryCount, storageKey, prefsLoaded, urlReady, initialChip, initialChipFallback]);

  // Moving between laptop and phone width starts again from the first page (pages there are numbered, here they're added up).
  // Learning the width on arrival isn't a move.
  const knownWide = useRef<boolean | null>(null);
  useEffect(() => {
    if (measuredWide === null) return;
    if (knownWide.current !== null && knownWide.current !== measuredWide) setPage(1);
    knownWide.current = measuredWide;
  }, [measuredWide]);

  const visibleColumns = columns.filter((column) => !hidden.has(column.key));
  const activeFilterCount = Object.values(filterValues).filter(Boolean).length;

  const groupSpec = typeof groupBy === "function" ? groupBy(chip) : (groupBy ?? null);
  const grouping = groupSpec && (!groupSpec.sortKey || sort?.key === groupSpec.sortKey) ? groupSpec : null;

  const filtered = useMemo(() => {
    if (server) return [];
    const query = search.trim().toLowerCase();
    const chipDef = chips?.find((item) => item.value === chip);
    let result = rows.filter((row) => {
      if (chipDef?.predicate && !chipDef.predicate(row)) return false;
      for (const filter of filters ?? []) {
        const value = filterValues[filter.key];
        if (value && filter.predicate && !filter.predicate(row, value)) return false;
      }
      return !query || (searchText?.(row) ?? "").toLowerCase().includes(query);
    });
    const sortColumn = sort && columns.find((column) => column.key === sort.key);
    if (sort && sortColumn?.value) {
      const getValue = sortColumn.value;
      result = [...result].sort((a, b) => {
        const left = getValue(a);
        const right = getValue(b);
        const order =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));
        return sort.direction === "asc" ? order : -order;
      });
    }
    // Groups in their own order (stable: the chosen sort still holds inside each group).
    if (grouping?.rank) {
      const rank = grouping.rank;
      result = [...result].sort((a, b) => rank(a) - rank(b));
    }
    return result;
  }, [server, rows, search, chip, chips, filters, filterValues, searchText, sort, columns, grouping]);

  const totalCount = server ? (serverPage?.total ?? 0) : filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = server ? (wide ? (serverPage?.rows ?? []) : serverShown) : wide ? filtered.slice(start, start + pageSize) : filtered.slice(0, currentPage * pageSize);
  const shownFrom = wide ? start + 1 : 1;
  const hasMore = !wide && pageRows.length < totalCount;
  const chipCount = (option: { value: string; predicate?: (row: T) => boolean }): number | null =>
    server ? (serverPage?.chipCounts[option.value] ?? null) : option.predicate ? rows.filter(option.predicate).length : rows.length;

  /**
   * How many rows each filter value would show: with the search, the chip and
   * the other filters, but not that filter itself. From the server in server
   * mode. The panel offers only values with rows.
   */
  const filterCounts = useMemo((): Record<string, Record<string, number>> => {
    if (server) return serverPage?.filterCounts ?? {};
    const query = search.trim().toLowerCase();
    const chipDef = chips?.find((item) => item.value === chip);
    const base = rows.filter((row) => (!chipDef?.predicate || chipDef.predicate(row)) && (!query || (searchText?.(row) ?? "").toLowerCase().includes(query)));
    const counts: Record<string, Record<string, number>> = {};
    for (const filter of filters ?? []) {
      const others = base.filter((row) =>
        (filters ?? []).every((other) => other.key === filter.key || !filterValues[other.key] || !other.predicate || other.predicate(row, filterValues[other.key]!)),
      );
      counts[filter.key] = Object.fromEntries(filter.options.map((option) => [option.value, filter.predicate ? others.filter((row) => filter.predicate!(row, option.value)).length : others.length]));
    }
    return counts;
  }, [server, serverPage, rows, search, chip, chips, searchText, filters, filterValues]);
  /** Each filter with only the values the data has (and the chosen one); a filter with nothing to choose between is left out. */
  const offeredFilters = (filters ?? []).flatMap((filter) => {
    const counts = filterCounts[filter.key];
    const chosen = filterValues[filter.key];
    // No counts yet (first server page): offer everything.
    const options = filter.options.filter((option) => !counts || (counts[option.value] ?? 0) > 0 || option.value === chosen);
    return options.length >= 2 || chosen ? [{ ...filter, options, counts }] : [];
  });

  // Each group header's size across all pages: counted here in browser mode; in server mode only when the server says.
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (server) for (const [key, count] of Object.entries(serverPage?.groupCounts ?? {})) counts.set(key, count);
    else if (grouping) for (const row of filtered) counts.set(grouping.key(row), (counts.get(grouping.key(row)) ?? 0) + 1);
    return counts;
  }, [server, serverPage, filtered, grouping]);
  /** The group header to show before this row, or null when it continues the previous row's group. */
  const groupStart = (index: number): { key: string; label: string; count: number | null; icon: ReactNode; labelClass: string } | null => {
    if (!grouping) return null;
    const row = pageRows[index]!;
    const key = grouping.key(row);
    if (index > 0 && grouping.key(pageRows[index - 1]!) === key) return null;
    return { key, label: grouping.label(row), count: groupCounts.get(key) ?? null, icon: grouping.icon?.(row) ?? null, labelClass: grouping.labelClass?.(row) ?? "" };
  };

  // Drop selections that are no longer visible after filtering.
  const selectable = server ? pageRows : filtered;
  const filteredIds = useMemo(() => new Set(selectable.map(getRowId)), [selectable, getRowId]);
  const selectedRows = selectable.filter((row) => selected.has(getRowId(row)));
  const pageIds = pageRows.map(getRowId);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));
  const headerCheckbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckbox.current) headerCheckbox.current.indeterminate = somePageSelected && !allPageSelected;
  }, [somePageSelected, allPageSelected]);

  function resetPaging() {
    setPage(1);
  }

  /** Phone: the next page under the rows already shown. */
  function showMore() {
    if (server) appendNext.current = true;
    setPage(currentPage + 1);
  }

  function toggleSort(column: DataGridColumn<T>) {
    if (!canSortBy(column)) return;
    setSort((prev) =>
      prev?.key !== column.key
        ? { key: column.key, direction: "asc" }
        : prev.direction === "asc"
          ? { key: column.key, direction: "desc" }
          : null,
    );
  }

  /** A column can be sorted when it says so and there's a value to sort by (the server sorts in server mode). */
  function canSortBy(column: DataGridColumn<T>) {
    return Boolean(column.sortable && (column.value || server));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set([...prev].filter((item) => filteredIds.has(item)));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set([...prev].filter((item) => filteredIds.has(item)));
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  /** Server mode: every row matching the search, chip and filters, read 100 at a time. */
  async function readAllServerRows(): Promise<T[]> {
    if (!server) return filtered;
    const all: T[] = [];
    for (let pageNumber = 1; all.length < SERVER_EXPORT_MAX_ROWS; pageNumber++) {
      const result = await server.load(serverQuery(pageNumber, 100));
      all.push(...result.rows);
      if (result.rows.length === 0 || all.length >= result.total) break;
    }
    return all;
  }

  async function exportCsv() {
    const exportRows = selectedRows.length ? selectedRows : await readAllServerRows();
    const exportColumns = visibleColumns.flatMap((column) => {
      const read = column.exportValue ?? column.value;
      return read ? [{ header: column.header, read }] : [];
    });
    const lines = [
      exportColumns.map((column) => csvEscape(column.header)).join(","),
      ...exportRows.map((row) => exportColumns.map((column) => csvEscape(column.read(row))).join(",")),
    ];
    // BOM so Excel opens Khmer text as UTF-8.
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportFileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const sortableColumns = columns.filter(canSortBy);
  const cellPadding = density === "compact" ? "px-4 py-1.5" : "px-4 py-3";
  const hasSelection = Boolean(bulkActions?.length) && (!selectOnDemand || selecting);
  const sortColumn = sort ? columns.find((column) => column.key === sort.key) : undefined;
  const activeFilters = (filters ?? []).flatMap((filter) => {
    const value = filterValues[filter.key];
    const option = value ? filter.options.find((item) => item.value === value) : undefined;
    return option ? [{ filter, option }] : [];
  });
  const refreshing = Boolean(server && serverPage && serverState === "loading");

  const toolButton = (active: boolean) =>
    cn(
      "inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
      active ? "border-brand bg-brand/10 text-brand" : "border-border bg-bg text-fg hover:bg-canvas",
    );
  const menuItem = (active: boolean) =>
    cn("flex min-h-touch w-full items-center gap-3 rounded-DEFAULT px-3 text-left text-sm", active ? "bg-brand/10 font-medium text-brand" : "hover:bg-canvas");

  /** A toolbar menu: a panel under its button on a laptop, a sheet from the bottom on a phone. Closed by a tap outside or Esc. */
  const toolMenu = (name: "filter" | "sort" | "view", label: string, panel: ReactNode, wideClass = "w-72") =>
    wide ? (
      menu === name && (
        <>
          <div aria-hidden="true" onClick={() => setMenu(null)} className="fixed inset-0 z-30" />
          <div role="dialog" aria-label={label} className={cn("absolute right-0 top-12 z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-bg p-2 shadow-raised", wideClass)}>
            {panel}
          </div>
        </>
      )
    ) : (
      <BottomSheet open={menu === name} onClose={() => setMenu(null)} closeLabel={t("close")} title={label}>
        <div className="pb-2">{panel}</div>
      </BottomSheet>
    );

  const clearFilters = () => {
    setFilterValues({});
    resetPaging();
  };
  const clearSearch = () => {
    setSearch("");
    setServerSearch("");
    resetPaging();
  };

  // The narrow columns before the data (tick box, row number) stay pinned at the left, one after the other; a "start" column follows them.
  const numberLeft = hasSelection ? "left-12" : "left-0";
  const startLeft = ["left-0", "left-12", "left-24"][(hasSelection ? 1 : 0) + (rowNumbers ? 1 : 0)];
  /** The row's number: counting on across pages on a laptop, from 1 down the phone's list. */
  const rowNumber = (index: number) => shownFrom + index;

  /** Pinned cells keep an opaque background so the columns scrolling under them don't show through. */
  const pinClass = (column: DataGridColumn<T>, header = false) =>
    column.pin === "start"
      ? cn("sticky z-10 shadow-[1px_0_0_rgb(var(--color-border))]", startLeft, header ? "bg-canvas" : "bg-bg")
      : column.pin === "end"
        ? cn("sticky right-0 z-10 shadow-[-1px_0_0_rgb(var(--color-border))]", header ? "bg-canvas" : "bg-bg")
        : "";

  return (
    <GridSearchContext.Provider value={server ? serverSearch : search}>
      <Card className="relative flex flex-col p-0">
        {/* Toolbar: pinned under the app's header while a long list scrolls. */}
        <div className="sticky top-[var(--grid-sticky-top,0px)] z-30 flex flex-col gap-3 rounded-t-DEFAULT border-b border-border bg-bg p-3 md:p-4">
          {refreshing && <div aria-hidden="true" className="grid-progress absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-DEFAULT" />}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SearchInput
                ref={searchBox}
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPaging();
                }}
                onClear={clearSearch}
                clearLabel={t("clearSearch")}
                aria-keyshortcuts="/"
              />
            </div>

            {(offeredFilters.length > 0 || activeFilterCount > 0) && (
              <div className="relative">
                <button type="button" onClick={() => setMenu(menu === "filter" ? null : "filter")} aria-expanded={menu === "filter"} aria-label={t("filters")} className={toolButton(menu === "filter" || activeFilterCount > 0)}>
                  <ListFilter className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{t("filters")}</span>
                  {activeFilterCount > 0 && <span className="rounded-full bg-brand px-1.5 text-xs text-on-brand">{activeFilterCount}</span>}
                </button>
                {toolMenu(
                  "filter",
                  t("filters"),
                  <div className="flex flex-col gap-3 p-2">
                    {offeredFilters.map((filter) => (
                      <div key={filter.key} className="flex flex-col gap-1.5">
                        <GroupTitle as="p">{filter.label}</GroupTitle>
                        <div className="flex flex-wrap gap-1.5">
                          {[{ value: "", label: t("all") }, ...filter.options].map((option) => {
                            const active = (filterValues[filter.key] ?? "") === option.value;
                            return (
                              <button
                                key={option.value || "all"}
                                type="button"
                                aria-pressed={active}
                                onClick={() => {
                                  setFilterValues((prev) => ({ ...prev, [filter.key]: option.value }));
                                  resetPaging();
                                }}
                                className={cn(
                                  "inline-flex min-h-touch items-center gap-1.5 rounded-full border px-3 text-sm",
                                  active ? "border-brand bg-brand text-on-brand" : "border-border bg-bg hover:bg-canvas",
                                )}
                              >
                                {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                {option.label}
                                {option.value && filter.counts?.[option.value] !== undefined && (
                                  <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-on-brand/20" : "bg-canvas text-muted")}>{filter.counts[option.value]}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {activeFilterCount > 0 && (
                      <button type="button" onClick={clearFilters} className="min-h-touch self-start px-1 text-sm font-medium text-brand">
                        {t("clearFilters")}
                      </button>
                    )}
                  </div>,
                  "w-[28rem]",
                )}
              </div>
            )}

            {sortableColumns.length > 0 && (
              <div className="relative">
                <button type="button" onClick={() => setMenu(menu === "sort" ? null : "sort")} aria-expanded={menu === "sort"} aria-label={t("sortBy")} className={toolButton(menu === "sort")}>
                  <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden max-w-[10rem] truncate lg:inline">
                    {sortColumn ? `${sortColumn.header} ${sort?.direction === "asc" ? "↑" : "↓"}` : t("defaultOrder")}
                  </span>
                </button>
                {toolMenu(
                  "sort",
                  t("sortBy"),
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => (setSort(null), setMenu(null))} className={menuItem(!sort)}>
                      {!sort ? <Check className="h-4 w-4" aria-hidden="true" /> : <span className="w-4" />}
                      {t("defaultOrder")}
                    </button>
                    {/* One row per column: its name, then low-to-high and high-to-low. */}
                    {sortableColumns.map((column) => (
                      <div key={column.key} className={cn("flex items-center gap-2 rounded-DEFAULT pl-3", sort?.key === column.key && "bg-brand/5")}>
                        {sort?.key === column.key ? <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" /> : <span className="w-4 shrink-0" />}
                        <span className={cn("min-w-0 flex-1 truncate text-sm", sort?.key === column.key && "font-medium text-brand")}>{column.header}</span>
                        {(["asc", "desc"] as const).map((direction) => {
                          const active = sort?.key === column.key && sort.direction === direction;
                          const Arrow = direction === "asc" ? ArrowUp : ArrowDown;
                          return (
                            <button
                              key={direction}
                              type="button"
                              aria-pressed={active}
                              aria-label={`${column.header} ${t(direction === "asc" ? "ascending" : "descending")}`}
                              onClick={() => {
                                setSort({ key: column.key, direction });
                                resetPaging();
                                setMenu(null);
                              }}
                              className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", active ? "bg-brand text-on-brand" : "text-muted hover:bg-canvas hover:text-fg")}
                            >
                              <Arrow className="h-4 w-4" aria-hidden="true" />
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>,
                  "w-64",
                )}
              </div>
            )}

            <div className="relative">
              <button type="button" onClick={() => setMenu(menu === "view" ? null : "view")} aria-expanded={menu === "view"} aria-label={t("view")} className={toolButton(menu === "view")}>
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden xl:inline">{t("view")}</span>
              </button>
              {toolMenu(
                "view",
                t("view"),
                <div className="flex flex-col gap-1">
                  {/* Columns and density shape the laptop's table; phones show cards. */}
                  {wide && (
                    <>
                      <GroupTitle as="p" className="px-3 py-2">{t("showColumns")}</GroupTitle>
                      {columns.map((column) => (
                        <label key={column.key} className={cn("flex min-h-touch items-center gap-3 rounded-DEFAULT px-3 text-sm", column.hideable === false ? "text-muted" : "cursor-pointer hover:bg-canvas")}>
                          <Checkbox
                            checked={!hidden.has(column.key)}
                            disabled={column.hideable === false}
                            onChange={() =>
                              setHidden((prev) => {
                                const next = new Set(prev);
                                if (next.has(column.key)) next.delete(column.key);
                                else next.add(column.key);
                                return next;
                              })
                            }
                          />
                          {column.header}
                        </label>
                      ))}
                      <GroupTitle as="p" className="px-3 pb-1 pt-3">{t("density")}</GroupTitle>
                      <div className="grid grid-cols-2 gap-1 px-1">
                        {(["comfortable", "compact"] as const).map((value) => (
                          <button key={value} type="button" onClick={() => setDensity(value)} aria-pressed={density === value} className={menuItem(density === value)}>
                            {t(value)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <GroupTitle as="p" className="px-3 pb-1 pt-3">{t("rowsPerPage")}</GroupTitle>
                  <div className="grid grid-cols-4 gap-1 px-1">
                    {PAGE_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        aria-pressed={pageSize === size}
                        onClick={() => {
                          setPageSize(size);
                          resetPaging();
                        }}
                        className={cn(menuItem(pageSize === size), "justify-center tabular-nums")}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  <div className="my-1 h-px bg-border" />
                  {selectOnDemand && bulkActions && bulkActions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelecting((on) => !on);
                        setMenu(null);
                      }}
                      className={menuItem(selecting)}
                    >
                      <SquareCheckBig className="h-4 w-4" aria-hidden="true" />
                      {selecting ? t("doneSelecting") : t("select")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null);
                      void exportCsv();
                    }}
                    className={menuItem(false)}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t("exportCsv")}
                  </button>
                </div>,
              )}
            </div>
          </div>

          {/* The filters in use, each removable, and "Clear all". */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map(({ filter, option }) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => {
                    setFilterValues((prev) => ({ ...prev, [filter.key]: "" }));
                    resetPaging();
                  }}
                  aria-label={t("removeFilter", { filter: `${filter.label}: ${option.label}` })}
                  className="inline-flex min-h-touch items-center gap-1.5 rounded-full bg-brand/10 pl-3 pr-2 text-sm font-medium text-brand hover:bg-brand/15"
                >
                  <span className="text-brand/70">{filter.label}:</span> {option.label}
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="min-h-touch px-2 text-sm font-medium text-muted hover:text-fg">
                {t("clearAll")}
              </button>
            </div>
          )}

          {chips && chips.length > 0 && (
            // Phones scroll the chips sideways, with faded edges hinting there's more.
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-24px),transparent)] md:-mx-4 md:px-4 lg:flex-wrap lg:[mask-image:none]">
              {[{ value: "all", label: t("all"), predicate: () => true }, ...chips].map((option) => {
                const count = chipCount(option);
                const active = chip === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setChip(option.value);
                      resetPaging();
                    }}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex min-h-touch shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors",
                      active ? "border-brand bg-brand text-on-brand" : "border-border bg-bg text-muted hover:text-fg",
                    )}
                  >
                    {"icon" in option && option.icon && <option.icon className={cn("h-4 w-4 shrink-0", !active && option.iconClass)} aria-hidden="true" />}
                    {option.label}
                    {count !== null && <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-on-brand/20" : "bg-canvas text-muted")}>{count}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {server && serverState === "failed" ? (
          <div className="p-4">
            <Notice
              tone="danger"
              role="alert"
              action={
                <Button variant="secondary" onClick={() => setRetryCount((count) => count + 1)}>
                  {t("retry")}
                </Button>
              }
            >
              {t("loadFailed")}
            </Notice>
          </div>
        ) : server && !serverPage ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-label={t("loading")}>
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-14" />
            ))}
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
            {emptyArt && <div className="mb-2">{emptyArt}</div>}
            <p className="font-medium text-fg">{search.trim() ? t("noResultsFor", { query: search.trim() }) : (emptyTitle ?? t("noResults"))}</p>
            <p className="text-sm text-muted">{t("noResultsBody")}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {search.trim() && (
                <Button variant="secondary" onClick={clearSearch}>
                  {t("clearSearch")}
                </Button>
              )}
              {activeFilterCount > 0 && (
                <Button variant="secondary" onClick={clearFilters}>
                  {t("clearFilters")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className={cn("transition-opacity", refreshing && "opacity-70")} aria-busy={refreshing || undefined}>
            {/* Laptop: the table scrolls in its own box, so its header row stays in view and pinned columns hold while it scrolls sideways. */}
            <div className="hidden max-h-[calc(100dvh-var(--grid-sticky-top,0px)-12rem)] min-h-[16rem] overflow-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-20 border-b border-border bg-canvas text-xs uppercase tracking-wide text-muted shadow-[0_1px_0_rgb(var(--color-border))]">
                  <tr>
                    {hasSelection && (
                      <th scope="col" className="sticky left-0 z-10 w-12 min-w-12 bg-canvas px-4 py-2">
                        <Checkbox ref={headerCheckbox} aria-label={t("selectPage")} checked={allPageSelected} onChange={togglePage} />
                      </th>
                    )}
                    {rowNumbers && (
                      <th scope="col" className={cn("sticky z-10 w-12 min-w-12 bg-canvas px-2 py-2 text-center font-medium", numberLeft)}>
                        <span aria-hidden="true">#</span>
                        <span className="sr-only">{t("rowNumber")}</span>
                      </th>
                    )}
                    {visibleColumns.map((column) => {
                      const sorted = sort?.key === column.key ? sort.direction : null;
                      const canSort = canSortBy(column);
                      return (
                        <th
                          key={column.key}
                          scope="col"
                          aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                          className={cn("whitespace-nowrap px-4 py-0.5 font-medium", column.align === "right" && "text-right", column.align === "center" && "text-center", pinClass(column, true))}
                        >
                          {canSort ? (
                            <button type="button" onClick={() => toggleSort(column)} className={cn("inline-flex min-h-touch min-w-touch items-center gap-1 uppercase tracking-wide hover:text-fg", sorted && "text-fg")}>
                              {column.header}
                              {sorted === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : sorted === "desc" ? (
                                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                              )}
                            </button>
                          ) : (
                            column.header
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.map((row, index) => {
                    const id = getRowId(row);
                    const isSelected = selected.has(id);
                    const group = groupStart(index);
                    return (
                      <Fragment key={id}>
                        {group && (
                          <tr className="bg-canvas">
                            <th colSpan={visibleColumns.length + (hasSelection ? 1 : 0) + (rowNumbers ? 1 : 0)} scope="rowgroup" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                              <span className="sticky left-4 inline-flex items-center gap-2">
                                {group.icon}
                                <span className={group.labelClass}>{group.label}</span>
                                {group.count !== null && <span className="rounded-full bg-bg px-2 py-0.5 tabular-nums">{group.count}</span>}
                              </span>
                            </th>
                          </tr>
                        )}
                        <tr onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn("group transition-colors", isSelected ? "bg-brand/5" : "hover:bg-canvas/70", onRowClick && "cursor-pointer")}>
                          {hasSelection && (
                            <td className={cn(cellPadding, "sticky left-0 z-10 w-12 min-w-12 bg-bg")} onClick={(e) => e.stopPropagation()}>
                              <Checkbox aria-label={t("selectRow")} checked={isSelected} onChange={() => toggleRow(id)} />
                            </td>
                          )}
                          {rowNumbers && <td className={cn(cellPadding, "sticky z-10 w-12 min-w-12 bg-bg px-2 text-center text-xs tabular-nums text-muted group-hover:bg-canvas", numberLeft)}>{rowNumber(index)}</td>}
                          {visibleColumns.map((column) => (
                            <td
                              key={column.key}
                              className={cn(
                                cellPadding,
                                column.align === "right" && "text-right tabular-nums",
                                column.align === "center" && "text-center",
                                pinClass(column),
                                column.pin && "group-hover:bg-canvas",
                                column.pin && isSelected && "bg-[color-mix(in_srgb,rgb(var(--color-brand))_5%,rgb(var(--color-bg)))]",
                              )}
                            >
                              {column.cell(row)}
                            </td>
                          ))}
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:hidden">
              {pageRows.map((row, index) => {
                const id = getRowId(row);
                const isSelected = selected.has(id);
                const group = groupStart(index);
                return (
                  <Fragment key={id}>
                    {group && (
                      <li className="flex items-center justify-between bg-canvas px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted sm:col-span-2">
                        <span className="flex items-center gap-2">
                          {group.icon}
                          <span className={group.labelClass}>{group.label}</span>
                        </span>
                        {group.count !== null && <span className="rounded-full bg-bg px-2 py-0.5 tabular-nums">{group.count}</span>}
                      </li>
                    )}
                    <li className={cn("flex items-stretch bg-bg", isSelected && "bg-brand/5")}>
                      {hasSelection && (
                        <label className="flex w-12 shrink-0 cursor-pointer items-center justify-center pl-2">
                          <Checkbox className="mt-0.5" aria-label={t("selectRow")} checked={isSelected} onChange={() => toggleRow(id)} />
                        </label>
                      )}
                      {rowNumbers && (
                        <span className="flex w-8 shrink-0 items-center justify-end text-xs tabular-nums text-muted" aria-label={`${t("rowNumber")} ${rowNumber(index)}`}>
                          {rowNumber(index)}
                        </span>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        {onRowClick && renderCardAside ? (
                          <div className="flex min-w-0 flex-1 items-center">
                            <button type="button" onClick={() => onRowClick(row)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left hover:bg-canvas/70">
                              <div className="min-w-0 flex-1">{renderCard(row)}</div>
                            </button>
                            <div className="shrink-0 pr-3">{renderCardAside(row)}</div>
                          </div>
                        ) : onRowClick ? (
                          <button type="button" onClick={() => onRowClick(row)} className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left hover:bg-canvas/70">
                            <div className="min-w-0 flex-1">{renderCard(row)}</div>
                            <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                          </button>
                        ) : (
                          <div className="min-w-0 flex-1 p-4">{renderCard(row)}</div>
                        )}
                        {renderCardAction?.(row)}
                      </div>
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          </div>
        )}

        {/* Laptop: numbered pages. Phone: "Show more" adds the next page under the rows already shown. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2 text-sm">
          <span className="text-muted">{totalCount === 0 ? t("showingNone") : t("showing", { from: shownFrom, to: shownFrom + pageRows.length - 1, total: totalCount })}</span>
          {wide ? (
            pageCount > 1 && (
              <nav aria-label={t("pages")} className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} aria-label={t("previousPage")} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-canvas disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                {pageNumbers(currentPage, pageCount).map((number, index) =>
                  number === null ? (
                    <span key={`gap-${index}`} className="w-6 text-center text-muted" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setPage(number)}
                      aria-current={number === currentPage ? "page" : undefined}
                      aria-label={t("pageNumber", { page: number })}
                      className={cn("flex h-11 min-w-11 items-center justify-center rounded-full px-2 tabular-nums", number === currentPage ? "bg-brand font-semibold text-on-brand" : "hover:bg-canvas")}
                    >
                      {number}
                    </button>
                  ),
                )}
                <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount} aria-label={t("nextPage")} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-canvas disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </nav>
            )
          ) : (
            hasMore && (
              <Button variant="secondary" className="w-full sm:w-auto" onClick={showMore} disabled={refreshing}>
                {t("showMore", { count: Math.min(pageSize, totalCount - pageRows.length) })}
              </Button>
            )
          )}
        </div>

        {/* While rows are chosen: their actions in a bar floating at the bottom of the screen. */}
        {selectedRows.length > 0 && bulkActions && (
          <div
            role="toolbar"
            aria-label={t("selectedCount", { count: selectedRows.length })}
            className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-2xl bg-nav-bg p-2 pl-4 text-nav-fg shadow-raised md:bottom-6"
          >
            <span className="mr-auto text-sm font-semibold">{t("selectedCount", { count: selectedRows.length })}</span>
            {bulkActions.map((action) => {
              const targets = action.applies ? selectedRows.filter(action.applies) : selectedRows;
              return (
                <button
                  key={action.key}
                  type="button"
                  disabled={targets.length === 0}
                  onClick={() => {
                    action.run(targets);
                    setSelected(new Set());
                    setSelecting(false);
                  }}
                  className={cn(
                    "min-h-touch rounded-full px-4 text-sm font-semibold disabled:opacity-40",
                    action.variant === "danger" ? "bg-danger text-white" : action.variant === "primary" ? "bg-nav-accent text-nav-bg" : "bg-nav-fg/10 hover:bg-nav-fg/20",
                  )}
                >
                  {action.label}
                  {action.applies && ` (${targets.length})`}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setSelecting(false);
              }}
              aria-label={t("clearSelection")}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-nav-fg/10"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </Card>
    </GridSearchContext.Provider>
  );
}
