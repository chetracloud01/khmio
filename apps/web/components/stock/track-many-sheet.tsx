"use client";

import { parseQuantityInput, type Currency, type FormErrorCode } from "@khmio/shared";
import { BottomSheet, Button, Input, Notice, QuantityInput } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { CostCurrencyChoice } from "@/components/product-form/price-inputs";
import { api, ApiError, type StockPage, stockPageSchema } from "@/lib/api";
import { COST_INPUT } from "./item-name";

type Item = StockPage["items"][number];
type Row = { onHand: string; cost: string };

/**
 * Opening stock for many items at once (design/screens.md S13 "Set opening
 * stock"), from the Stock list's selection: for each, what's on the shelf (0 =
 * none yet) and what one cost (optional; it starts the item's average), saved
 * together — all or nothing (POST /stock/track-many). An item whose product
 * already keeps a cost currency is costed in it; the others in the currency
 * picked here.
 */
export function TrackManySheet({
  items,
  nameOf,
  currencyOf,
  shopCurrency,
  onClose,
  onSaved,
}: {
  items: Item[];
  nameOf: (item: Item) => string;
  /** The product's one cost currency, when it has one. */
  currencyOf: (item: Item) => Currency | null;
  shopCurrency: Currency;
  onClose: () => void;
  onSaved: (page: StockPage) => void;
}) {
  const t = useTranslations("Stock");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(items.map((item) => [item.variantId, { onHand: "0", cost: "" }])));
  const [newCurrency, setNewCurrency] = useState<Currency>(shopCurrency);
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currencyFor = (item: Item) => currencyOf(item) ?? newCurrency;
  const read = items.map((item) => {
    const row = rows[item.variantId] ?? { onHand: "", cost: "" };
    const currency = currencyFor(item);
    return { item, onHand: parseQuantityInput(row.onHand), cost: row.cost.trim() ? COST_INPUT[currency].parse(row.cost) : undefined, costTyped: row.cost.trim() !== "", currency };
  });
  const valid = read.every((entry) => !Number.isNaN(entry.onHand) && (!entry.costTyped || entry.cost !== undefined));
  const setRow = (variantId: string, change: Partial<Row>) => setRows((current) => ({ ...current, [variantId]: { ...(current[variantId] ?? { onHand: "", cost: "" }), ...change } }));

  async function save() {
    setBusy(true);
    setProblem(null);
    try {
      const body = { items: read.map((entry) => ({ variantId: entry.item.variantId, onHand: entry.onHand, ...(entry.cost !== undefined ? { unitCost: entry.cost, costCurrency: entry.currency } : {}) })) };
      onSaved(await api("/stock/track-many", stockPageSchema, { method: "POST", body }));
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) setErrors(failure.fields);
      else setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      closeLabel={t("cancel")}
      title={t("openingManyTitle", { count: items.length })}
      placement="center"
      footer={
        <Button variant="primary" fullWidth loading={busy} disabled={!valid} onClick={() => void save()}>
          {t("openingSave")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("openingManyHint")}</p>
        {items.some((item) => currencyOf(item) === null) && <CostCurrencyChoice label={t("openingNewCurrency")} value={newCurrency} onChange={setNewCurrency} />}
        <ul className="flex flex-col divide-y divide-border">
          {read.map(({ item, onHand, costTyped, cost, currency }, index) => (
            <li key={item.variantId} className="flex flex-col gap-2 py-3">
              <p className="font-medium">{nameOf(item)}</p>
              <div className="grid grid-cols-2 gap-3">
                <QuantityInput
                  label={t("countNow")}
                  value={rows[item.variantId]?.onHand ?? ""}
                  onChange={(text) => setRow(item.variantId, { onHand: text })}
                  decreaseLabel={t("countLess", { name: nameOf(item) })}
                  increaseLabel={t("countMore", { name: nameOf(item) })}
                  error={Number.isNaN(onHand) ? errorText("quantity_invalid") : errorText(errors[`items.${index}.onHand`])}
                />
                <Input
                  label={t(currency === "USD" ? "openingCostUsd" : "openingCostKhr")}
                  inputMode={COST_INPUT[currency].inputMode}
                  value={rows[item.variantId]?.cost ?? ""}
                  onChange={(event) => setRow(item.variantId, { cost: event.target.value })}
                  error={costTyped && cost === undefined ? errorText("price_invalid") : errorText(errors[`items.${index}.unitCost`])}
                />
              </div>
            </li>
          ))}
        </ul>
        {problem && (
          <Notice tone="danger" role="alert">
            {problem}
          </Notice>
        )}
      </div>
    </BottomSheet>
  );
}
