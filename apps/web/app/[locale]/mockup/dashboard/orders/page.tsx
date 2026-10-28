"use client";

import { formatKhmerPhoneLocal, getOrderTab, ORDER_TABS } from "@khmio/shared";
import { Mio, PageHeader } from "@khmio/ui";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { OrderRecord } from "@/mock/mock-orders";
import { CustomersLink } from "@/components/customers/customers-link";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { getNextAction, OrderNextButton, sellerOrderHref } from "../../order-next-button";
import { formatMoney, OrderStatusPill, useOrderText } from "@/components/order-ui";
import { useOrders } from "../../orders-context";

export default function DashboardOrdersPage() {
  const { hydrated } = useOrders();
  return hydrated ? <OrdersList /> : null;
}

// Seller's orders (design/screens.md S4): tabs follow the order rules in
// packages/shared orders.ts, and each row carries its one next step.
function OrdersList() {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const router = useRouter();
  const { orders } = useOrders();
  const { statusLabel, paymentLabel, placeLabel, timeAgo } = useOrderText();

  const open = (order: OrderRecord) => router.push(sellerOrderHref(locale, order.orderNumber));

  /** The row's next step, or "View" when there's nothing to do but look. */
  function nextButton(order: OrderRecord) {
    if (getNextAction(order)) return <OrderNextButton order={order} />;
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
        {t("view")}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  const columns: DataGridColumn<OrderRecord>[] = [
    {
      key: "order",
      header: t("colOrder"),
      hideable: false,
      sortable: true,
      value: (order) => new Date(order.placedAtIso).getTime(),
      exportValue: (order) => order.orderNumber,
      cell: (order) => (
        <div>
          <p className="font-medium">{order.orderNumber}</p>
          <p className="text-xs text-muted">{timeAgo(order.placedAtIso)}</p>
        </div>
      ),
    },
    {
      key: "buyer",
      header: t("colBuyer"),
      sortable: true,
      value: (order) => order.name,
      cell: (order) => (
        <div className="min-w-0">
          <p className="truncate">{order.name}</p>
          <p className="text-xs text-muted tabular-nums">{formatKhmerPhoneLocal(order.phone)}</p>
        </div>
      ),
    },
    {
      key: "place",
      header: t("colPlace"),
      value: (order) => placeLabel(order),
      cell: (order) => placeLabel(order),
    },
    {
      key: "payment",
      header: t("colPayment"),
      value: (order) => paymentLabel(order),
      cell: (order) => paymentLabel(order),
    },
    {
      key: "total",
      header: t("colTotal"),
      align: "right",
      sortable: true,
      // Orders can be in either currency, so this sorts within a currency, not across them.
      value: (order) => order.total,
      exportValue: (order) => formatMoney(order.total, order.currency),
      cell: (order) => <span className="font-medium tabular-nums">{formatMoney(order.total, order.currency)}</span>,
    },
    {
      key: "status",
      header: t("colStatus"),
      sortable: true,
      value: (order) => statusLabel(order),
      cell: (order) => <OrderStatusPill order={order} />,
    },
    {
      key: "next",
      header: t("colNext"),
      align: "right",
      hideable: false,
      exportValue: () => "",
      cell: (order) => nextButton(order),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-4 text-fg md:p-6">
      <PageHeader title={t("title")} description={t("description")} actions={<CustomersLink href={`/${locale}/mockup/dashboard/customers`} />} />

      <DataGrid
        rowNumbers
        rows={orders}
        getRowId={(order) => order.orderNumber}
        columns={columns}
        searchText={(order) => `${order.orderNumber} ${order.name} ${order.phone} ${formatKhmerPhoneLocal(order.phone)}`}
        searchPlaceholder={t("searchPlaceholder")}
        chips={ORDER_TABS.map((tab) => ({
          value: tab,
          label: t(`tab_${tab}`),
          predicate: (order: OrderRecord) => getOrderTab(order.status) === tab,
        }))}
        initialChip="to_confirm"
        filters={[
          {
            key: "payment",
            label: t("colPayment"),
            options: [
              { value: "online", label: t("filterOnline") },
              { value: "cod", label: t("filterCash") },
            ],
            predicate: (order, value) => (order.paymentMethod === "cod") === (value === "cod"),
          },
          {
            key: "fulfilment",
            label: t("filterFulfilment"),
            options: [
              { value: "delivery", label: t("filterDelivery") },
              { value: "pickup", label: t("filterPickup") },
            ],
            predicate: (order, value) => order.fulfilment === value,
          },
        ]}
        onRowClick={open}
        initialSort={{ key: "order", direction: "desc" }}
        renderCard={(order) => (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{order.orderNumber}</p>
                <p className="truncate text-sm text-muted">
                  {order.name} · {timeAgo(order.placedAtIso)}
                </p>
              </div>
              <OrderStatusPill order={order} className="shrink-0" />
            </div>
            <div className="flex items-end justify-between gap-2 text-sm">
              <div className="min-w-0 text-muted">
                <p className="truncate">{placeLabel(order)}</p>
                <p className="truncate">{paymentLabel(order)}</p>
              </div>
              <span className="shrink-0 text-base font-semibold tabular-nums text-fg">{formatMoney(order.total, order.currency)}</span>
            </div>
          </div>
        )}
        renderCardAction={(order) =>
          getNextAction(order) ? (
            <div className="px-4 pb-4">
              <OrderNextButton order={order} fullWidth />
            </div>
          ) : null
        }
        exportFileName="orders"
        storageKey="merchant-orders"
        emptyTitle={t("noOrders")}
        emptyArt={<Mio size={80} />}
      />
    </div>
  );
}
