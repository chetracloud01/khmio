"use client";

import { MAX_BILL_REF_LENGTH, type Currency, type FormErrorCode } from "@khmio/shared";
import { Button, Card, Input, Notice } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { productCostCurrency } from "@/components/stock/item-name";
import { api, ApiError, type PurchaseDetail, purchaseDetailSchema, type StockPage, type Supplier } from "@/lib/api";
import { draftHasWork, dueOnOf, emptyDraft, rateOf, useBillDraft, type BillDraft } from "./bill-draft";
import { BillLines, readLines, startCost } from "./bill-lines";
import { BillSaveBar, BillSummary } from "./bill-summary";
import { ReceivedSheet } from "./received-sheet";
import { SupplierPicker } from "./supplier-picker";
import { SupplierSheet } from "./supplier-sheet";

type Item = StockPage["items"][number];

/**
 * A supplier bill (design/screens.md S13 "New bill"), laid out like an
 * invoice: on a laptop the bill on the left — who it's from and their bill
 * number, then the items — and the summary on the right, in view while
 * scrolling (day, currency, total, payment, note, Save bill); on a phone the
 * same blocks stacked, with the total and Save fixed above the bottom menu.
 * The bill being typed is kept in this browser until it's saved
 * (bill-draft.ts). Save asks whether the goods have arrived, then saves all
 * at once (POST /purchases): received, stock goes up and each item's cost
 * moves to the average; not yet, that waits for "Received". A saved bill
 * isn't edited.
 */
export function PurchaseForm({
  items,
  suppliers: initialSuppliers,
  shopCurrency,
  shopRate,
  rateBand,
  nameOf,
  draftKey,
  start = { lines: [], supplierId: null },
  onSaved,
  onCancel,
}: {
  /** The shop's items (the Stock page's), to pick from. */
  items: Item[];
  suppliers: Supplier[];
  shopCurrency: Currency;
  /** Riel per $1 a bill starts at, for lines in the other currency. */
  shopRate: number;
  /** The rates the platform allows. */
  rateBand: { min: number; max: number };
  nameOf: (item: Item) => string;
  /** Where this browser keeps the bill being typed (one per shop). */
  draftKey: string;
  /** Opened with something to buy (Create bill from the Stock list, New bill from a supplier): it starts the bill instead of a kept draft. */
  start?: { lines: { variantId: string; quantity: number }[]; supplierId: string | null };
  onSaved: (purchase: PurchaseDetail) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Purchases");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const searchRef = useRef<HTMLInputElement>(null);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [newSupplierName, setNewSupplierName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  /** The bill the page was opened with: its items at their suggested quantities and last costs, in their shared currency. */
  const startDraft = (): BillDraft => {
    const started = start.lines.flatMap((line) => {
      const item = items.find((entry) => entry.variantId === line.variantId);
      return item ? [{ item, quantity: line.quantity }] : [];
    });
    const kept = new Set(started.map(({ item }) => productCostCurrency(items, item)).filter((currency): currency is Currency => currency !== null));
    const [currency = shopCurrency] = kept.size === 1 ? [...kept] : [];
    return {
      ...emptyDraft(currency, shopRate),
      supplierId: start.supplierId && initialSuppliers.some((supplier) => supplier.id === start.supplierId) ? start.supplierId : "",
      lines: started.map(({ item, quantity }) => ({ variantId: item.variantId, quantity: String(quantity), cost: startCost(items, item, currency, shopRate) })),
    };
  };
  const { draft, setDraft, restored, clear } = useBillDraft(draftKey, startDraft, start.lines.length > 0 || start.supplierId !== null);
  const change = (next: Partial<BillDraft>) => setDraft((current) => ({ ...current, ...next }));
  const rate = rateOf(draft.exchangeRate, rateBand);
  const { parsed, totals, complete, needsRate } = readLines(items, draft.lines, draft.currency, rate);

  // Closing or reloading the tab with unsaved lines asks first (the draft is kept either way).
  useEffect(() => {
    if (!draftHasWork(draft)) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);

  /** Saves the bill, received (stock goes up now) or not yet (with "Received" later). */
  async function save(received: boolean) {
    setBusy(true);
    setProblem(null);
    setErrors({});
    try {
      const dueOn = dueOnOf(draft);
      const body = {
        purchasedOn: draft.purchasedOn,
        currency: draft.currency,
        ...(needsRate && rate !== null ? { exchangeRate: rate } : {}),
        billRef: draft.billRef,
        note: draft.note,
        received,
        ...(draft.supplierId ? { supplierId: draft.supplierId } : {}),
        ...(draft.paidNow ? { payment: { method: draft.method } } : dueOn ? { dueOn } : {}),
        lines: parsed.map((line) => ({ variantId: line.variantId, quantity: line.quantity, unitCost: line.unitCost })),
      };
      const saved = await api("/purchases", purchaseDetailSchema, { method: "POST", body });
      clear(emptyDraft(draft.currency, shopRate));
      setAsking(false);
      onSaved(saved);
    } catch (failure) {
      // The question closes so what's wrong shows on the form.
      setAsking(false);
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) setErrors(failure.fields);
      else setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  // Save asks first whether the goods have arrived.
  const saving = { ready: complete && draft.purchasedOn !== "", busy, onSave: () => setAsking(true) };

  return (
    <div className="flex flex-col gap-4 pb-24 lg:pb-0">
      {restored && (
        <Notice tone="info">
          <span className="flex flex-wrap items-center justify-between gap-2">
            {t("draftRestored")}
            <Button size="sm" variant="ghost" onClick={() => clear(emptyDraft(shopCurrency, shopRate))}>
              {t("draftClear")}
            </Button>
          </span>
        </Notice>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <Card className="flex flex-col gap-6 p-4 md:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SupplierPicker suppliers={suppliers} value={draft.supplierId} onChange={(supplierId) => change({ supplierId })} onAddNew={setNewSupplierName} error={errorText(errors.supplierId)} />
            <Input label={t("billRefLabel")} placeholder={t("billRefPlaceholder")} maxLength={MAX_BILL_REF_LENGTH} value={draft.billRef} onChange={(event) => change({ billRef: event.target.value })} error={errorText(errors.billRef)} />
          </div>
          <BillLines
            items={items}
            nameOf={nameOf}
            currency={draft.currency}
            rate={rate}
            lines={draft.lines}
            onChange={(lines) => change({ lines })}
            supplierId={draft.supplierId}
            errors={errors}
            searchRef={searchRef}
          />
        </Card>
        <div className="lg:sticky lg:top-20">
          <BillSummary draft={draft} onChange={change} itemCount={draft.lines.length} total={totals.total} needsRate={needsRate} rateBand={rateBand} errors={errors} problem={problem} saving={saving} onCancel={onCancel} />
        </div>
      </div>
      <BillSaveBar itemCount={draft.lines.length} total={totals.total} currency={draft.currency} saving={saving} />

      {asking && <ReceivedSheet busy={busy} onConfirm={(received) => void save(received)} onClose={() => setAsking(false)} />}
      {newSupplierName !== null && (
        <SupplierSheet
          supplier={null}
          startName={newSupplierName}
          onClose={() => setNewSupplierName(null)}
          onSaved={(supplier) => {
            setSuppliers((current) => [...current, supplier].sort((a, b) => a.name.localeCompare(b.name)));
            change({ supplierId: supplier.id });
          }}
        />
      )}
    </div>
  );
}
