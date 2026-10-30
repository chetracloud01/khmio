"use client";

import { formatKhmerPhoneLocal } from "@khmio/shared";
import { Button, Input } from "@khmio/ui";
import { Plus, Truck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type KeyboardEvent } from "react";
import type { Supplier } from "@/lib/api";

/** Most suppliers the list under the box shows; typing narrows the rest. */
const MAX_MATCHES = 8;

/**
 * Who a bill is from (design/screens.md S13 "New bill"): type part of a name
 * or phone and pick from the list (arrows and Enter, or tap); nobody matches
 * → "Add … as a new supplier" (the page opens the supplier sheet with that
 * name). Picked, the supplier shows with a button to change it. Leaving it
 * empty is a bill with no supplier.
 */
export function SupplierPicker({
  suppliers,
  value,
  onChange,
  onAddNew,
  error,
}: {
  /** Live suppliers (archived ones aren't offered). */
  suppliers: Supplier[];
  /** The picked supplier's id; "" = none. */
  value: string;
  onChange: (supplierId: string) => void;
  /** Add a supplier with this name (as typed). */
  onAddNew: (name: string) => void;
  error?: string;
}) {
  const t = useTranslations("Purchases");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const picked = suppliers.find((supplier) => supplier.id === value);

  if (picked) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-fg">{t("supplierLabel")}</p>
        <div className="flex min-h-touch items-center gap-3 rounded-DEFAULT border border-brand/40 bg-brand/5 px-3">
          <Truck className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{picked.name}</span>
            {picked.phone && <span className="block truncate text-xs text-muted">{formatKhmerPhoneLocal(picked.phone)}</span>}
          </span>
          <Button size="sm" variant="ghost" onClick={() => onChange("")}>
            <X className="h-4 w-4" aria-hidden="true" />
            {t("changeSupplier")}
          </Button>
        </div>
      </div>
    );
  }

  const words = query.trim().toLowerCase();
  const matches = suppliers.filter((supplier) => !words || `${supplier.name} ${supplier.phone} ${formatKhmerPhoneLocal(supplier.phone)}`.toLowerCase().includes(words)).slice(0, MAX_MATCHES);
  // The last row: add what was typed as a new supplier.
  const rows = matches.length + (words ? 1 : 0);
  const choose = (index: number) => {
    const supplier = matches[index];
    if (supplier) onChange(supplier.id);
    else if (words) onAddNew(query.trim());
    setQuery("");
    setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (rows > 0) setActive((current) => (current + (event.key === "ArrowDown" ? 1 : rows - 1)) % rows);
    } else if (event.key === "Enter" && open && rows > 0) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") setOpen(false);
  };
  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <div className="relative">
      <Input
        label={t("supplierLabel")}
        placeholder={t("supplierSearchPlaceholder")}
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows > 0 ? optionId(active) : undefined}
        onFocus={() => setOpen(true)}
        // Let a tap on the list land before it closes.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        error={error}
      />
      {open && rows > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 flex max-h-72 flex-col overflow-y-auto rounded-xl border border-border bg-bg p-1 shadow-raised">
          {matches.map((supplier, index) => (
            <li
              key={supplier.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
              className={`flex min-h-touch cursor-pointer flex-col justify-center rounded-lg px-3 ${index === active ? "bg-brand/10" : "hover:bg-border/20"}`}
            >
              <span className="truncate text-sm font-medium">{supplier.name}</span>
              {supplier.phone && <span className="truncate text-xs text-muted">{formatKhmerPhoneLocal(supplier.phone)}</span>}
            </li>
          ))}
          {words && (
            <li
              id={optionId(matches.length)}
              role="option"
              aria-selected={active === matches.length}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(matches.length)}
              className={`flex min-h-touch cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-brand ${active === matches.length ? "bg-brand/10" : "hover:bg-border/20"}`}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t("addSupplierNamed", { name: query.trim() })}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
