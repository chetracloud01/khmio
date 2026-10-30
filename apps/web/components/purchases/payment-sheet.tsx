"use client";

import { MAX_PAYMENT_NOTE_LENGTH, phnomPenhDay, purchasePaymentMethodSchema, type FormErrorCode, type PurchasePaymentMethod } from "@khmio/shared";
import { BottomSheet, Button, Input, Notice, Select } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { formatMoney } from "@/components/order-ui";
import { COST_INPUT } from "@/components/stock/item-name";
import { api, ApiError, type PurchaseDetail, purchaseDetailSchema, type PurchaseRow } from "@/lib/api";
import { usePaymentMethodOptions } from "./payment-ui";
import { usePurchaseText } from "./use-purchase-text";

/**
 * Pay the supplier against one bill (POST /purchases/:id/payments): how much
 * (it starts at what's owed; less pays part), the day and the way. In the
 * bill's currency, never more than it owes. Opened from the bill's page or
 * from its row in the Purchases list.
 */
export function PaymentSheet({
  purchase,
  onClose,
  onSaved,
}: {
  purchase: Pick<PurchaseRow, "id" | "kind" | "number" | "supplierName" | "currency" | "payment">;
  onClose: () => void;
  onSaved: (purchase: PurchaseDetail) => void;
}) {
  const t = useTranslations("Purchases");
  const { title } = usePurchaseText();
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const methodOptions = usePaymentMethodOptions();
  const money = COST_INPUT[purchase.currency];
  const owed = Math.max(0, purchase.payment?.owed ?? 0);
  const [amountText, setAmountText] = useState(money.text(owed));
  const [paidOn, setPaidOn] = useState(() => phnomPenhDay(new Date()));
  const [method, setMethod] = useState<PurchasePaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const amount = money.parse(amountText);
  const tooMuch = amount !== undefined && amount > owed;

  async function save() {
    setBusy(true);
    setProblem(null);
    try {
      onSaved(await api(`/purchases/${purchase.id}/payments`, purchaseDetailSchema, { method: "POST", body: { amount, paidOn, method, note } }));
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
      title={t("payTitle")}
      placement="center"
      footer={
        <Button variant="primary" fullWidth loading={busy} disabled={amount === undefined || amount <= 0 || tooMuch || !paidOn} onClick={() => void save()}>
          {t("paySave")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{[title(purchase), purchase.supplierName || t("noSupplier")].join(" · ")}</p>
        <p className="text-sm">
          {t("owedNow")} <span className="text-lg font-semibold tabular-nums">{formatMoney(owed, purchase.currency)}</span>
        </p>
        <Input
          label={t(`payAmount_${purchase.currency}`)}
          inputMode={money.inputMode}
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          error={tooMuch ? errorText("payment_above_owed") : errorText(errors.amount)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("paidOnLabel")} type="date" max={phnomPenhDay(new Date())} value={paidOn} onChange={(event) => setPaidOn(event.target.value)} error={errorText(errors.paidOn)} />
          <Select
            label={t("methodLabel")}
            value={method}
            onChange={(event) => {
              const parsed = purchasePaymentMethodSchema.safeParse(event.target.value);
              if (parsed.success) setMethod(parsed.data);
            }}
            options={methodOptions}
          />
        </div>
        <Input label={t("noteLabel")} placeholder={t("payNotePlaceholder")} maxLength={MAX_PAYMENT_NOTE_LENGTH} value={note} onChange={(event) => setNote(event.target.value)} error={errorText(errors.note)} />
        {problem && (
          <Notice tone="danger" role="alert">
            {problem}
          </Notice>
        )}
      </div>
    </BottomSheet>
  );
}
