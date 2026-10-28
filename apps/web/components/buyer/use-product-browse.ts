"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { readStored, writeStored } from "@/lib/device-storage";
import type { ProductView } from "./product-tile";

export type ProductSort = "newest" | "price_asc" | "price_desc" | "discount";
export const PRODUCT_SORTS: readonly ProductSort[] = ["newest", "price_asc", "price_desc", "discount"];

/** How the shop's list reads a product, from the API's product. */
export interface BrowseAccessors<T> {
  /** Both languages: a buyer may type "coffee" on the Khmer page. */
  text: (item: T) => string;
  category: (item: T) => string;
  /** One currency for comparing, e.g. USD cents with riel-only prices converted. */
  price: (item: T) => number;
  discount: (item: T) => number;
}

const MAX_RECENT = 5;
const VIEW_KEY = "khmio.shopView";
const recentKey = (shop: string) => `khmio.recentSearches.${shop}`;

const productViewSchema = z.enum(["grid", "list"]) satisfies z.ZodType<ProductView>;

/**
 * The shop list's search, category, sort, grid-or-list and recent searches
 * (design/screens.md B1). The grid-or-list choice and the last searches are
 * kept on this phone only.
 */
export function useProductBrowse<T>(items: readonly T[], get: BrowseAccessors<T>, shopKey: string) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [view, setViewState] = useState<ProductView>("grid");
  const [recent, setRecent] = useState<string[]>([]);

  // After the first paint, so the server's page and the browser's agree.
  useEffect(() => {
    setViewState(readStored(VIEW_KEY, productViewSchema) ?? "grid");
    setRecent((readStored(recentKey(shopKey), z.array(z.string())) ?? []).slice(0, MAX_RECENT));
  }, [shopKey]);

  const setView = useCallback((next: ProductView) => {
    setViewState(next);
    writeStored(VIEW_KEY, next);
  }, []);

  /** Keeps a search worth repeating (2+ characters), newest first. */
  const remember = useCallback(
    (words: string) => {
      const trimmed = words.trim();
      if (trimmed.length < 2) return;
      setRecent((current) => {
        const next = [trimmed, ...current.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
        writeStored(recentKey(shopKey), next);
        return next;
      });
    },
    [shopKey],
  );
  const clearRecent = useCallback(() => {
    setRecent([]);
    writeStored(recentKey(shopKey), []);
  }, [shopKey]);

  const { text, category: categoryOf, price, discount } = get;
  const words = query.trim().toLowerCase();
  const matching = useMemo(() => items.filter((item) => text(item).toLowerCase().includes(words)), [items, text, words]);

  /** How many products each category chip has — among those the search finds. */
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: matching.length };
    for (const item of matching) result[categoryOf(item)] = (result[categoryOf(item)] ?? 0) + 1;
    return result;
  }, [matching, categoryOf]);

  const shown = useMemo(() => {
    const inCategory = matching.filter((item) => category === "all" || categoryOf(item) === category);
    if (sort === "newest") return inCategory;
    // Array.sort is stable: ties keep the shop's own order (newest first).
    const sorted = [...inCategory];
    if (sort === "price_asc") sorted.sort((a, b) => price(a) - price(b));
    if (sort === "price_desc") sorted.sort((a, b) => price(b) - price(a));
    if (sort === "discount") sorted.sort((a, b) => discount(b) - discount(a));
    return sorted;
  }, [matching, category, sort, categoryOf, price, discount]);

  return { query, setQuery, category, setCategory, sort, setSort, view, setView, recent, remember, clearRecent, counts, shown };
}

export type ProductBrowse = ReturnType<typeof useProductBrowse>;
