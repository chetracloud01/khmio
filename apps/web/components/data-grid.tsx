"use client";

import { Button, Card, cn, SearchInput } from "@khmio/ui";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Rows3,
  SlidersHorizontal,
  SquareCheckBig,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// The standard data grid for every list in the app (admin and merchant):
// search, quick-filter chips, a filter panel, sortable columns, row selection
// with bulk actions, CSV export, show/hide columns, density and page size.
// Laptop and up shows a table; phones and tablets show cards.

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
}

export interface DataGridChip<T> {
  value: string;
  label: string;
  predicate: (row: T) => boolean;
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
  predicate: (row: T, value: string) => boolean;
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

export function DataGrid<T>({
  rows,
  getRowId,
  columns,
  searchText,
  searchPlaceholder,
  chips,
  initialChip = "all",
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
}: {
  rows: T[];
  getRowId: (row: T) => string;
  columns: DataGridColumn<T>[];
  /** Text the search box matches against. */
  searchText: (row: T) => string;
  searchPlaceholder: string;
  /** Quick one-tap filters shown as chips; "all" is added automatically. */
  chips?: DataGridChip<T>[];
  initialChip?: string;
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
}) {
  const t = useTranslations("DataGrid");
  const [search, setSearch] = useState(initialSearch);
  const [chip, setChip] = useState(initialChip);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
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

  const visibleColumns = columns.filter((column) => !hidden.has(column.key));
  const activeFilterCount = Object.values(filterValues).filter(Boolean).length;

  const groupSpec = typeof groupBy === "function" ? groupBy(chip) : (groupBy ?? null);
  const grouping = groupSpec && (!groupSpec.sortKey || sort?.key === groupSpec.sortKey) ? groupSpec : null;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const chipDef = chips?.find((item) => item.value === chip);
    let result = rows.filter((row) => {
      if (chipDef && !chipDef.predicate(row)) return false;
      for (const filter of filters ?? []) {
        const value = filterValues[filter.key];
        if (value && !filter.predicate(row, value)) return false;
      }
      return !query || searchText(row).toLowerCase().includes(query);
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
  }, [rows, search, chip, chips, filters, filterValues, searchText, sort, columns, grouping]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (grouping) for (const row of filtered) counts.set(grouping.key(row), (counts.get(grouping.key(row)) ?? 0) + 1);
    return counts;
  }, [filtered, grouping]);
  /** The group header to show before this row, or null when it continues the previous row's group. */
  const groupStart = (index: number): { key: string; label: string; count: number; icon: ReactNode; labelClass: string } | null => {
    if (!grouping) return null;
    const row = pageRows[index]!;
    const key = grouping.key(row);
    if (index > 0 && grouping.key(pageRows[index - 1]!) === key) return null;
    return { key, label: grouping.label(row), count: groupCounts.get(key) ?? 0, icon: grouping.icon?.(row) ?? null, labelClass: grouping.labelClass?.(row) ?? "" };
  };

  // Drop selections that are no longer visible after filtering.
  const filteredIds = useMemo(() => new Set(filtered.map(getRowId)), [filtered, getRowId]);
  const selectedRows = filtered.filter((row) => selected.has(getRowId(row)));
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

