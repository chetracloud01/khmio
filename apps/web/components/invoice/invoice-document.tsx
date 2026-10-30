"use client";

import { approximateIn, formatKhmerPhoneLocal, type Currency, type InvoiceState } from "@khmio/shared";
import { cn } from "@khmio/ui";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { forwardRef, useEffect, useState } from "react";
import { formatMoney } from "@/components/order-ui";
import { Paper, PaperDivider, PaperHeader, PaperRow, PaperStamp, type PaperShop, type PaperSize, type StampTone } from "../paper/paper-parts";
import { useDateText } from "../use-date-text";

// The invoice / receipt (design/screens.md B7): one document for the buyer
// and the seller, on white paper in both themes because it's printed, saved
// as an image or PDF and shared. Every amount is the order's saved amount —
// nothing here recalculates a price.

export type InvoiceSize = PaperSize;

export interface InvoiceShop extends PaperShop {
  note?: string;
}

export interface InvoiceLine {
  key: string;
  title: string;
  option?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceData {
  shop: InvoiceShop;
  orderNumber: string;
  /** As printed: MEK-7K4P-9QXR. None for a sale at the counter. */
  trackingCode?: string;
  placedAtIso: string;
  state: InvoiceState;
  currency: Currency;
  /** The rate frozen on the order, for the "≈" line only. */
  exchangeRateUsed: number;
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  vatPercent: number;
  vat: number;
  total: number;
  /** Sold at the counter (design/screens.md P3): no delivery line, no order QR. */
  inStore?: boolean;
  /** None for a walk-in buyer at the counter who gave no name. */
  buyer?: { name: string; phone: string; pickup: boolean; place?: string; landmark?: string };
  paymentLabel: string;
  /** The order page the QR opens. A counter sale has none, so no QR. */
  orderUrl?: string;
  /** The "Track my order" page, printed under the QR. */
  trackUrl?: string;
}

const STAMP_TONE: Record<InvoiceState, StampTone> = { unpaid: "unpaid", paid: "paid", cancelled: "void" };

export const InvoiceDocument = forwardRef<HTMLDivElement, { data: InvoiceData; size: InvoiceSize; fixedWidth?: boolean; className?: string }>(
  function InvoiceDocument({ data, size, fixedWidth = false, className }, ref) {
    const t = useTranslations("Invoice");
    const { dateTime } = useDateText();
    const [qr, setQr] = useState<string | null>(null);
    useEffect(() => {
      if (!data.orderUrl) return;
      let live = true;
      void QRCode.toDataURL(data.orderUrl, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then((url) => live && setQr(url));
      return () => {
        live = false;
      };
    }, [data.orderUrl]);

    const receipt = size === "receipt";
    // The saved copy is always at paper width, so it takes the wide A4 layout whatever screen it's made on.
    const wide = fixedWidth && !receipt;
    const title = data.state === "paid" ? t("titleReceipt") : data.state === "cancelled" ? t("titleCancelled") : t("titleInvoice");
    // Phnom Penh time and our own month names: a printed or shared document reads the same on every phone.
    const date = dateTime(data.placedAtIso);
    const otherCurrency: Currency = data.currency === "USD" ? "KHR" : "USD";
    const money = (amount: number) => formatMoney(amount, data.currency);
    const totals = (
      <dl className="flex flex-col gap-1 text-sm">
        <PaperRow label={t("subtotal")} value={money(data.subtotal)} />
        {data.discount > 0 && <PaperRow label={t("discount")} value={`−${money(data.discount)}`} />}
        {/* Sold at the counter: nothing was delivered or picked up. */}
        {data.buyer && !data.inStore && (
          <PaperRow label={data.buyer.pickup ? t("pickup") : t("delivery")} value={data.deliveryFee === 0 ? t("free") : money(data.deliveryFee)} />
        )}
        {data.vatPercent > 0 && <PaperRow label={t("vat", { percent: data.vatPercent })} value={money(data.vat)} />}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t-2 border-paper-ink pt-2">
          <dt className="font-bold">{t("total")}</dt>
          <dd className="text-right">
            <span className="block text-lg font-bold tabular-nums">{money(data.total)}</span>
            <span className="block whitespace-nowrap text-xs text-paper-muted tabular-nums">
              {t("approx", { amount: formatMoney(approximateIn(data.total, data.currency, data.exchangeRateUsed), otherCurrency) })}
            </span>
          </dd>
        </div>
      </dl>
    );

    const qrBlock = data.orderUrl && data.trackUrl && (
      <div className={cn("flex items-center gap-3", receipt && "flex-col text-center")}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- a generated data URL
          <img src={qr} alt="" className="h-24 w-24 shrink-0" />
        ) : (
          <span className="h-24 w-24 shrink-0 bg-paper-line/40" aria-hidden="true" />
        )}
        <p className="min-w-0 text-xs text-paper-muted [overflow-wrap:anywhere]">
          <span className="block font-semibold text-paper-ink">{t("scanToTrack")}</span>
          {t("trackAt", { url: data.trackUrl.replace(/^https?:\/\//, "") })}
        </p>
      </div>
    );

    return (
      <Paper ref={ref} size={size} fixedWidth={fixedWidth} className={className}>
        <PaperHeader
          shop={data.shop}
          taxText={data.shop.taxNumber ? t("taxNumber", { number: data.shop.taxNumber }) : undefined}
          title={title}
          stamps={<PaperStamp tone={STAMP_TONE[data.state]}>{t(`stamp_${data.state}`)}</PaperStamp>}
          receipt={receipt}
        />

        <PaperDivider receipt={receipt} />

        {/* Order facts and the customer */}
        <section className={cn("grid gap-4 text-sm", receipt ? "grid-cols-1" : wide ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
          <dl className="flex flex-col gap-1">
            <PaperRow label={t("orderNumber")} value={data.orderNumber} strong />
            <PaperRow label={t("date")} value={date} />
            {data.trackingCode && <PaperRow label={t("trackingCode")} value={data.trackingCode} strong mono />}
          </dl>
          {data.buyer && (
            <div className={cn(wide ? "border-l border-paper-line pl-4" : !receipt && "sm:border-l sm:border-paper-line sm:pl-4")}>
              <p className="text-xs font-semibold uppercase tracking-wide text-paper-muted">{t("billTo")}</p>
              {data.buyer.name && <p className="font-semibold">{data.buyer.name}</p>}
              {data.buyer.phone && <p className="tabular-nums">{formatKhmerPhoneLocal(data.buyer.phone)}</p>}
              {(data.buyer.pickup || data.buyer.place) && <p className="text-paper-muted">{data.buyer.pickup ? t("pickupAtShop") : data.buyer.place}</p>}
              {data.buyer.landmark && <p className="text-paper-muted">{data.buyer.landmark}</p>}
            </div>
          )}
        </section>

        {/* Items */}
        {receipt ? (
          <section className="flex flex-col gap-2 border-y border-dashed border-paper-ink py-3 text-sm">
            {data.lines.map((line) => (
              <div key={line.key}>
                <p className="font-medium">
                  {line.title}
                  {line.option && <span className="text-paper-muted"> · {line.option}</span>}
                </p>
                <p className="flex justify-between gap-2 tabular-nums">
                  <span className="text-paper-muted">
                    {line.quantity} × {money(line.unitPrice)}
                  </span>
                  <span className="font-medium">{money(line.lineTotal)}</span>
                </p>
              </div>
            ))}
          </section>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-paper-ink text-left text-xs uppercase tracking-wide text-paper-muted">
                <th className="py-2 pr-2 font-semibold">{t("colItem")}</th>
                <th className="w-12 px-2 py-2 text-center font-semibold">{t("colQty")}</th>
                <th className={cn("px-2 py-2 text-right font-semibold", wide ? "table-cell" : "hidden sm:table-cell")}>{t("colPrice")}</th>
                <th className="py-2 pl-2 text-right font-semibold">{t("colTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.key} className="border-b border-paper-line align-top">
                  <td className="py-2 pr-2">
                    <span className="block font-medium">{line.title}</span>
                    {line.option && <span className="block text-xs text-paper-muted">{line.option}</span>}
                    <span className={cn("block text-xs text-paper-muted tabular-nums", wide ? "hidden" : "sm:hidden")}>{money(line.unitPrice)}</span>
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">{line.quantity}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", wide ? "table-cell" : "hidden sm:table-cell")}>{money(line.unitPrice)}</td>
                  <td className="py-2 pl-2 text-right font-medium tabular-nums">{money(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totals, payment and the QR */}
        <section
          className={cn("flex gap-6", receipt ? "flex-col" : wide ? "flex-row items-start justify-between" : "flex-col-reverse sm:flex-row sm:items-start sm:justify-between")}
        >
          {!receipt && qrBlock}
          <div className={cn("flex flex-col gap-2", wide ? "w-72" : !receipt && "sm:w-72")}>
            {totals}
            <p className="text-sm">
              <span className="text-paper-muted">{t("payment")}: </span>
              {data.paymentLabel}
            </p>
          </div>
        </section>

        {data.shop.note && <p className="whitespace-pre-line rounded-lg border border-paper-line p-3 text-sm">{data.shop.note}</p>}

        {receipt && qrBlock}

        <footer className="flex flex-col items-center gap-0.5 text-center">
          <p className="font-semibold">{t("thankYou")}</p>
          <p className="text-xs text-paper-muted">{t("madeWith")}</p>
        </footer>
      </Paper>
    );
  },
);
