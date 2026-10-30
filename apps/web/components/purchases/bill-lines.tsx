"use client";

import { itemCostOf, parseQuantityInput, purchaseTotals, unitCostIn, type Currency, type FormErrorCode } from "@khmio/shared";
import { Button, IconButton, Input, QuantityInput, SectionTitle } from "@khmio/ui";
import { PackageSearch, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, type KeyboardEvent, type RefObject } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { formatMoney } from "@/components/order-ui";
import { COST_INPUT, productCostCurrency } from "@/components/stock/item-name";
import type { StockPage } from "@/lib/api";
import type { DraftLine } from "./bill-draft";
import { ItemSearch } from "./item-search";

type Item = StockPage["items"][number];
type Box = "quantity" | "cost";

/** The lines' columns on a laptop: #, item, how many, cost of one, line total, remove. On a phone each line is a card. */
const LINE_GRID = "md:grid md:grid-cols-[1.5rem_minmax(0,1fr)_8.5rem_8rem_6rem_2.75rem] md:items-center md:gap-3";
/** Most "usually from this supplier" chips. */
const MAX_USUAL = 6;

/**
 * The cost of one a new line starts at, in the bill's currency: its last
 * bill's cost, else its average — turned at the bill's rate when the item's
 * cost is kept in the other currency (empty without a rate).
 */
export function startCost(items: Item[], item: Item, currency: Currency, rate: number | null): string {
  const cost = item.lastCostMinor ?? item.costMinor;
  const kept = productCostCurrency(items, item);
  if (cost === null || kept === null) return "";
  if (kept === currency) return COST_INPUT[currency].text(cost);
  const turned = rate === null ? undefined : unitCostIn({ costMinor: cost, costCurrency: kept }, currency, rate);
  return turned === undefined ? "" : COST_INPUT[currency].text(turned);
}

/**
 * The bill's lines read as numbers, each line's total and the bill's, each
 * line's cost in its item's own currency (turned at the rate where it's
 * kept in the other one), whether the bill needs a rate, and whether every
 * line is ready to save.
 */
export function readLines(items: Item[], lines: DraftLine[], currency: Currency, rate: number | null) {
  const parsed = lines.map((line) => ({ variantId: line.variantId, quantity: parseQuantityInput(line.quantity), unitCost: COST_INPUT[currency].parse(line.cost) }));
  const keptIn = (variantId: string) => {
    const item = items.find((entry) => entry.variantId === variantId);
    return item ? productCostCurrency(items, item) : null;
  };
  const needsRate = parsed.some((line) => {
    const kept = keptIn(line.variantId);
    return kept !== null && kept !== currency;
  });
  const itemCosts = parsed.map((line) => (line.unitCost === undefined ? null : itemCostOf(line.unitCost, currency, keptIn(line.variantId), rate)));
  const totals = purchaseTotals(parsed.map((line) => ({ quantity: Number.isNaN(line.quantity) ? 0 : line.quantity, unitCost: line.unitCost ?? 0 })));
  const complete = parsed.length > 0 && parsed.every((line) => !Number.isNaN(line.quantity) && line.quantity > 0 && line.unitCost !== undefined) && (!needsRate || rate !== null);
  return { parsed, totals, complete, needsRate, itemCosts };
}

/**
 * A bill's items (design/screens.md S13 "New bill"): the search (a name, a
 * SKU or a scanned barcode, Enter adds the top match), chips of what's
 * usually bought from the picked supplier (one tap adds it at its last
 * cost), and the lines — a table on a laptop, cards on a phone — with how
 * many (− +), the cost of one and the line's total. Enter moves from how
 * many to the cost and back to the search.
 */