  function toggleSort(column: DataGridColumn<T>) {
    if (!column.sortable || !column.value) return;
    setSort((prev) =>
      prev?.key !== column.key
        ? { key: column.key, direction: "asc" }
        : prev.direction === "asc"
          ? { key: column.key, direction: "desc" }
          : null,
    );
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

  function exportCsv() {
    const exportRows = selectedRows.length ? selectedRows : filtered;
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

  const sortableColumns = columns.filter((column) => column.sortable && column.value);
  const cellPadding = density === "compact" ? "px-4 py-1.5" : "px-4 py-3";
  const hasSelection = Boolean(bulkActions?.length) && (!selectOnDemand || selecting);

  const sortControl = (
    <label className="flex items-center gap-2 text-sm">
      <ArrowUpDown className="h-4 w-4 text-muted" aria-hidden="true" />
      <span className="text-muted">{t("sortBy")}</span>
      <select
        value={sort ? `${sort.key}:${sort.direction}` : ""}
        onChange={(e) => {
          const [key, direction] = e.target.value.split(":");
          setSort(key && (direction === "asc" || direction === "desc") ? { key, direction } : null);
        }}
        className="min-h-touch flex-1 rounded-DEFAULT border border-border bg-bg px-3 text-sm text-fg"
      >
        <option value="">{t("defaultOrder")}</option>
        {sortableColumns.flatMap((column) => [
          <option key={`${column.key}:asc`} value={`${column.key}:asc`}>
            {column.header} ↑
          </option>,
          <option key={`${column.key}:desc`} value={`${column.key}:desc`}>
            {column.header} ↓
          </option>,
        ])}
      </select>
    </label>
  );

  const toolButton = (active: boolean) =>
    cn(
      "inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-DEFAULT border px-3 text-sm font-medium transition-colors",
      active ? "border-brand bg-brand/10 text-brand" : "border-border bg-bg text-fg hover:bg-canvas",
    );

  return (
    <Card className="flex flex-col p-0">
      {/* Toolbar, or the bulk-action bar while rows are selected. */}
      {selectedRows.length > 0 && bulkActions ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand/5 p-3" role="toolbar">
          <span className="mr-auto px-1 text-sm font-semibold text-fg">
            {t("selectedCount", { count: selectedRows.length })}
          </span>
          {bulkActions.map((action) => {
            const targets = action.applies ? selectedRows.filter(action.applies) : selectedRows;
            return (
              <Button
                key={action.key}
                variant={action.variant ?? "secondary"}
                disabled={targets.length === 0}
                onClick={() => {
                  action.run(targets);
                  setSelected(new Set());
                  setSelecting(false);
                }}
              >
                {action.label}
                {action.applies && ` (${targets.length})`}
              </Button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
              setSelecting(false);
            }}
            aria-label={t("clearSelection")}
            className="flex h-11 w-11 items-center justify-center rounded-DEFAULT text-muted hover:bg-canvas"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 border-b border-border p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 basis-0 sm:basis-56">
              <SearchInput
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPaging();
                }}
              />
            </div>
            {filters && filters.length > 0 && (
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                className={toolButton(filtersOpen || activeFilterCount > 0)}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("filters")}</span>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-brand px-1.5 text-xs text-on-brand">{activeFilterCount}</span>
                )}
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setColumnsOpen((open) => !open)}
                aria-expanded={columnsOpen}
                aria-label={t("columns")}
                // Columns only shape the laptop's table: phones show cards.
                className={cn(toolButton(columnsOpen), "hidden lg:inline-flex")}
              >
                <Columns3 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("columns")}</span>
              </button>
              {columnsOpen && (
                <>
                  <div aria-hidden="true" onClick={() => setColumnsOpen(false)} className="fixed inset-0 z-30" />
                  <div className="absolute right-0 top-12 z-40 w-60 rounded-DEFAULT border border-border bg-bg p-2 shadow-raised">
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("showColumns")}</p>
                    {columns.map((column) => (
                      <label
                        key={column.key}
                        className={cn(
                          "flex min-h-touch items-center gap-3 rounded-DEFAULT px-2 text-sm",
                          column.hideable === false ? "text-muted" : "cursor-pointer hover:bg-canvas",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand"
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
                    <div className="my-1 h-px bg-border" />
                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("density")}</p>
                    <div className="grid grid-cols-2 gap-1 p-1">
                      {(["comfortable", "compact"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setDensity(value)}
                          aria-pressed={density === value}
                          className={cn(
                            "min-h-touch rounded-DEFAULT text-sm",
                            density === value ? "bg-brand/10 font-medium text-brand" : "hover:bg-canvas",
                          )}
                        >
                          {t(value)}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            {selectOnDemand && bulkActions && bulkActions.length > 0 && (
              <button type="button" onClick={() => setSelecting((on) => !on)} aria-pressed={selecting} className={toolButton(selecting)} aria-label={selecting ? t("doneSelecting") : t("select")}>
                <SquareCheckBig className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{selecting ? t("doneSelecting") : t("select")}</span>
              </button>
            )}
            <button type="button" onClick={exportCsv} className={toolButton(false)} aria-label={t("exportCsv")}>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t("exportCsv")}</span>
            </button>
          </div>

          {filtersOpen && filters && (
            <div className="flex flex-wrap items-end gap-3 rounded-DEFAULT bg-canvas p-3">
              {/* Phone: sorting lives here with the filters, so the toolbar stays one row. */}
              {sortableColumns.length > 0 && <div className="w-full lg:hidden">{sortControl}</div>}
              {filters.map((filter) => (
                <label key={filter.key} className="flex min-w-[160px] flex-1 flex-col gap-1 text-sm sm:flex-none">
                  <span className="font-medium text-fg">{filter.label}</span>
                  <select
                    value={filterValues[filter.key] ?? ""}
                    onChange={(e) => {
                      setFilterValues((prev) => ({ ...prev, [filter.key]: e.target.value }));
                      resetPaging();
                    }}
                    className="min-h-touch rounded-DEFAULT border border-border bg-bg px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">{t("all")}</option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterValues({});
                    resetPaging();
                  }}
                  className="min-h-touch px-2 text-sm font-medium text-brand"
                >
                  {t("clearFilters")}
                </button>
              )}
            </div>
          )}

          {chips && chips.length > 0 && (
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:-mx-4 md:px-4 lg:flex-wrap">
              {[{ value: "all", label: t("all"), predicate: () => true }, ...chips].map((option) => {
                const count = rows.filter(option.predicate).length;
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
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs tabular-nums",
                        active ? "bg-on-brand/20" : "bg-canvas text-muted",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Lists without filters keep sorting as its own row on a phone. */}
          {sortableColumns.length > 0 && !(filters && filters.length > 0) && <div className="lg:hidden">{sortControl}</div>}
        </div>
      )}

      {pageRows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
          {emptyArt && <div className="mb-2">{emptyArt}</div>}
          <p className="font-medium text-fg">{emptyTitle ?? t("noResults")}</p>
          <p className="text-sm text-muted">{t("noResultsBody")}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-canvas/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  {hasSelection && (
                    <th scope="col" className="w-12 px-4 py-2">
                      <input
                        ref={headerCheckbox}
                        type="checkbox"
                        className="h-4 w-4 accent-brand"
                        aria-label={t("selectPage")}
                        checked={allPageSelected}
                        onChange={togglePage}
                      />
                    </th>
                  )}
                  {visibleColumns.map((column) => {
                    const sorted = sort?.key === column.key ? sort.direction : null;
                    const canSort = column.sortable && column.value;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                        className={cn(
                          "px-4 py-0.5 font-medium",
                          column.align === "right" && "text-right",
                          column.align === "center" && "text-center",
                        )}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column)}
                            className={cn(
                              "inline-flex min-h-touch min-w-touch items-center gap-1 uppercase tracking-wide hover:text-fg",
                              sorted && "text-fg",
                            )}
                          >
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
                        <th colSpan={visibleColumns.length + (hasSelection ? 1 : 0)} scope="rowgroup" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                          <span className="inline-flex items-center gap-2">
                            {group.icon}
                            <span className={group.labelClass}>{group.label}</span>
                            <span className="rounded-full bg-bg px-2 py-0.5 tabular-nums">{group.count}</span>
                          </span>
                        </th>
                      </tr>
                    )}
                    <tr
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        "transition-colors",
                        isSelected ? "bg-brand/5" : "hover:bg-canvas/70",
                        onRowClick && "cursor-pointer",
                      )}
                    >
                      {hasSelection && (
                        <td className={cellPadding} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand"
                            aria-label={t("selectRow")}
                            checked={isSelected}
                            onChange={() => toggleRow(id)}
                          />
                        </td>
                      )}
                      {visibleColumns.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            cellPadding,
                            column.align === "right" && "text-right tabular-nums",
                            column.align === "center" && "text-center",
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
                    <span className="rounded-full bg-bg px-2 py-0.5 tabular-nums">{group.count}</span>
                  </li>
                )}
                <li className={cn("flex items-stretch bg-bg", isSelected && "bg-brand/5")}>
                  {hasSelection && (
                    <label className="flex w-12 shrink-0 cursor-pointer items-center justify-center pl-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 accent-brand"
                        aria-label={t("selectRow")}
                        checked={isSelected}
                        onChange={() => toggleRow(id)}
                      />
                    </label>
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
                      <button
                        type="button"
                        onClick={() => onRowClick(row)}
                        className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left hover:bg-canvas/70"
                      >
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
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2 text-sm">
        <span className="text-muted">
          {filtered.length === 0
            ? t("showingNone")
            : t("showing", { from: start + 1, to: start + pageRows.length, total: filtered.length })}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-muted">
            <Rows3 className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t("rowsPerPage")}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                resetPaging();
              }}
              aria-label={t("rowsPerPage")}
              className="min-h-touch rounded-DEFAULT border border-border bg-bg px-2 text-sm text-fg"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label={t("previousPage")}
            className="flex h-11 w-11 items-center justify-center rounded-DEFAULT hover:bg-canvas disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="tabular-nums text-muted">
            {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= pageCount}
            aria-label={t("nextPage")}
            className="flex h-11 w-11 items-center justify-center rounded-DEFAULT hover:bg-canvas disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Card>
  );
}
