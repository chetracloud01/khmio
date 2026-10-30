"use client";

import { MAX_STOCK_NOTE_LENGTH, parseQuantityInput, phnomPenhDay, STOCK_CHANGE_REASONS, stockAdjustmentReasonSchema, type Currency, type FormErrorCode, type StockAdjustmentReason } from "@khmio/shared";
import { BottomSheet, Button, ChoiceCards, ConfirmDialog, Input, Notice, QuantityInput, Select } from "@khmio/ui";
import { ArrowDownCircle, ArrowUpCircle, ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { CostCurrencyChoice } from "@/components/product-form/price-inputs";
import { api, ApiError, purchaseDetailSchema, type StockPage, stockPageSchema, type Supplier } from "@/lib/api";
import { COST_INPUT } from "./item-name";

// Changing one product option's stock (design/screens.md S13 "Change
// stock"), from the Stock list or the item's page. Not tracked yet: set its
// opening stock — what's on the shelf and what one cost, no bill. Tracked:
// pick what happened — bought from a supplier (a one-line bill, paid in
// cash), went up (not bought) or went down (not sold) — then the reason, how
// many and a note. The page gets the whole Stock page back after every save.

type Item = StockPage["items"][number];
/** What happened to the stock: bought (a bill), went up or went down (with a reason). */
export type StockSheetMode = "bought" | "up" | "down";
const DIRECTION = { up: "adjust_in", down: "adjust_out" } as const;
const KINDS = [
  { value: "bought", icon: ReceiptText },
  { value: "up", icon: ArrowUpCircle },
  { value: "down", icon: ArrowDownCircle },
] as const;

export function ManageSheet({
  item,
  title,
  costCurrency,
  shopCurrency,
  suppliers,
  initialMode,
  onReorderLevels,
  onClose,
  onSaved,
}: {
  item: Item;
  title: string;
  costCurrency: Currency | null;
  /** The shop's main currency: where a product without a cost yet starts. */
  shopCurrency: Currency;
  /** The live suppliers to pick from (archived ones are left out). */
  suppliers: Supplier[];
  /** Open on this change already chosen; left out, the person picks. */
  initialMode?: StockSheetMode;
  /** Opens the item's reorder levels (this sheet closes). */
  onReorderLevels: () => void;
  onClose: () => void;
  onSaved: (page: StockPage) => void;
}) {
  const t = useTranslations("Stock");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const tracked = item.onHand !== null;
  const [mode, setMode] = useState<StockSheetMode | null>(initialMode ?? null);
  const [quantity, setQuantity] = useState(tracked ? "1" : "0");
  const [reason, setReason] = useState<StockAdjustmentReason | null>(null);
  const [note, setNote] = useState("");
  const [currency, setCurrency] = useState<Currency>(costCurrency ?? shopCurrency);
  const [costText, setCostText] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingStop, setConfirmingStop] = useState(false);

  /** Saves, then hands the page the Stock page as it now is. */
  async function run(save: () => Promise<StockPage>) {
    setBusy(true);
    setProblem(null);
    try {
      onSaved(await save());
      onClose();
    } catch (failure) {
      // A bill's errors come back under its one line ("lines.0.quantity"): shown on this sheet's boxes.
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) setErrors(Object.fromEntries(Object.entries(failure.fields).map(([key, code]) => [key.replace(/^lines\.0\./, ""), code])));
      else setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  const amount = parseQuantityInput(quantity);
  const unitCost = costText.trim() ? COST_INPUT[currency].parse(costText) : undefined;
  const costTypedWrong = costText.trim() !== "" && unitCost === undefined;
  const send = (path: string, method: "POST" | "DELETE", body?: object) => run(() => api(path, stockPageSchema, { method, body }));
  const buy = () =>
    run(async () => {
      await api("/purchases", purchaseDetailSchema, {
        method: "POST",
        body: {
          purchasedOn: phnomPenhDay(new Date()),
          currency,
          ...(supplierId ? { supplierId } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          // Bought here is paid on the spot, in cash; a bill on credit is New bill's.
          payment: { method: "cash" },
          lines: [{ variantId: item.variantId, quantity: amount, unitCost }],
        },
      });
      return api("/stock", stockPageSchema);
    });

  const ready = !Number.isNaN(amount) && (!tracked ? !costTypedWrong : mode === "bought" ? unitCost !== undefined : mode !== null && reason !== null && (reason !== "other" || note.trim() !== ""));
  const save = () => {
    if (!tracked) return void send("/stock/track", "POST", { variantId: item.variantId, onHand: amount, ...(unitCost !== undefined ? { unitCost, costCurrency: currency } : {}) });
    if (mode === "bought") return void buy();
    if (mode === "up" || mode === "down") {
      void send("/stock/changes", "POST", { variantId: item.variantId, type: DIRECTION[mode], quantity: amount, ...(reason ? { reason } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
    }
  };
  const submitLabel = !tracked ? t("openingSave") : mode === "bought" ? t("submitPurchase") : mode === "up" ? t("submitUp") : mode === "down" ? t("submitDown") : t("submitAdjustment");
  const costBox = (label: string) => (
    <>
      {/* The product's cost currency is fixed once it has a cost; until then it's picked here. */}
      {!costCurrency && <CostCurrencyChoice value={currency} onChange={setCurrency} />}
      <Input label={label} inputMode={COST_INPUT[currency].inputMode} value={costText} onChange={(event) => setCostText(event.target.value)} error={costTypedWrong ? errorText("price_invalid") : errorText(errors.unitCost)} />
    </>
  );

  return (
    <BottomSheet
      open
      onClose={onClose}
      closeLabel={t("cancel")}
      title={tracked ? title : t("openingTitle", { name: title })}
      placement="center"
      footer={
        <Button variant="primary" fullWidth loading={busy} disabled={!ready} onClick={save}>
          {submitLabel}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {tracked ? (
          <>
            <p className="text-sm">
              {t("onHandNow")} <span className="text-lg font-semibold tabular-nums">{item.onHand}</span>
            </p>
            <ChoiceCards
              variant="rows"
              label={t("changeKind")}
              value={mode}
              onChange={(next) => {
                const kind = KINDS.find((entry) => entry.value === next);
                if (kind) {
                  setMode(kind.value);
                  setReason(null);
                }
              }}
              options={KINDS.map((kind) => ({ value: kind.value, title: t(`kind_${kind.value}`), detail: t(`kindHint_${kind.value}`), icon: kind.icon }))}
            />
            {(mode === "up" || mode === "down") && (
              <ChoiceCards
                variant="rows"
                label={t("reasonLabel")}
                value={reason}
                onChange={(next) => {
                  const parsed = stockAdjustmentReasonSchema.safeParse(next);
                  if (parsed.success) setReason(parsed.data);
                }}
                options={STOCK_CHANGE_REASONS[DIRECTION[mode]].map((value) => ({ value, title: t(`${mode}Reason_${value}`), detail: t(`${mode}ReasonHint_${value}`) }))}
                invalid={!!errors.reason}
              />
            )}
            {errorText(errors.reason) && <p className="-mt-2 text-sm text-danger">{errorText(errors.reason)}</p>}
            {mode !== null && (
              <QuantityInput label={t("quantityLabel")} value={quantity} onChange={setQuantity} decreaseLabel={t("oneLess")} increaseLabel={t("oneMore")} min={1} error={errorText(errors.quantity)} />
            )}
            {mode === "bought" && (
              <>
                {costBox(t(COST_INPUT[currency].label))}
                <p className="-mt-2 text-xs text-muted">{t("costOfOneHint")}</p>
                <Select
                  label={t("supplierLabel")}
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  options={[{ value: "", label: t("supplierNone") }, ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))]}
                  error={errorText(errors.supplierId)}
                />
              </>
            )}
            {mode !== null && (
              <Input
                label={reason === "other" ? t("noteRequiredLabel") : t("noteLabel")}
                placeholder={t("notePlaceholder")}
                maxLength={MAX_STOCK_NOTE_LENGTH}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                error={errorText(errors.note)}
              />
            )}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  onClose();
                  onReorderLevels();
                }}
              >
                {item.reorderMin === null ? t("reorderSetButton") : t("reorderButton", { min: item.reorderMin, max: item.reorderMax ?? item.reorderMin * 2 })}
              </Button>
              <Button variant="ghost" tone="danger" disabled={busy} onClick={() => setConfirmingStop(true)}>
                {t("stopTracking")}
              </Button>
            </div>
            {/* The count is lost (starting again needs a recount), so one tap isn't enough. */}
            <ConfirmDialog
              open={confirmingStop}
              title={t("stopTrackingConfirm")}
              body={t("stopTrackingHint")}
              confirmLabel={t("stopTracking")}
              cancelLabel={t("cancel")}
              danger
              onConfirm={() => {
                setConfirmingStop(false);
                void send(`/stock/track/${item.variantId}`, "DELETE");
              }}
              onClose={() => setConfirmingStop(false)}
            />
          </>
        ) : (
          <>
            <p className="text-sm text-muted">{t("openingHint")}</p>
            <QuantityInput label={t("countNow")} value={quantity} onChange={setQuantity} decreaseLabel={t("oneLess")} increaseLabel={t("oneMore")} error={errorText(errors.onHand)} />
            {costBox(t(currency === "USD" ? "openingCostUsd" : "openingCostKhr"))}
            <p className="-mt-2 text-xs text-muted">{t("openingCostHint")}</p>
          </>
        )}
        {problem && (
          <Notice tone="danger" role="alert">
            {problem}
          </Notice>
        )}
      </div>
    </BottomSheet>
  );
}
