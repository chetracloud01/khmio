"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import type { InvoiceData } from "@/components/invoice/invoice-document";
import { InvoiceScreen } from "@/components/invoice/invoice-screen";
import { formatMoney } from "@/components/order-ui";
import { useCounterSales, type CounterSale } from "../../../../counter-sales-context";
import { useShopIdentity } from "../../../../shop-identity";

// The receipt of a sale at the counter (design/screens.md P3): the shop's
// invoice screen at 80 mm roll size, without the order QR or tracking code.
export default function CounterReceiptPage() {
  const t = useTranslations("Counter");
  const params = useParams<{ number: string }>();
  const { hydrated, sales } = useCounterSales();
  const sale = sales.find((entry) => entry.number === decodeURIComponent(params.number));
  if (!hydrated) return null;
  if (!sale) return <p className="p-6 text-center text-sm text-muted">{t("receiptMissing")}</p>;
  return <Receipt sale={sale} />;
}

function Receipt({ sale }: { sale: CounterSale }) {
  const t = useTranslations("Counter");
  const locale = useLocale();
  const shop = useShopIdentity();

  const data = useMemo<InvoiceData>(() => {
    const paid = sale.payment === "cash" ? t("receiptCash") : t("receiptQr");
    const cash =
      sale.cashReceived !== undefined && sale.change !== undefined
        ? ` · ${t("receiptCashDetail", { received: formatMoney(sale.cashReceived, sale.currency), change: formatMoney(sale.change, sale.currency) })}`
        : "";
    return {
      shop: {
        name: shop.name,
        logoUrl: shop.logoDataUrl,
        phone: shop.phone,
        address: shop.address,
        taxNumber: shop.taxNumber,
        telegram: shop.telegram,
        facebook: shop.facebook,
        note: shop.invoiceNote,
      },
      orderNumber: sale.number,
      placedAtIso: sale.atIso,
      state: sale.voided ? "cancelled" : "paid",
      currency: sale.currency,
      exchangeRateUsed: sale.rate,
      inStore: true,
      lines: sale.lines.map((line) => ({ key: line.key, title: line.title, option: line.option, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal })),
      subtotal: sale.subtotal,
      discount: sale.discount,
      deliveryFee: 0,
      vatPercent: sale.vatPercent,
      vat: sale.vat,
      total: sale.total,
      ...(sale.buyerName || sale.buyerPhone ? { buyer: { name: sale.buyerName, phone: sale.buyerPhone, pickup: false } } : {}),
      paymentLabel: `${paid}${cash}`,
    };
  }, [sale, shop, t]);

  return (
    <InvoiceScreen
      data={data}
      initialSize="receipt"
      backHref={`/${locale}/mockup/dashboard/sell/today`}
      backLabel={t("todayTitle")}
      badge={sale.voided ? t("voided") : undefined}
    />
  );
}
