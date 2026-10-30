"use client";

import { formatDocumentNumber, formatKhmerPhoneLocal } from "@khmio/shared";
import { cn } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import { forwardRef } from "react";
import { formatMoney } from "@/components/order-ui";
import { Paper, PaperDivider, PaperHeader, PaperRow, PaperSignatures, PaperStamp, type PaperShop, type PaperSize } from "@/components/paper/paper-parts";
import { itemName } from "@/components/stock/item-name";
import { useDateText } from "@/components/use-date-text";
import type { PurchaseDetail } from "@/lib/api";
import { usePurchaseText } from "./use-purchase-text";

/**
 * A bill or a supplier return on paper (design/screens.md S13 "Printing"):
 * the shop, PURCHASE BILL or SUPPLIER RETURN with its stamps (payment
 * standing; not received), the bill's facts, the supplier, the items, the
 * totals — less returns, paid, balance due — every payment (voided ones
 * struck through), the note and lines to sign.
 */
export const BillPaper = forwardRef<HTMLDivElement, { purchase: PurchaseDetail; shop: PaperShop; size: PaperSize; fixedWidth?: boolean }>(function BillPaper({ purchase, shop, size, fixedWidth = false }, ref) {
  const t = useTranslations("BillPaper");
  const tPurchases = useTranslations("Purchases");
  const tInvoice = useTranslations("Invoice");
  const locale = useLocale();
  const { title, billDay } = usePurchaseText();
  const { dateTime } = useDateText();
  const receipt = size === "receipt";
  const wide = fixedWidth && !receipt;
  const isReturn = purchase.kind === "return";
  const payment = purchase.payment;
  const money = (amount: number) => formatMoney(amount, purchase.currency);

  const stamps = (
    <>
      {payment && <PaperStamp tone={payment.state === "paid" ? "paid" : "unpaid"}>{tPurchases(`payment_${payment.state}`)}</PaperStamp>}
      {!isReturn && purchase.receivedAt === null && <PaperStamp tone="void">{tPurchases("notReceivedPill")}</PaperStamp>}
    </>
  );

  return (
    <Paper ref={ref} size={size} fixedWidth={fixedWidth}>
      <PaperHeader shop={shop} taxText={shop.taxNumber ? tInvoice("taxNumber", { number: shop.taxNumber }) : undefined} title={t(isReturn ? "titleReturn" : "titleBill")} stamps={stamps} receipt={receipt} />
      <PaperDivider receipt={receipt} />

      <section className={cn("grid gap-4 text-sm", receipt ? "grid-cols-1" : wide ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
        <dl className="flex flex-col gap-1">
          <PaperRow label={t("number")} value={title(purchase)} strong />
          <PaperRow label={tInvoice("date")} value={billDay(purchase.purchasedOn)} />
          {purchase.billRef && <PaperRow label={tPurchases("billRefLabel")} value={purchase.billRef} />}
          {purchase.returnsNumber !== null && <PaperRow label={tPurchases("returnOfLabel")} value={title({ kind: "purchase", number: purchase.returnsNumber })} />}
          {!isReturn && purchase.dueOn && <PaperRow label={t("dueOn")} value={billDay(purchase.dueOn)} />}
          {!isReturn && <PaperRow label={tPurchases("receivedLabel")} value={purchase.receivedAt ? dateTime(purchase.receivedAt) : tPurchases("notReceivedPill")} />}
          {purchase.exchangeRateUsed !== null && <PaperRow label={tPurchases("rateUsedLabel")} value={tPurchases("rateUsed", { rate: purchase.exchangeRateUsed.toLocaleString("en-US") })} />}
        </dl>
        <div className={cn(wide ? "border-l border-paper-line pl-4" : !receipt && "sm:border-l sm:border-paper-line sm:pl-4")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-paper-muted">{t(isReturn ? "returnedTo" : "supplier")}</p>
          <p className="font-semibold">{purchase.supplierName || tPurchases("noSupplier")}</p>
          {purchase.supplierPhone && <p className="tabular-nums">{formatKhmerPhoneLocal(purchase.supplierPhone)}</p>}
        </div>
      </section>

      {/* Items */}
      {receipt ? (
        <section className="flex flex-col gap-2 border-y border-dashed border-paper-ink py-3 text-sm">
          {purchase.lines.map((line) => (
            <div key={line.variantId}>
              <p className="font-medium">{itemName(locale, line)}</p>
              <p className="flex justify-between gap-2 tabular-nums">
                <span className="text-paper-muted">
                  {line.quantity} × {money(line.unitCostMinor)}
                </span>
                <span className="font-medium">{money(line.lineTotalMinor)}</span>
              </p>
            </div>
          ))}
        </section>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-paper-ink text-left text-xs uppercase tracking-wide text-paper-muted">
              <th className="py-2 pr-2 font-semibold">{tInvoice("colItem")}</th>
              <th className="w-12 px-2 py-2 text-center font-semibold">{tInvoice("colQty")}</th>
              <th className={cn("px-2 py-2 text-right font-semibold", wide ? "table-cell" : "hidden sm:table-cell")}>{t("colCost")}</th>
              <th className="py-2 pl-2 text-right font-semibold">{tInvoice("colTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {purchase.lines.map((line) => (
              <tr key={line.variantId} className="border-b border-paper-line align-top">
                <td className="py-2 pr-2">
                  <span className="block font-medium">{itemName(locale, line)}</span>
                  {line.sku && <span className="block text-xs text-paper-muted">{line.sku}</span>}
                  <span className={cn("block text-xs text-paper-muted tabular-nums", wide ? "hidden" : "sm:hidden")}>{money(line.unitCostMinor)}</span>
                </td>
                <td className="px-2 py-2 text-center tabular-nums">{line.quantity}</td>
                <td className={cn("px-2 py-2 text-right tabular-nums", wide ? "table-cell" : "hidden sm:table-cell")}>{money(line.unitCostMinor)}</td>
                <td className="py-2 pl-2 text-right font-medium tabular-nums">{money(line.lineTotalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Totals */}
      <section className={cn("flex", receipt ? "flex-col" : "justify-end")}>
        <dl className={cn("flex flex-col gap-1 text-sm", wide ? "w-72" : !receipt && "w-full sm:w-72")}>
          <PaperRow label={tInvoice("total")} value={money(purchase.totalMinor)} strong={!payment} />
          {payment && (
            <>
              {payment.returned > 0 && <PaperRow label={t("lessReturns")} value={`−${money(payment.returned)}`} />}
              <PaperRow label={t("paid")} value={`−${money(payment.paid)}`} />
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-paper-ink pt-2">
                <dt className="font-bold">{payment.owed < 0 ? t("supplierOwes") : t("balanceDue")}</dt>
                <dd className="text-lg font-bold tabular-nums">{money(Math.abs(payment.owed))}</dd>
              </div>
            </>
          )}
        </dl>
      </section>

      {/* Every payment against the bill */}
      {purchase.payments.length > 0 && (
        <section className="flex flex-col gap-1 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-paper-muted">{t("payments")}</p>
          <ul className="flex flex-col divide-y divide-paper-line border-y border-paper-line">
            {purchase.payments.map((entry) => (
              <li key={entry.id} className={cn("flex items-baseline justify-between gap-3 py-1.5", entry.voided && "text-paper-muted line-through")}>
                <span className="min-w-0">
                  {formatDocumentNumber("payment", entry.number)} · {billDay(entry.paidOn)} · {tPurchases(`method_${entry.method}`)}
                  {entry.voided && ` · ${tPurchases("voided")}`}
                </span>
                <span className="shrink-0 tabular-nums">{money(entry.amountMinor)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {purchase.note && <p className="whitespace-pre-line rounded-lg border border-paper-line p-3 text-sm">{purchase.note}</p>}

      <PaperSignatures labels={isReturn ? [t("signPreparedBy"), t("signSupplier")] : [t("signPreparedBy"), t("signReceivedBy"), t("signApprovedBy")]} receipt={receipt} />

      <footer className="flex flex-col items-center gap-0.5 text-center">
        <p className="text-xs text-paper-muted">{t("printedOn", { time: dateTime(new Date().toISOString()) })}</p>
        <p className="text-xs text-paper-muted">{tInvoice("madeWith")}</p>
      </footer>
    </Paper>
  );
});
