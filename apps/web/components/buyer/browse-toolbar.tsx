"use client";

import { cn, SearchInput } from "@khmio/ui";
import { ArrowUpDown, ChevronDown, History, LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { PRODUCT_SORTS, type ProductBrowse, type ProductSort } from "./use-product-browse";

/** One pill style for the category chips, Grid / List and Sort. */
const PILL = "flex min-h-touch shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors";
const PILL_ACTIVE = "border-brand bg-brand text-on-brand";
const PILL_IDLE = "border-border bg-bg text-fg hover:border-brand/40";

/**
 * The pinned top of the shop's list (design/screens.md B1): search with the
 * buyer's recent searches, category chips with how many products each has,
 * then grid-or-list and sort. One block for the live shop
 * and its mockup.
 */
export function BrowseToolbar({
  browse,
  categories,
  leading,
}: {
  browse: Pick<ProductBrowse, "query" | "setQuery" | "category" | "setCategory" | "sort" | "setSort" | "view" | "setView" | "recent" | "remember" | "clearRecent" | "counts" | "shown">;
  categories: { id: string; label: string }[];
  /** Shown before the search box, e.g. the shop's logo once its header has scrolled away. */
  leading?: ReactNode;
}) {
  const t = useTranslations("Storefront");
  const [focused, setFocused] = useState(false);
  const words = browse.query.trim();
  const showRecent = focused && !words && browse.recent.length > 0;
  // Only categories the search still finds get a chip (with "All" first).
  const chips = [{ id: "all", label: t("categoryAll") }, ...categories.filter((entry) => (browse.counts[entry.id] ?? 0) > 0)];

  return (
    <div className="sticky top-0 z-20 flex flex-col gap-2 border-b border-border bg-bg/95 pb-2 pt-2 backdrop-blur supports-[backdrop-filter]:bg-bg/85">
      <div className="flex items-center gap-2 px-4">
        {leading}
        <div className="relative min-w-0 flex-1">
          <SearchInput
            value={browse.query}
            onChange={(event) => browse.setQuery(event.target.value)}
            onClear={() => browse.setQuery("")}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              browse.remember(browse.query);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                browse.remember(browse.query);
                event.currentTarget.blur();
              }
            }}
            enterKeyHint="search"
            clearLabel={t("clearSearch")}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
          />
          {showRecent && (
            // onMouseDown keeps the search box focused until the tap lands on a suggestion.
            <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-border bg-bg shadow-raised" onMouseDown={(event) => event.preventDefault()}>
              <div className="flex items-center justify-between px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                <span>{t("recentSearches")}</span>
                <button type="button" onClick={browse.clearRecent} className="-mr-2 flex min-h-touch items-center px-2 font-medium normal-case tracking-normal text-brand">
                  {t("clearRecent")}
                </button>
              </div>
              <ul>
                {browse.recent.map((entry) => (
                  <li key={entry}>
                    <button
                      type="button"
                      onClick={() => {
                        browse.setQuery(entry);
                        setFocused(false);
                        (document.activeElement as HTMLElement | null)?.blur();
                      }}
                      className="flex min-h-touch w-full items-center gap-3 px-3 text-left text-sm hover:bg-border/20"
                    >
                      <History className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate">{entry}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {chips.length > 1 && (
        <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4">
          {chips.map((chip) => {
            const active = browse.category === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => browse.setCategory(chip.id)}
                aria-pressed={active}
                className={cn(PILL, "snap-start pr-2", active ? PILL_ACTIVE : PILL_IDLE)}
              >
                {chip.label}
                <span className={cn("min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums", active ? "bg-on-brand/20" : "bg-border/50 text-muted")}>
                  {browse.counts[chip.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Grid / List and Sort: pills like the category chips above. The count is read out only (screen readers). */}
      <p className="sr-only" role="status" aria-live="polite">
        {words ? t("resultCount", { count: browse.shown.length }) : t("productCount", { count: browse.shown.length })}
      </p>
      <div className="flex items-center gap-2 px-4">
        <div className="flex shrink-0 gap-2" role="group" aria-label={t("viewLabel")}>
          {(
            [
              { value: "grid", icon: LayoutGrid, label: t("viewGrid") },
              { value: "list", icon: List, label: t("viewList") },
            ] as const
          ).map((option) => {
            const active = browse.view === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => browse.setView(option.value)}
                aria-pressed={active}
                className={cn(PILL, active ? PILL_ACTIVE : PILL_IDLE)}
              >
                <option.icon className="h-4 w-4" aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>
        <label className={cn(PILL, PILL_IDLE, "relative ml-auto min-w-0 shrink px-3")}>
          <ArrowUpDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">{t("sortLabel")}</span>
          <select
            value={browse.sort}
            onChange={(event) => browse.setSort(event.target.value as ProductSort)}
            className="min-h-touch w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent focus:outline-none"
          >
            {PRODUCT_SORTS.map((value) => (
              <option key={value} value={value}>
                {t(`sort_${value}`)}
              </option>
            ))}
          </select>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        </label>
      </div>

    </div>
  );
}
