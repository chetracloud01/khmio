"use client";

import { ConfirmDialog } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { api, ApiError, purchaseDetailSchema, type PurchaseRow } from "@/lib/api";
import { PaymentSheet } from "./payment-sheet";
import { usePurchaseText } from "./use-purchase-text";

/**
 * Pay and Receive from a list of bills (Purchases, a supplier's page): the
 * row's buttons open the payment sheet, or ask before the goods go into
 * stock. `onChanged` runs after either, so the list and its figures read
 * again. `dialogs` goes once on the page; `problem` says what went wrong.
 */
export function useBillRowActions(onChanged: () => void): { onPay: (purchase: PurchaseRow) => void; onReceive: (purchase: PurchaseRow) => void; dialogs: ReactNode; problem: string | null } {
  const t = useTranslations("Purchases");
  const tApp = useTranslations("App");
  const { title } = usePurchaseText();
  const [paying, setPaying] = useState<PurchaseRow | null>(null);
  const [receiving, setReceiving] = useState<PurchaseRow | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function receive(purchase: PurchaseRow) {
    setProblem(null);
    try {
      await api(`/purchases/${purchase.id}/receive`, purchaseDetailSchema, { method: "POST" });
      onChanged();
    } catch (failure) {
      setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    }
  }

  const dialogs = (
    <>
      {paying && <PaymentSheet purchase={paying} onClose={() => setPaying(null)} onSaved={onChanged} />}
      {/* Stock goes up and can't be taken back by undoing: one tap isn't enough. */}
      <ConfirmDialog
        open={receiving !== null}
        title={t("receiveConfirm")}
        body={receiving ? `${title(receiving)} · ${t("receiveConfirmHint", { count: receiving.lineCount })}` : ""}
        confirmLabel={t("receiveButton")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          if (receiving) void receive(receiving);
          setReceiving(null);
        }}
        onClose={() => setReceiving(null)}
      />
    </>
  );
  return { onPay: setPaying, onReceive: setReceiving, dialogs, problem };
}
