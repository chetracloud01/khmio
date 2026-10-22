"use client";

import { formatKhmerPhoneLocal, getOrderTab, listQueryToSearchParams, ORDER_TABS, type ListPage, type ListQuery } from "@khmio/shared";
import { cn, Mio, Notice, PageHeader } from "@khmio/ui";
import { AlertTriangle, Phone, Store, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { DataGrid, DataGridHighlight, type DataGridColumn, type DataGridGroup } from "@/components/data-grid";
import { formatMoney, ORDER_STATUS_TONE, ORDER_TAB_ICON, ORDER_TAB_TONE, orderStatusIcon, TONE_TEXT, useOrderText } from "@/components/order-ui";
import { OrderStatusCircle } from "@/components/seller-cards";
import { SELLER_PAGE } from "@/components/seller-frame/seller-frame";
import { api, type SellerOrder } from "@/lib/api";
import { OrderNextStep } from "../order-next-step";

/** An order still to confirm this long gets a "Waiting 25 min" warning. */
const LATE_AFTER_MINUTES = 15;
const PHNOM_PENH_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "2026-10-22": the Phnom Penh day an order was placed. */
const phnomPenhDay = (iso: string) => new Date(new Date(iso).getTime() + PHNOM_PENH_OFFSET_MS).toISOString().slice(0, 10);

// The seller's orders (design/screens.md S4), in the shared data grid: a table
// on a laptop, compact rows on a phone (2026-10-22 review), grouped by day
// while sorted by date. Each order carries its one next step — a one-tap pill,
// or a link into the order when the step needs details — and an order still
// waiting to be confirmed after 15 minutes says so. Read page by page from
// the server (GET /orders/page), so a shop with thousands of orders still
// finds any of them.
export default function OrdersPage() {
  const t = useTranslations("Orders");
  const tInvoice = useTranslations("Invoice");
  const locale = useLocale();
  const router = useRouter();
  const { paymentLabel, placeLabel, timeAgo, statusLabel } = useOrderText();
  const [problem, setProblem] = useState<string | null>(null);
  /** Bumped after an order moves on, so the list reads its page again. */
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((key) => key + 1), []);
  const loadPage = useCallback((query: ListQuery) => api<ListPage<SellerOrder>>(`/orders/page?${listQueryToSearchParams(query)}`), []);

  const href = (order: SellerOrder) => `/${locale}/m/orders/${order.id}`;
  /** The one next step as a compact pill: a button when it's one tap, otherwise a link into the order (shared with the home page). */
  const nextStep = (order: SellerOrder) => (
    <div className="[&_a]:rounded-full [&_button]:min-h-touch [&_button]:rounded-full [&_button]:px-4 [&_button]:text-sm" onClick={(event) => event.stopPropagation()}>
      <OrderNextStep order={order} onDone={load} onProblem={setProblem} />
    </div>
  );
  const callButton = (order: SellerOrder) => (
    <a
      href={`tel:+${order.buyerPhone}`}
      onClick={(event) => event.stopPropagation()}
      aria-label={t("callBuyer", { name: order.buyerName })}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand hover:bg-brand/15"
    >
      <Phone className="h-4 w-4" aria-hidden="true" />
    </a>
  );
  /** Minutes an order has waited to be confirmed, when that's too long; null otherwise. */
  const lateBy = (order: SellerOrder): number | null => {
    if (getOrderTab(order.status) !== "to_confirm") return null;
    const minutes = Math.floor((Date.now() - Date.parse(order.createdAt)) / 60_000);
    return minutes >= LATE_AFTER_MINUTES ? minutes : null;
  };
  const lateChip = (order: SellerOrder) => {
    const minutes = lateBy(order);
    if (minutes === null) return null;
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        {minutes < 60 ? t("waitingFor", { minutes }) : t("waitingForHours", { hours: Math.floor(minutes / 60) })}
      </span>
    );
  };
  const today = phnomPenhDay(new Date().toISOString());
  const yesterday = phnomPenhDay(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  /** "Today", "Yesterday" or "20 Oct" (our own month names, the same on every phone). */
  const dayLabel = (order: SellerOrder) => {
    const day = phnomPenhDay(order.createdAt);
    if (day === today) return t("groupToday");
    if (day === yesterday) return t("groupYesterday");
    return `${Number(day.slice(8, 10))} ${tInvoice(`month_${Number(day.slice(5, 7))}`)}`;
  };

  const stepRank = (order: SellerOrder) => {
    const tab = getOrderTab(order.status);
    return tab === "awaiting" ? ORDER_TABS.length : ORDER_TABS.indexOf(tab);
  };
  const statusGroups: DataGridGroup<SellerOrder> = {
    // Grouped by step while sorted by date (the server walks the steps in this order across pages).
    sortKey: "order",
    key: (order) => getOrderTab(order.status),
    label: (order) => {
      const tab = getOrderTab(order.status);
      return tab === "awaiting" ? t("tab_awaiting") : t(`tab_${tab}`);
    },
    rank: stepRank,
    icon: (order) => {
      const tab = getOrderTab(order.status);
      const Icon = ORDER_TAB_ICON[tab];
      return <Icon className={cn("h-4 w-4", TONE_TEXT[ORDER_TAB_TONE[tab]])} aria-hidden="true" />;
    },
    labelClass: (order) => TONE_TEXT[ORDER_TAB_TONE[getOrderTab(order.status)]],
  };

  const columns: DataGridColumn<SellerOrder>[] = [
    {
      key: "order",
      header: t("colOrder"),
      hideable: false,
      pin: "start",
      sortable: true,
      value: (order) => Date.parse(order.createdAt),
      exportValue: (order) => order.orderNumber,
      cell: (order) => (
        <div className="flex flex-col items-start gap-1">
          <p className="font-semibold"><DataGridHighlight text={`#${order.orderNumber}`} /></p>
          <p className="text-xs text-muted">{timeAgo(order.createdAt)}</p>
          {lateChip(order)}
        </div>
      ),
    },
    {
      key: "buyer",
      header: t("colBuyer"),
      sortable: true,
      value: (order) => order.buyerName,
      cell: (order) => (
        <div className="flex min-w-0 items-center gap-2">
          {callButton(order)}
          <div className="min-w-0">
            <p className="truncate font-medium"><DataGridHighlight text={order.buyerName} /></p>
            <p className="text-xs text-muted tabular-nums">{formatKhmerPhoneLocal(order.buyerPhone)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "delivery",
      header: t("colDelivery"),
      value: (order) => `${placeLabel(order)} · ${paymentLabel(order)}`,
      cell: (order) => (
        <div className="flex items-start gap-2">
          {order.fulfilment === "pickup" ? <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> : <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
          <div className="min-w-0">
            <p className="truncate">{placeLabel(order)}</p>
            <p className="truncate text-xs text-muted">{paymentLabel(order)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "total",
      header: t("colTotal"),
      align: "right",
      sortable: true,
      // Orders can be in either currency, so this sorts within a currency, not across them.
      value: (order) => order.totalMinor,
      exportValue: (order) => formatMoney(order.totalMinor, order.currency),
      cell: (order) => (
        <div>
          <p className="font-semibold tabular-nums">{formatMoney(order.totalMinor, order.currency)}</p>
          <p className="text-xs text-muted">{t("itemCount", { count: order.itemCount })}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: t("colStatus"),
      sortable: true,
      value: (order) => statusLabel(order),
      cell: (order) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <StatusIcon order={order} />
          {statusLabel(order)}
        </span>
      ),
    },
    { key: "next", header: t("colNext"), align: "right", hideable: false, pin: "end", exportValue: () => "", cell: (order) => <div className="flex justify-end">{nextStep(order)}</div> },
  ];


  return (
    <div className={`${SELLER_PAGE} gap-4`}>
      <PageHeader title={t("title")} description={t("description")} />

      {problem && (
        <Notice tone="warning" role="alert">
          {problem}
        </Notice>
      )}

      <DataGrid
        rowNumbers
        syncUrl
        server={{ load: loadPage, reloadKey }}
        getRowId={(order) => order.id}
        columns={columns}
        searchPlaceholder={t("searchPlaceholder")}
        chips={ORDER_TABS.map((tab) => ({ value: tab, label: t(`tab_${tab}`), icon: ORDER_TAB_ICON[tab], iconClass: TONE_TEXT[ORDER_TAB_TONE[tab]] }))}
        // Open on what needs the seller first; everything when nothing does.
        initialChip="to_confirm"
        initialChipFallback="all"
        filters={[
          {
            key: "payment",
            label: t("colPayment"),
            options: [
              { value: "online", label: t("filterOnline") },
              { value: "cod", label: t("filterCash") },
            ],
          },
          {
            key: "fulfilment",
            label: t("filterFulfilment"),
            options: [
              { value: "delivery", label: t("filterDelivery") },
              { value: "pickup", label: t("filterPickup") },
            ],
          },
        ]}
        onRowClick={(order) => router.push(href(order))}
        initialSort={{ key: "order", direction: "desc" }}
        // "All": grouped by step, in the order work happens; one step's tab: grouped by day.
        groupBy={(chip) => (chip === "all" ? statusGroups : { sortKey: "order", key: (order) => phnomPenhDay(order.createdAt), label: dayLabel })}
        defaultPageSize={20}
        renderCard={(order) => (
          <div className="flex items-center gap-3">
            <OrderStatusCircle status={order.status} fulfilment={order.fulfilment} label={statusLabel(order)} />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              {/* The buyer leads (whole name), the order number goes with the details. */}
              <p className="flex w-full items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-semibold"><DataGridHighlight text={order.buyerName} /></span>
                <span className="shrink-0 font-semibold tabular-nums">{formatMoney(order.totalMinor, order.currency)}</span>
              </p>
              <p className="w-full truncate text-xs text-muted">
                <span className="sr-only">{statusLabel(order)} · </span>
                <span className="font-semibold text-fg"><DataGridHighlight text={`#${order.orderNumber}`} /></span> · {placeLabel(order)} · {t("itemCount", { count: order.itemCount })} · {timeAgo(order.createdAt)}
              </p>
              {lateChip(order)}
            </div>
          </div>
        )}
        renderCardAction={(order) => (
          // Call and the next step, lined up on the right under the order.
          <div className="flex items-center justify-end gap-2 pb-3 pl-[68px] pr-4">
            {callButton(order)}
            {nextStep(order)}
          </div>
        )}
        exportFileName="orders"
        storageKey="seller-orders"
        emptyTitle={t("noOrders")}
        emptyArt={<Mio size={80} />}
      />
    </div>
  );
}

/** The status's own icon in its colour, for the laptop table. */
function StatusIcon({ order }: { order: SellerOrder }) {
  const Icon = orderStatusIcon(order);
  return <Icon className={cn("h-4 w-4 shrink-0", TONE_TEXT[ORDER_STATUS_TONE[order.status]])} aria-hidden="true" />;
}
