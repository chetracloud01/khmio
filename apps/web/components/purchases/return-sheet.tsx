"use client";

import { MAX_PURCHASE_NOTE_LENGTH, parseQuantityInput, type FormErrorCode } from "@khmio/shared";
import { BottomSheet, Button, Input, Notice, QuantityInput } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { api, ApiError, type PurchaseDetail, purchaseDetailSchema } from "@/lib/api";

type Line = PurchaseDetail["lines"][number];

/**
 * Send goods from one bill back to its supplier (POST /purchases/:id/returns):
 * how many of each, never more than the bill brought in less earlier returns.
 * Stock goes down; the average cost stays the same. Lines left at 0 aren't sent.
 */
export function ReturnSheet({ purchase, nameOf, onClose, onSaved }: { purchase: PurchaseDetail; nameOf: (line: Line) => string; onClose: () => void; onSaved: (purchase: PurchaseDetail) => void }) {
  const t = useTranslations("Purchases");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const open = purchase.lines.filter((line) => line.returnable > 0);
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(open.map((line) => [line.variantId, "0"])));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amounts = open.map((line) => ({ variantId: line.variantId, quantity: parseQuantityInput(counts[line.variantId] ?? ""), returnable: line.returnable }));
  const valid = amounts.every((line) => !Number.isNaN(line.quantity) && line.quantity <= line.returnable);
  const sent = amounts.filter((line) => line.quantity > 0);

  async function save() {
    setBusy(true);
    setProblem(null);
    try {
      onSaved(await api(`/purchases/${purchase.id}/returns`, purchaseDetailSchema, { method: "POST", body: { note, lines: sent.map(({ variantId, quantity }) => ({ variantId, quantity })) } }));
      onClose();
    } catch (failure) {
      // The server names lines by their place in what was sent: map them back to the option.
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) {
        setErrors(Object.fromEntries(Object.entries(failure.fields).map(([key, code]) => [key.replace(/^lines\.(\d+)\..*$/, (_, at: string) => sent[Number(at)]?.variantId ?? key), code])));
      } else setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      closeLabel={t("cancel")}
      title={t("returnTitle")}
      placement="center"
      footer={
        <Button variant="primary" fullWidth loading={busy} disabled={!valid || sent.length === 0} onClick={() => void save()}>
          {t("returnSave")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("returnHint")}</p>
        {open.map((line) => {
          const amount = amounts.find((entry) => entry.variantId === line.variantId);
          const tooMany = amount !== undefined && amount.quantity > line.returnable;
          return (
            <QuantityInput
              key={line.variantId}
              label={nameOf(line)}
              value={counts[line.variantId] ?? ""}
              onChange={(text) => setCounts((current) => ({ ...current, [line.variantId]: text }))}
              decreaseLabel={t("oneLess", { name: nameOf(line) })}
              increaseLabel={t("oneMore", { name: nameOf(line) })}
              error={tooMany ? errorText("return_above_bought") : errorText(errors[line.variantId])}
              placeholder={t("returnableUpTo", { count: line.returnable })}
            />
          );
        })}
        <Input label={t("noteLabel")} placeholder={t("returnNotePlaceholder")} maxLength={MAX_PURCHASE_NOTE_LENGTH} value={note} onChange={(event) => setNote(event.target.value)} error={errorText(errors.note)} />
        {problem && (
          <Notice tone="danger" role="alert">
            {problem}
          </Notice>
        )}
      </div>
    </BottomSheet>
  );
}
