"use client";

import { currencySchema, type Currency } from "@khmio/shared";
import { Button, ConfirmDialog, EmptyState, StatCard, StatusPill } from "@khmio/ui";
import { ArrowLeft, Banknote, ChevronRight, QrCode, ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/components/order-ui";
import { useDateText } from "@/components/use-date-text";
import { salesToday, useCounterSales, type CounterSale } from "../../../counter-sales-context";

/** Dollars and riel are never added together: one figure per currency. */
function sumByCurrency(sales: CounterSale[]): string {
  const sums = currencySchema.options
    .map((currency): [Currency, number] => [currency, sales.filter((sale) => sale.currency === currency).reduce((sum, sale) => sum + sale.total, 0)])
    .filter(([, amount]) => amount > 0);
  return sums.length ? sums.map(([currency, amount]) => formatMoney(amount, currency)).join(" + ") : formatMoney(0, "USD");
}

// Today's sales at the counter (design/screens.md P4): totals by cash and QR,
// each sale with its receipt, and void for a mistake (the money goes back to
// the buyer by hand).
export default function TodaySalesPage() {
  const t = useTranslations("Counter");
  const locale = useLocale();
  const { hydrated, sales, voidSale } = useCounterSales();
  const { clockTime } = useDateText();
  const [voiding, setVoiding] = useState<CounterSale | null>(null);
  if (!hydrated) return null;

  const base = `/${locale}/mockup/dashboard/sell`;
  const todays = salesToday(sales);
  const counted = todays.filter((sale) => !sale.voided);
  const cash = counted.filter((sale) => sale.payment === "cash");
  const qr = counted.filter((sale) => sale.payment === "qr");

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 p-4 text-fg md:p-6">
      <header className="flex items-center gap-2">
        <Link href={base} aria-label={t("backToSell")} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-border/30">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-xl font-bold">{t("todayTitle")}</h1>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={ReceiptText} label={t("statTotal", { count: counted.length })} value={sumByCurrency(counted)} />
        <StatCard icon={Banknote} tone="success" label={t("statCash", { count: cash.length })} value={sumByCurrency(cash)} />
        <StatCard icon={QrCode} tone="info" label={t("statQr", { count: qr.length })} value={sumByCurrency(qr)} />
      </div>

      {todays.length === 0 ? (
        <EmptyState icon={ReceiptText} title={t("todayEmpty")} action={<Link href={base} className="font-semibold text-brand">{t("startSelling")}</Link>} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-bg">
          {todays.map((sale) => (
            <li key={sale.number} className="flex items-center gap-2 p-2 pl-3">
              <Link href={`${base}/receipt/${encodeURIComponent(sale.number)}`} className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={sale.voided ? "font-semibold line-through" : "font-semibold"}>{sale.number}</span>
                    {sale.voided ? (
                      <StatusPill tone="danger">{t("voided")}</StatusPill>
                    ) : (
                      <StatusPill tone={sale.payment === "cash" ? "success" : "info"}>{sale.payment === "cash" ? t("methodCash") : t("methodQr")}</StatusPill>
                    )}
                  </span>
                  <span className="block text-xs text-muted">
                    {clockTime(sale.atIso)} · {t("itemCount", { count: sale.lines.reduce((sum, line) => sum + line.quantity, 0) })}
                    {sale.buyerName && ` · ${sale.buyerName}`}
                  </span>
                </span>
                <span className={sale.voided ? "font-semibold tabular-nums text-muted line-through" : "font-semibold tabular-nums"}>{formatMoney(sale.total, sale.currency)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
              {!sale.voided && (
                <Button variant="ghost" tone="danger" size="sm" onClick={() => setVoiding(sale)}>
                  {t("void")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={voiding !== null}
        title={t("voidTitle", { number: voiding?.number ?? "" })}
        body={voiding ? t(voiding.payment === "cash" ? "voidBodyCash" : "voidBodyQr", { amount: formatMoney(voiding.total, voiding.currency) }) : ""}
        confirmLabel={t("voidConfirm")}
        cancelLabel={t("cancel")}
        danger
        onConfirm={() => {
          if (voiding) voidSale(voiding.number);
          setVoiding(null);
        }}
        onClose={() => setVoiding(null)}
      />
    </div>
  );
}
