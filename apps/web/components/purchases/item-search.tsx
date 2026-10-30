"use client";

import type { Currency } from "@khmio/shared";
import { SearchInput } from "@khmio/ui";
import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type Ref } from "react";
import { productCostCurrency } from "@/components/stock/item-name";
import type { StockPage } from "@/lib/api";

type Item = StockPage["items"][number];

/** Most matches listed under the box: typing narrows the rest. */
const MAX_MATCHES = 8;

/**
 * Add items to a bill: type a name or SKU (or scan a barcode into the box),
 * Enter adds the top match, or tap one. An item whose cost is kept in the
 * other currency says so: it's turned at the bill's rate when the bill is
 * saved.
 */
export function ItemSearch({
  items,
  picked,
  currency,
  nameOf,
  onAdd,
  inputRef,
}: {
  items: Item[];
  /** Already on the bill: shown as added. */
  picked: ReadonlySet<string>;
  currency: Currency;
  nameOf: (item: Item) => string;
  onAdd: (item: Item) => void;
  /** The page puts the cursor back here after a line's cost (Enter). */
  inputRef?: Ref<HTMLInputElement>;
}) {
  const t = useTranslations("Purchases");
  const [search, setSearch] = useState("");
  const words = search.trim().toLowerCase();
  const otherCurrency = (item: Item) => {
    const kept = productCostCurrency(items, item);
    return kept !== null && kept !== currency ? kept : null;
  };
  // An exact SKU (a scanned barcode) comes first.
  const matches = words
    ? items
        .filter((item) => `${nameOf(item)} ${item.titleKm} ${item.titleEn} ${item.sku}`.toLowerCase().includes(words))
        .sort((a, b) => Number(b.sku.toLowerCase() === words) - Number(a.sku.toLowerCase() === words))
        .slice(0, MAX_MATCHES)
    : [];
  const add = (item: Item) => {
    onAdd(item);
    setSearch("");
  };
  const addable = (item: Item) => !picked.has(item.variantId);

  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        ref={inputRef}
        label={t("addItems")}
        placeholder={t("searchItemsHint")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const first = matches.find(addable);
          if (first) add(first);
        }}
        onClear={() => setSearch("")}
        clearLabel={t("clear")}
      />
      {words && (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-bg shadow-card">
          {matches.length === 0 && <li className="p-3 text-center text-sm text-muted">{t("noItemsFound")}</li>}
          {matches.map((item) => {
            const kept = otherCurrency(item);
            const added = picked.has(item.variantId);
            return (
              <li key={item.variantId}>
                <button
                  type="button"
                  disabled={!addable(item)}
                  onClick={() => add(item)}
                  className="flex min-h-touch w-full items-center gap-3 px-3 py-2 text-left hover:bg-border/20 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{nameOf(item)}</span>
                    <span className="block truncate text-xs text-muted">
                      {[item.sku, item.onHand === null ? t("notTrackedYet") : t("onHandCount", { count: item.onHand }), ...(kept ? [t(`costKeptIn_${kept}`)] : [])].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {added ? <Check className="h-5 w-5 shrink-0 text-success" aria-label={t("added")} /> : <Plus className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
