"use client";

import { cashChange, normalizeKhmerPhone, type Currency } from "@khmio/shared";
import { Button, IconButton, Input, Notice, SegmentedControl } from "@khmio/ui";
import { ArrowLeft, Banknote, CheckCircle2, QrCode, ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { CashPayment, parseCashReceived } from "@/components/counter/cash-payment";
import { CounterCart } from "@/components/counter/counter-cart";
import { QrPayment } from "@/components/counter/qr-payment";
import { formatMoney } from "@/components/order-ui";
import { api, ApiError, type CounterSaleResult, counterSaleResultSchema } from "@/lib/api";
import { newId } from "@/lib/new-id";
import { useMerchant } from "../merchant-context";
import { saleRequestLines, type useCounterSale } from "./use-counter-sale";

type Method = "cash" | "shop_qr";

/**
 * Charging at the counter (design/screens.md P2): the sale (still editable),
 * cash with change or the shop's own QR, an optional buyer, then Complete —
 * sent with one key per sale, so a double tap or a retry never sells twice.
 */
export function PayStep({
  currency,
  quantities,
  notes,
  tableId,
  jobCardId,
  sale,
  onQuantity,
  onBack,
  onDone,
}: {
  currency: Currency;
  /** Line key (an option, or with its choices) → how many. */
  quantities: Record<string, number>;
  notes: Record<string, string>;
  /** Dine-in: the table this sale is for. */
  tableId?: string;
  /** A garage: the job card this sale bills (it's handed over with the sale). */
  jobCardId?: string;
  sale: ReturnType<typeof useCounterSale>;
  onQuantity: (lineKey: string, quantity: number) => void;
  onBack: () => void;
  onDone: (result: CounterSaleResult) => void;
}) {
  const t = useTranslations("Counter");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const { store } = useMerchant();
  const [method, setMethod] = useState<Method>("cash");
  const [receivedText, setReceivedText] = useState("");
  const [qrConfirmed, setQrConfirmed] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [idempotencyKey] = useState(newId);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const total = sale.total.total;
  const received = parseCashReceived(receivedText, currency);
  const change = received === undefined ? null : cashChange(total, received);
  const phoneInvalid = buyerPhone.trim() !== "" && normalizeKhmerPhone(buyerPhone) === null;
  const ready = sale.total.itemCount > 0 && !phoneInvalid && !sending && (method === "cash" ? change !== null : qrConfirmed && store.paymentQrUrl !== null);

  async function complete() {
    if (!ready) return;
    setSending(true);
    setProblem(null);
    try {
      const result = await api("/counter/sales", counterSaleResultSchema, {
        method: "POST",
        body: {
          idempotencyKey,
          currency,
          lines: saleRequestLines(quantities, notes),
          payment: method === "cash" ? { method, receivedMinor: received } : { method, sellerConfirmed: true },
          buyerName: buyerName.trim(),
          buyerPhone,
          ...(tableId ? { tableId } : {}),
          ...(jobCardId ? { jobCardId } : {}),
        },
      });
      onDone(result);
    } catch (failure) {
      const code = failure instanceof ApiError ? (failure.fields["payment.receivedMinor"] ?? failure.code) : null;
      setProblem(
        code === "cash_short" ? t("cashShortServer") : code === "plan_limit" ? t("upgradeTitle") : code === "store_paused" ? tApp("storePaused") : failure instanceof ApiError && Object.keys(failure.fields).length > 0 ? t("saleChanged") : tApp("saveFailed"),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 p-4 pb-32 text-fg md:p-6">
      <header className="flex items-center gap-2">
        <IconButton icon={ArrowLeft} label={t("backToProducts")} onClick={onBack} className="-ml-2" />
        <h1 className="text-xl font-bold">{t("payTitle")}</h1>
      </header>

      <CounterCart lines={sale.lines} totals={sale.totals} onQuantity={onQuantity} />

      <section className="flex flex-col gap-3">
        <SegmentedControl
          mode="choice"
          label={t("payMethod")}
          value={method}
          onChange={(next) => setMethod(next === "shop_qr" ? "shop_qr" : "cash")}
          options={[
            {
              value: "cash",
              label: (
                <span className="flex items-center gap-2">
                  <Banknote className="h-4 w-4" aria-hidden="true" />
                  {t("methodCash")}
                </span>
              ),
            },
            {
              value: "shop_qr",
              label: (
                <span className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                  {t("methodQr")}
                </span>
              ),
            },
          ]}
        />
        {method === "cash" ? (
          <CashPayment total={total} currency={currency} receivedText={receivedText} onReceivedText={setReceivedText} />
        ) : (
          <QrPayment
            qrUrl={store.paymentQrUrl}
            amount={formatMoney(total, currency)}
            setupHref={`/${locale}/m/shop-details#payments`}
            confirmed={qrConfirmed}
            onConfirmed={setQrConfirmed}
          />
        )}
      </section>

      <details className="rounded-2xl border border-border p-3">
        <summary className="flex min-h-touch cursor-pointer items-center text-sm font-medium">{t("buyerOptional")}</summary>
        <div className="flex flex-col gap-3 pt-2">
          <Input label={t("buyerName")} value={buyerName} maxLength={60} onChange={(event) => setBuyerName(event.target.value)} />
          <Input
            label={t("buyerPhone")}
            prefix="+855"
            inputMode="tel"
            placeholder="012 345 678"
            value={buyerPhone}
            onChange={(event) => setBuyerPhone(event.target.value)}
            error={phoneInvalid ? t("buyerPhoneInvalid") : undefined}
          />
        </div>
      </details>

      {problem && (
        <Notice tone="danger" role="alert">
          {problem}
        </Notice>
      )}

      <div className="bottom-above-nav fixed inset-x-0 z-20 border-t border-border bg-bg p-3 md:sticky md:bottom-0 md:rounded-2xl md:border">
        <div className="mx-auto max-w-[720px]">
          <Button variant="primary" fullWidth disabled={!ready} loading={sending} onClick={() => void complete()}>
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {t("complete", { amount: formatMoney(total, currency) })}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The sale is done (design/screens.md P3): the change to hand back, the receipt, the next sale. */
export function SaleDone({ sale, receiptHref, onNewSale }: { sale: CounterSaleResult; receiptHref: string; onNewSale: () => void }) {
  const t = useTranslations("Counter");
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col items-center gap-5 p-6 text-center text-fg">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-2xl font-bold">{t("doneTitle")}</h1>
        <p className="text-sm text-muted">{t("doneNumber", { number: `#${sale.orderNumber}`, amount: formatMoney(sale.totalMinor, sale.currency) })}</p>
      </div>
      {sale.changeMinor !== null && sale.changeMinor > 0 && (
        <div className="w-full rounded-2xl bg-success/10 p-5">
          <p className="text-sm font-medium">{t("giveChange")}</p>
          <p className="text-4xl font-bold tabular-nums text-success">{formatMoney(sale.changeMinor, sale.currency)}</p>
        </div>
      )}
      <div className="flex w-full flex-col gap-2">
        <Link href={receiptHref} className="flex min-h-touch items-center justify-center gap-2 rounded-DEFAULT border border-border font-medium hover:border-brand/40">
          <ReceiptText className="h-5 w-5 text-brand" aria-hidden="true" />
          {t("showReceipt")}
        </Link>
        <Button variant="primary" fullWidth onClick={onNewSale}>
          {t("newSale")}
        </Button>
      </div>
    </div>
  );
}
