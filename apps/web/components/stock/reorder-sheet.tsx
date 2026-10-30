"use client";

import { LOW_STOCK_THRESHOLD, parseQuantityInput, type FormErrorCode } from "@khmio/shared";
import { BottomSheet, Button, Notice, QuantityInput } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { api, ApiError, type StockPage, stockPageSchema } from "@/lib/api";

type Item = StockPage["items"][number];

/** A box's text as a level: empty = not set (null), digits = the number, anything else = NaN. */
const levelOf = (text: string) => (text.trim() ? parseQuantityInput(text) : null);

/**
 * Reorder levels (the minimum/maximum rule) for one tracked item, or the same
 * levels for many from the Stock list's selection (POST /stock/reorder, all
 * or nothing): reorder when what's free is at or below the minimum, order up
 * to the maximum. Both empty = the shop's rule (low at 5).
 */
export function ReorderSheet({ items, nameOf, onClose, onSaved }: { items: Item[]; nameOf: (item: Item) => string; onClose: () => void; onSaved: (page: StockPage) => void }) {
  const t = useTranslations("Stock");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const one = items.length === 1 ? items[0] : undefined;
  const [min, setMin] = useState(one?.reorderMin?.toString() ?? "");
  const [max, setMax] = useState(one?.reorderMax?.toString() ?? "");
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const minimum = levelOf(min);
  const maximum = levelOf(max);
  const typedWrong = Number.isNaN(minimum) || Number.isNaN(maximum);
  // The same rule as the server's (packages/shared reorderLevelsInputSchema), shown before saving.
  const maxBelowMin = maximum !== null && !Number.isNaN(maximum) && (minimum === null || maximum < minimum);

  async function save() {
    setBusy(true);
    setProblem(null);
    try {
      onSaved(await api("/stock/reorder", stockPageSchema, { method: "POST", body: { items: items.map((item) => ({ variantId: item.variantId, min: minimum, max: maximum })) } }));
      onClose();
    } catch (failure) {
      // Every line gets the same levels: the first line's error stands for all.
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) setErrors(Object.fromEntries(Object.entries(failure.fields).map(([key, code]) => [key.replace(/^items\.\d+\./, ""), code])));
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
      title={one ? t("reorderTitleOne", { name: nameOf(one) }) : t("reorderTitleMany", { count: items.length })}
      placement="center"
      footer={
        <Button variant="primary" fullWidth loading={busy} disabled={typedWrong || maxBelowMin} onClick={() => void save()}>
          {t("reorderSave")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("reorderHint", { count: LOW_STOCK_THRESHOLD })}</p>
        <div className="grid grid-cols-2 gap-3">
          <QuantityInput label={t("reorderMin")} value={min} onChange={setMin} decreaseLabel={t("oneLess")} increaseLabel={t("oneMore")} placeholder={String(LOW_STOCK_THRESHOLD)} error={Number.isNaN(minimum) ? errorText("quantity_invalid") : errorText(errors.min)} />
          <QuantityInput
            label={t("reorderMax")}
            value={max}
            onChange={setMax}
            decreaseLabel={t("oneLess")}
            increaseLabel={t("oneMore")}
            error={Number.isNaN(maximum) ? errorText("quantity_invalid") : maxBelowMin ? errorText("reorder_max_below_min") : errorText(errors.max)}
          />
        </div>
        {problem && (
          <Notice tone="danger" role="alert">
            {problem}
          </Notice>
        )}
      </div>
    </BottomSheet>
  );
}
