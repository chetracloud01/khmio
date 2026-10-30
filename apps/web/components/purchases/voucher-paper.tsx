"use client";

import { formatDocumentNumber, formatKhmerPhoneLocal } from "@khmio/shared";
import { cn } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { forwardRef } from "react";
import { formatMoney } from "@/components/order-ui";
import { Paper, PaperDivider, PaperHeader, PaperRow, PaperSignatures, PaperStamp, type PaperShop, type PaperSize } from "@/components/paper/paper-parts";
import { useDateText } from "@/components/use-date-text";
import type { PurchaseDetail } from "@/lib/api";
import { voucherFigures } from "./bill-left";
import { usePurchaseText } from "./use-purchase-text";

type Payment = PurchaseDetail["payments"][number];

/**
 * A payment voucher on paper (design/screens.md S13 "Printing"): the shop,
 * PAYMENT VOUCHER (stamped VOID when voided), who was paid, when and how, the
 * amount in large type, the bill it pays — its total after returns, paid
 * before, this payment and the balance after — the note, and lines to sign.
 */
export const VoucherPaper = forwardRef<HTMLDivElement, { purchase: PurchaseDetail; payment: Payment; shop: PaperShop; size: PaperSize; fixedWidth?: boolean }>(function VoucherPaper(
  { purchase, payment, shop, size, fixedWidth = false },
  ref,
) {
  const t = useTranslations("BillPaper");
  const tPurchases = useTranslations("Purchases");
  const tInvoice = useTranslations("Invoice");
  const { title, billDay } = usePurchaseText();
  const { dateTime } = useDateText();
  const receipt = size === "receipt";
  const wide = fixedWidth && !receipt;
  const figures = voucherFigures(purchase, payment.id);
  const money = (amount: number) => formatMoney(amount, purchase.currency);

  return (
    <Paper ref={ref} size={size} fixedWidth={fixedWidth}>
      <PaperHeader
        shop={shop}
        taxText={shop.taxNumber ? tInvoice("taxNumber", { number: shop.taxNumber }) : undefined}
        title={t("titleVoucher")}
        stamps={payment.voided ? <PaperStamp tone="void">{t("void")}</PaperStamp> : <PaperStamp tone="paid">{tPurchases("payment_paid")}</PaperStamp>}
        receipt={receipt}
      />
      <PaperDivider receipt={receipt} />

      <section className={cn("grid gap-4 text-sm", receipt ? "grid-cols-1" : wide ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
        <dl className="flex flex-col gap-1">
          <PaperRow label={t("number")} value={formatDocumentNumber("payment", payment.number)} strong />
          <PaperRow label={tInvoice("date")} value={billDay(payment.paidOn)} />
          <PaperRow label={tPurchases("methodLabel")} value={tPurchases(`method_${payment.method}`)} />
          <PaperRow label={t("forBill")} value={[title(purchase), purchase.billRef].filter(Boolean).join(" · ")} />
        </dl>
        <div className={cn(wide ? "border-l border-paper-line pl-4" : !receipt && "sm:border-l sm:border-paper-line sm:pl-4")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-paper-muted">{t("paidTo")}</p>
          <p className="font-semibold">{purchase.supplierName || tPurchases("noSupplier")}</p>
          {purchase.supplierPhone && <p className="tabular-nums">{formatKhmerPhoneLocal(purchase.supplierPhone)}</p>}
        </div>
      </section>

      {/* The amount, in large type */}
      <section className={cn("flex flex-col items-center gap-1 rounded-lg border-2 border-paper-ink py-4 text-center", payment.voided && "line-through")}>
        <p className="text-xs font-semibold uppercase tracking-wide text-paper-muted">{t("amountPaid")}</p>
        <p className="text-3xl font-bold tabular-nums">{money(payment.amountMinor)}</p>
      </section>

      {figures && (
        <section className={cn("flex", receipt ? "flex-col" : "justify-end")}>
          <dl className={cn("flex flex-col gap-1 text-sm", wide ? "w-80" : !receipt && "w-full sm:w-80")}>
            <PaperRow label={t("billTotal")} value={money(figures.billDue)} />
            <PaperRow label={t("paidBefore")} value={money(figures.paidBefore)} />
            <PaperRow label={t("thisPayment")} value={payment.voided ? `${money(figures.amount)} · ${t("void")}` : money(figures.amount)} />
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-paper-ink pt-2">
              <dt className="font-bold">{t("balanceAfter")}</dt>
              <dd className="text-lg font-bold tabular-nums">{figures.leftAfter === null ? "—" : money(Math.max(0, figures.leftAfter))}</dd>
            </div>
          </dl>
        </section>
      )}

      {payment.note && <p className="whitespace-pre-line rounded-lg border border-paper-line p-3 text-sm">{payment.note}</p>}

      <PaperSignatures labels={[t("signPaidBy"), t("signReceivedPayment")]} receipt={receipt} />

      <footer className="flex flex-col items-center gap-0.5 text-center">
        <p className="text-xs text-paper-muted">{t("printedOn", { time: dateTime(new Date().toISOString()) })}</p>
        <p className="text-xs text-paper-muted">{tInvoice("madeWith")}</p>
      </footer>
    </Paper>
  );
});
