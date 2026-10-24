"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { formatMoney, useOrderText } from "@/components/order-ui";
import type { OrderInvoice } from "@/lib/api";
import type { InvoiceData } from "./invoice-document";

/**
 * An invoice from the API (seller or buyer) as the document shows it, in the
 * viewer's language. A sale at the counter has no delivery, order QR or
 * tracking code, its buyer only if they gave a name or phone, and the cash
 * received and change in its payment line.
 */
export function useInvoiceData(invoice: OrderInvoice): InvoiceData {
  const locale = useLocale();
  const tCounter = useTranslations("Counter");
  const { placeLabel, paymentLabel } = useOrderText();
  // Full addresses for the QR and the printed link, once the page knows where it's open.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  return useMemo(() => {
    const { order, shop } = invoice;
    const km = locale === "km";
    const inStore = order.channel === "in_store";
    const cash =
      order.cashReceivedMinor !== null && order.changeMinor !== null
        ? ` · ${tCounter("receiptCashDetail", { received: formatMoney(order.cashReceivedMinor, order.currency), change: formatMoney(order.changeMinor, order.currency) })}`
        : "";
    return {
      shop: {
        name: shop.name,
        logoUrl: shop.logoUrl,
        phone: shop.phone,
        address: shop.address,
        taxNumber: shop.taxNumber,
        telegram: shop.telegramLink,
        facebook: shop.facebookLink,
        note: shop.invoiceNote,
      },
      orderNumber: String(order.orderNumber),
      ...(inStore ? {} : { trackingCode: order.trackingCode }),
      placedAtIso: order.createdAt,
      state: order.state,
      currency: order.currency,
      exchangeRateUsed: order.exchangeRateUsed,
      lines: order.items.map((item, index) => ({
        key: String(index),
        // Each name as it was saved with the order; English falls back to Khmer.
        title: km ? item.titleKm : item.titleEn || item.titleKm,
        option: (km ? item.variantLabelKm : item.variantLabelEn || item.variantLabelKm) || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPriceMinor,
        lineTotal: item.lineTotalMinor,
      })),
      subtotal: order.subtotalMinor,
      discount: order.discountMinor,
      deliveryFee: order.deliveryFeeMinor,
      vatPercent: order.vatPercent,
      vat: order.vatMinor,
      total: order.totalMinor,
      inStore,
      ...(inStore
        ? order.buyerName || order.buyerPhone
          ? { buyer: { name: order.buyerName, phone: order.buyerPhone, pickup: false } }
          : {}
        : {
            buyer: { name: order.buyerName, phone: order.buyerPhone, pickup: order.fulfilment === "pickup", place: placeLabel(order), landmark: order.landmark },
            orderUrl: `${origin}/${locale}/o/${encodeURIComponent(invoice.orderToken)}`,
            trackUrl: `${origin}/${locale}/track`,
          }),
      paymentLabel: `${paymentLabel(order)}${cash}`,
    };
  }, [invoice, locale, placeLabel, paymentLabel, origin, tCounter]);
}
