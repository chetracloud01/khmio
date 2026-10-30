"use client";

import { formatDocumentNumber } from "@khmio/shared";
import { Button, cn, ConfirmDialog, IconButton, Notice } from "@khmio/ui";
import { Ban, CircleCheck, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatMoney } from "@/components/order-ui";
import { PrintLink } from "@/components/paper/print-link";
import { api, ApiError, type PurchaseDetail, purchaseDetailSchema } from "@/lib/api";
import { leftAfterEach } from "./bill-left";
import { usePurchaseText } from "./use-purchase-text";

type Payment = PurchaseDetail["payments"][number];

/**
 * A bill's payments tab (design/screens.md S13 "Bill"): every payment
 * (PAY-…) as a timeline, oldest first, each with what was still to pay after
 * it — so part payments read at a glance; voided ones crossed out. "Record
 * payment" pays all or part of what's owed; a payment made by mistake is
 * voided, never deleted. Each payment prints as a voucher.
 */
export function BillPayments({
  purchase,
  writable,
  voucherHrefFor,
  onPay,
  onChanged,
}: {
  purchase: PurchaseDetail;
  writable: boolean;
  /** A payment voucher's print page. */
  voucherHrefFor: (paymentId: string) => string;
  onPay: () => void;
  onChanged: (purchase: PurchaseDetail) => void;
}) {
  const t = useTranslations("Purchases");
  const tApp = useTranslations("App");
  const { billDay } = usePurchaseText();
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const payment = purchase.payment;
  if (!payment) return null;
  const money = (amount: number) => formatMoney(amount, purchase.currency);
  const left = leftAfterEach(purchase);

  async function voidPayment(entry: Payment) {
    setProblem(null);
    try {
      onChanged(await api(`/purchases/payments/${entry.id}/void`, purchaseDetailSchema, { method: "POST" }));
    } catch (failure) {
      setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {purchase.payments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">{t("noPaymentsYet")}</p>
      ) : (
        <ol className="flex flex-col">
          {purchase.payments.map((entry, index) => {
            const after = left.get(entry.id);
            const last = index === purchase.payments.length - 1;
            return (
              <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                {/* The timeline: a dot per payment, joined by a line. */}
                {!last && <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 bg-border" aria-hidden="true" />}
                <span className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full", entry.voided ? "bg-border/40 text-muted" : "bg-success/10 text-success")} aria-hidden="true">
                  {entry.voided ? <Ban className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}
                </span>
                <div className="flex min-w-0 flex-1 items-start gap-2 rounded-xl border border-border bg-bg p-3">
                  <div className={cn("min-w-0 flex-1", entry.voided && "text-muted line-through")}>
                    <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="truncate font-medium">
                        {formatDocumentNumber("payment", entry.number)} · {t(`method_${entry.method}`)}
                      </span>
                      <span className="font-semibold tabular-nums">{money(entry.amountMinor)}</span>
                    </p>
                    <p className="truncate text-xs text-muted">{[billDay(entry.paidOn), entry.note, entry.voided ? t("voided") : ""].filter(Boolean).join(" · ")}</p>
                    {after !== undefined && (
                      <p className={cn("text-xs font-medium", after > 0 ? "text-warning" : "text-success")}>{after > 0 ? t("leftAfter", { amount: money(after) }) : t("paidOffAfter")}</p>
                    )}
                  </div>
                  <PrintLink iconOnly href={voucherHrefFor(entry.id)} label={t("printVoucher", { code: formatDocumentNumber("payment", entry.number) })} />
                  {writable && !entry.voided && <IconButton icon={Ban} tone="danger" label={t("voidPayment", { code: formatDocumentNumber("payment", entry.number) })} onClick={() => setVoiding(entry)} />}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {writable && payment.owed > 0 && (
        <Button variant="secondary" className="self-start" onClick={onPay}>
          <Wallet className="h-4 w-4" aria-hidden="true" />
          {t("recordPayment")}
        </Button>
      )}
      {payment.owed < 0 && <p className="text-xs text-muted">{t("supplierOwesHint")}</p>}
      {problem && (
        <Notice tone="danger" role="alert">
          {problem}
        </Notice>
      )}
      {/* A voided payment can't be brought back, so one tap isn't enough. */}
      <ConfirmDialog
        open={voiding !== null}
        title={t("voidConfirm", { code: voiding ? formatDocumentNumber("payment", voiding.number) : "" })}
        body={t("voidHint")}
        confirmLabel={t("voidSave")}
        cancelLabel={t("cancel")}
        danger
        onConfirm={() => {
          if (voiding) void voidPayment(voiding);
          setVoiding(null);
        }}
        onClose={() => setVoiding(null)}
      />
    </section>
  );
}
