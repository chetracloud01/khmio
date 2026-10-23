"use client";

import { formatTrackingCode, getInvoiceState } from "@khmio/shared";
import { Button } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BuyerShell } from "@/components/buyer-shell";
import { type InvoiceData } from "@/components/invoice/invoice-document";
import { InvoiceScreen } from "@/components/invoice/invoice-screen";
import { useOrderText } from "@/components/order-ui";
import { mockStore, mockStoreSettings, mockTrackingCode } from "@/mock/mock-data";
import { orderLineLabel, type OrderRecord } from "@/mock/mock-orders";
import { useMerchantProducts } from "../../../merchant-products-context";
import { useOrders } from "../../../orders-context";
import { useShopIdentity } from "../../../shop-identity";

// The invoice / receipt (design/screens.md B7) for one sample order. Buyer
// and seller see the same document; the seller reaches it from the order
// detail, the buyer from the order page.
export default function InvoicePage() {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const params = useParams<{ number: string }>();
  const { hydrated, orders } = useOrders();
  if (!hydrated) return null;
  const order = orders.find((item) => item.orderNumber === decodeURIComponent(params.number));
  if (!order) {
    return (
      <BuyerShell className="items-center justify-center gap-3 p-4 text-center">
        <p className="font-semibold">{t("notFoundTitle")}</p>
        <p className="text-sm text-muted">{t("notFoundBody")}</p>
        <Link href={`/${locale}/mockup/storefront`} className="block">
          <Button variant="primary">{t("backToShop")}</Button>
        </Link>
      </BuyerShell>
    );
  }
  return <Invoice order={order} />;
}

function Invoice({ order }: { order: OrderRecord }) {
  const t = useTranslations("Invoice");
  const locale = useLocale();
  const { products } = useMerchantProducts();
  const shop = useShopIdentity();
  const { placeLabel, paymentLabel } = useOrderText();
  // Full addresses for the QR and the printed link, once the page knows where it's open.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const data = useMemo<InvoiceData>(() => {
    const subtotal = order.lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const state = getInvoiceState(order);
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
      orderNumber: order.orderNumber,
      trackingCode: formatTrackingCode(mockStore.slug, mockTrackingCode(order.orderNumber)),
      placedAtIso: order.placedAtIso,
      state,
      currency: order.currency,
      exchangeRateUsed: mockStoreSettings.usdToKhrRate,
      lines: order.lines.map((line) => ({
        key: line.key,
        title: orderLineLabel(line, locale, products),
        quantity: line.qty,
        unitPrice: Math.round(line.lineTotal / line.qty),
        lineTotal: line.lineTotal,
      })),
      subtotal,
      discount: 0,
      deliveryFee: order.deliveryFee,
      vatPercent: order.vatPercent,
      vat: order.vat,
      total: order.total,
      buyer: { name: order.name, phone: order.phone, pickup: order.fulfilment === "pickup", place: placeLabel(order), landmark: order.landmark },
      paymentLabel: paymentLabel(order),
      orderUrl: `${origin}/${locale}/mockup/order/${encodeURIComponent(order.orderNumber)}`,
      trackUrl: `${origin}/${locale}/mockup/track`,
    };
  }, [order, shop, locale, products, placeLabel, paymentLabel, origin]);

  return (
    <InvoiceScreen
      data={data}
      backHref={`/${locale}/mockup/order/${encodeURIComponent(order.orderNumber)}`}
      backLabel={t("backToOrder")}
      badge={t("sampleData")}
    />
  );
}