export function BillLines({
  items,
  nameOf,
  currency,
  rate,
  lines,
  onChange,
  supplierId,
  errors,
  searchRef,
}: {
  items: Item[];
  nameOf: (item: Item) => string;
  currency: Currency;
  /** The bill's rate, when it's valid: lines in the other currency show what they turn into. */
  rate: number | null;
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  /** The picked supplier: their usual items are offered. */
  supplierId: string;
  errors: Partial<Record<string, FormErrorCode>>;
  searchRef: RefObject<HTMLInputElement>;
}) {
  const t = useTranslations("Purchases");
  const tStock = useTranslations("Stock");
  const errorText = useFormErrorText();
  const linesRef = useRef<HTMLUListElement>(null);
  const { totals, itemCosts } = readLines(items, lines, currency, rate);
  const byVariant = new Map(items.map((item) => [item.variantId, item]));
  const onBill = new Set(lines.map((line) => line.variantId));
  const usual = supplierId ? items.filter((item) => item.lastSupplierId === supplierId && !onBill.has(item.variantId)).slice(0, MAX_USUAL) : [];

  /** Puts the cursor in one line's box (after the line is drawn). */
  const focusBox = (variantId: string, box: Box) =>
    requestAnimationFrame(() => linesRef.current?.querySelector<HTMLInputElement>(`[data-line="${variantId}"][data-box="${box}"]`)?.focus());
  const add = (item: Item) => {
    onChange([...lines, { variantId: item.variantId, quantity: "1", cost: startCost(items, item, currency, rate) }]);
    focusBox(item.variantId, "quantity");
  };
  const setLine = (index: number, change: Partial<DraftLine>) => onChange(lines.map((line, at) => (at === index ? { ...line, ...change } : line)));
  /** Enter: from how many to the cost, from the cost back to the search for the next item. */
  const onEnter = (variantId: string, box: Box) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (box === "quantity") focusBox(variantId, "cost");
    else searchRef.current?.focus();
  };

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>{t("linesTitle")}</SectionTitle>
      <ItemSearch inputRef={searchRef} items={items} picked={onBill} currency={currency} nameOf={nameOf} onAdd={add} />
      {usual.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">{t("usuallyFrom")}</p>
          <div className="flex flex-wrap gap-2">
            {usual.map((item) => (
              <Button key={item.variantId} size="sm" variant="secondary" onClick={() => add(item)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {nameOf(item)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-8 text-center">
          <PackageSearch className="h-8 w-8 text-muted" aria-hidden="true" />
          <p className="text-sm text-muted">{t("noLines")}</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* The table's header on a laptop; on a phone each box carries its own label. */}
          <div className={`hidden border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted ${LINE_GRID}`} aria-hidden="true">
            <span>#</span>
            <span>{t("colItem")}</span>
            <span className="text-center">{t("quantityLabel")}</span>
            <span>{tStock(COST_INPUT[currency].label)}</span>
            <span className="text-right">{t("colLineTotal")}</span>
            <span />
          </div>
          <ul ref={linesRef} className="flex flex-col gap-3 md:gap-0">
            {lines.map((line, index) => {
              const item = byVariant.get(line.variantId);
              const name = item ? nameOf(item) : "";
              const remove = () => onChange(lines.filter((_, at) => at !== index));
              return (
                <li key={line.variantId} className={`flex flex-col gap-3 rounded-xl border border-border p-3 md:rounded-none md:border-0 md:border-b md:px-0 md:py-2 md:[&_label]:sr-only ${LINE_GRID}`}>
                  <span className="hidden text-xs tabular-nums text-muted md:block">{index + 1}</span>
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-medium leading-snug">{name}</p>
                      <p className="truncate text-xs text-muted">{[item?.sku, item?.onHand === null ? t("startsTracking") : t("onHandCount", { count: item?.onHand ?? 0 })].filter(Boolean).join(" · ")}</p>
                    </div>
                    <IconButton className="md:hidden" icon={Trash2} tone="danger" label={t("removeLine", { name })} onClick={remove} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:contents">
                    <QuantityInput
                      label={t("quantityLabel")}
                      value={line.quantity}
                      onChange={(text) => setLine(index, { quantity: text })}
                      decreaseLabel={t("oneLess", { name })}
                      increaseLabel={t("oneMore", { name })}
                      min={1}
                      data-line={line.variantId}
                      data-box="quantity"
                      onKeyDown={onEnter(line.variantId, "quantity")}
                      error={errorText(errors[`lines.${index}.quantity`])}
                    />
                    <Input
                      label={tStock(COST_INPUT[currency].label)}
                      inputMode={COST_INPUT[currency].inputMode}
                      value={line.cost}
                      onChange={(event) => setLine(index, { cost: event.target.value })}
                      data-line={line.variantId}
                      data-box="cost"
                      onKeyDown={onEnter(line.variantId, "cost")}
                      error={errorText(errors[`lines.${index}.unitCost`]) ?? errorText(errors[`lines.${index}.variantId`])}
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      <span className="font-normal text-muted md:hidden">{t("colLineTotal")} </span>
                      {formatMoney(totals.lines[index]?.lineTotal ?? 0, currency)}
                    </p>
                    {/* Kept in the other currency: what one turns into at the bill's rate (what goes into its average). */}
                    {itemCosts[index] && itemCosts[index]?.currency !== currency && (
                      <p className="text-xs text-muted tabular-nums">{t("turnedEach", { amount: formatMoney(itemCosts[index]?.minor ?? 0, itemCosts[index]?.currency ?? currency) })}</p>
                    )}
                  </div>
                  <IconButton className="hidden md:flex" icon={Trash2} tone="danger" label={t("removeLine", { name })} onClick={remove} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {errorText(errors.lines) && <p className="text-sm text-danger">{errorText(errors.lines)}</p>}
    </section>
  );
}
