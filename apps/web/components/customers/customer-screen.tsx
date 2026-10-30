"use client";

import { formatKhmerPhoneLocal, type Currency } from "@khmio/shared";
import { Button, Card, DetailList, EmptyState, SectionTitle } from "@khmio/ui";
import { CalendarPlus, Check, Clock, Coins, Copy, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CallButton } from "@/components/call-button";
import { DetailStats } from "@/components/detail-stats";
import { formatMoney, useOrderText } from "@/components/order-ui";
import { OrderStatusCircle } from "@/components/seller-cards";
import { SubPage } from "@/components/seller-frame/sub-page";
import { copyText } from "@/components/share-link";
import { useDateText } from "@/components/use-date-text";
import type { CustomerDetail, SellerOrder } from "@/lib/api";
import { spentLines } from "./spent";

// One customer (design/screens.md S14): how to reach them, their numbers
// (cancelled and unpaid orders aren't counted), where they last had an order
// delivered, and every order, newest first, each opening its order page.

/** How long "Copied" stays on the button. */
const COPIED_FOR_MS = 2000;

export function CustomerScreen({
  customer,
  mainCurrency,
  orderHref,
  back,
}: {
  customer: CustomerDetail;
  mainCurrency: Currency;
  orderHref: (order: SellerOrder) => string;
  back: { href: string; label: string };
}) {
  const t = useTranslations("Customers");
  const { date, timeAgo } = useDateText();
  const { placeLabel, statusLabel } = useOrderText();
  const [copied, setCopied] = useState(false);
  const phone = formatKhmerPhoneLocal(customer.phone);
  const [spentMain, ...spentOther] = spentLines(customer.spent, mainCurrency);

  async function copyPhone() {
    if (!(await copyText(phone))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FOR_MS);
  }

  const stats = [
    { icon: ShoppingBag, label: t("statOrders"), value: String(customer.orderCount) },
    { icon: Coins, label: t("statSpent"), value: spentMain, detail: spentOther.join(" · ") || undefined },
    { icon: CalendarPlus, label: t("statFirstOrder"), value: date(customer.firstOrderAt) },
    { icon: Clock, label: t("statLastOrder"), value: customer.lastOrderAt ? timeAgo(customer.lastOrderAt) : "—", detail: customer.lastOrderAt ? date(customer.lastOrderAt) : undefined },
  ];

  return (
    <SubPage
      width="page"
      back={back}
      title={customer.name}
      description={phone}
      actions={
        <>
          <CallButton phone={customer.phone} label={t("callCustomer", { name: customer.name })} />
          <Button variant="secondary" onClick={copyPhone} aria-live="polite">
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copied ? t("copied") : t("copyPhone")}
          </Button>
        </>
      }
    >
      <DetailStats stats={stats} note={t("countedHint")} />

      {customer.area && (
        <Card className="flex flex-col gap-3 p-4">
          <SectionTitle>{t("lastDeliveryTitle")}</SectionTitle>
          <DetailList
            items={[
              { label: t("place"), value: placeLabel({ fulfilment: "delivery", area: customer.area, districtId: customer.districtId, provinceId: customer.provinceId }) },
              ...(customer.landmark ? [{ label: t("landmark"), value: customer.landmark }] : []),
            ]}
          />
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle>{t("historyTitle")}</SectionTitle>
        {customer.orders.length === 0 ? (
          <EmptyState title={t("historyEmpty")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-bg">
            {customer.orders.map((order) => (
              <li key={order.id}>
                <Link href={orderHref(order)} className="flex min-h-touch items-center gap-3 p-3 hover:bg-border/20">
                  <OrderStatusCircle status={order.status} fulfilment={order.fulfilment} label={statusLabel(order)} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold">#{order.orderNumber}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatMoney(order.totalMinor, order.currency)}</span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {statusLabel(order)} · {placeLabel(order)} · {t("itemCount", { count: order.itemCount })} · {date(order.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SubPage>
  );
}
