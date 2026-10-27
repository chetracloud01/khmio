"use client";

import { cashChange, normalizeKhmerPhone, type Currency } from "@khmio/shared";
import { Button, Input, SegmentedControl } from "@khmio/ui";
import { ArrowLeft, Banknote, CheckCircle2, QrCode, ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { CashPayment, parseCashReceived } from "@/components/counter/cash-payment";
import { CounterCart, type CounterCartLine, type CounterCartTotals } from "@/components/counter/counter-cart";
import { QrPayment } from "@/components/counter/qr-payment";
import { formatMoney } from "@/components/order-ui";
import { useCounterSales, type CounterSale } from "../../counter-sales-context";
import { useMerchantProfile } from "../../merchant-profile-context";
import type { useCounterTotal } from "./use-counter-total";

type Method = "cash" | "qr";

/**
 * Charging at the counter (design/screens.md P2): the sale (still editable),
 * cash with change or the shop's own QR, an optional buyer, then Complete.
 */
export function PayStep({
  currency,
  sale,
  cartLines,
  totals,
  onQuantity,
  onBack,
  onDone,
}: {
  currency: Currency;
  sale: ReturnType<typeof useCounterTotal>;
  cartLines: CounterCartLine[];
  totals: CounterCartTotals;
  onQuantity: (key: string, quantity: number) => void;
  onBack: () => void;
  onDone: (sale: CounterSale) => void;
}) {
  const t = useTranslations("Counter");
  const locale = useLocale();
  const { paymentQrDataUrl } = useMerchantProfile();
  const { recordSale } = useCounterSales();
  const [method, setMethod] = useState<Method>("cash");
  const [receivedText, setReceivedText] = useState("");
  const [qrConfirmed, setQrConfirmed] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");

  const total = sale.total.total;
  const received = parseCashReceived(receivedText, currency);
  const change = received === undefined ? null : cashChange(total, received);
  const phone = buyerPhone.trim() ? normalizeKhmerPhone(buyerPhone) : "";
  const phoneInvalid = phone === null;
  const ready = sale.total.itemCount > 0 && !phoneInvalid && (method === "cash" ? change !== null : qrConfirmed && paymentQrDataUrl !== null);

  function complete() {
    if (!ready || phone === null) return;
    const done = recordSale({
      currency,
      rate: sale.rate,
      vatPercent: sale.vatPercent,
      lines: sale.lines.map((line) => ({
        key: line.input.key,
        title: line.title,
        option: line.option,
        quantity: line.input.quantity,
        unitPrice: line.totalLine?.unitPrice ?? 0,
        lineTotal: line.totalLine?.lineTotal ?? 0,
      })),
      subtotal: sale.total.subtotal,
      discount: sale.total.discount,
      vat: sale.total.vat,
      total,
      payment: method,
      ...(method === "cash" && received !== undefined && change !== null ? { cashReceived: received, change } : {}),
      buyerName: buyerName.trim(),
      buyerPhone: phone,
    });
    onDone(done);
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 p-4 pb-32 text-fg md:p-6">
      <header className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label={t("backToProducts")} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-border/30">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-bold">{t("payTitle")}</h1>
      </header>

      <CounterCart lines={cartLines} totals={totals} onQuantity={onQuantity} />

      <section className="flex flex-col gap-3">
        <SegmentedControl
          mode="choice"
          label={t("payMethod")}
          value={method}
          onChange={(next) => setMethod(next === "qr" ? "qr" : "cash")}
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
              value: "qr",
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
            qrUrl={paymentQrDataUrl}
            amount={formatMoney(total, currency)}
            setupHref={`/${locale}/mockup/dashboard/profile#payments`}
            confirmed={qrConfirmed}
            onConfirmed={setQrConfirmed}
          />
        )}
      </section>

      <details className="group rounded-2xl border border-border p-3">
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

      <div className="bottom-above-nav fixed inset-x-0 z-20 border-t border-border bg-bg p-3 md:sticky md:bottom-0 md:-mx-6 md:rounded-b-2xl">
        <div className="mx-auto max-w-[720px]">
          <Button variant="primary" fullWidth disabled={!ready} onClick={complete}>
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {t("complete", { amount: formatMoney(total, currency) })}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The sale is done (design/screens.md P3): the change to hand back, the receipt, the next sale. */
export function SaleDone({ sale, receiptHref, onNewSale }: { sale: CounterSale; receiptHref: string; onNewSale: () => void }) {
  const t = useTranslations("Counter");
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col items-center gap-5 p-6 text-center text-fg">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-2xl font-bold">{t("doneTitle")}</h1>
        <p className="text-sm text-muted">{t("doneNumber", { number: sale.number, amount: formatMoney(sale.total, sale.currency) })}</p>
      </div>
      {sale.change !== undefined && sale.change > 0 && (
        <div className="w-full rounded-2xl bg-success/10 p-5">
          <p className="text-sm font-medium">{t("giveChange")}</p>
          <p className="text-4xl font-bold tabular-nums text-success">{formatMoney(sale.change, sale.currency)}</p>
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
