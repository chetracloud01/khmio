"use client";

import { ListOrdered } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChartCard } from "@/components/home/chart-parts";
import { formatMoney, useOrderText } from "@/components/order-ui";
import { OrderStatusCircle } from "@/components/seller-cards";
import type { SellerOrder } from "@/lib/api";

/** How many of the newest orders the dashboard lists (Orders has them all). */
export const LATEST_ORDERS = 5;

/** The newest orders (design/screens.md S3): number, buyer, when, status and total, each opening the order. */
export function LatestOrdersCard({ orders, href, orderHref }: { orders: readonly SellerOrder[]; href: string; orderHref: (orderId: string) => string }) {
  const t = useTranslations("HomeDashboard");
  const { statusLabel, timeAgo } = useOrderText();
  const latest = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, LATEST_ORDERS);

  return (
    <ChartCard icon={ListOrdered} title={t("ordersTitle")} link={{ href, label: t("allOrders") }}>
      <ul className="flex flex-col divide-y divide-border">
        {latest.map((order) => (
          <li key={order.id}>
            <Link href={orderHref(order.id)} className="flex min-h-touch items-center gap-3 py-2 hover:bg-border/20">
              <OrderStatusCircle status={order.status} fulfilment={order.fulfilment} label={statusLabel(order)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  #{order.orderNumber} · {order.buyerName || t("walkIn")}
                </span>
                <span className="block truncate text-xs text-muted">
                  {statusLabel(order)} · {timeAgo(order.createdAt)}
                </span>
              </span>
              <span className={order.status === "cancelled" ? "shrink-0 text-sm font-semibold tabular-nums text-muted line-through" : "shrink-0 text-sm font-semibold tabular-nums"}>{formatMoney(order.totalMinor, order.currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
