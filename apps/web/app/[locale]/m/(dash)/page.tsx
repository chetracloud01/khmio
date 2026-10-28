"use client";

import { needsSellerAction, parseTrackingCode, trackingCodePrefix } from "@khmio/shared";
import { BottomSheet, Card, EmptyState, Mio, Skeleton } from "@khmio/ui";
import { PackagePlus, ScanLine, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { formatMoney, useOrderText } from "@/components/order-ui";
import { FindOrderPanel, OrdersNeedingAction, type ActionRow } from "@/components/seller-cards";
import { SELLER_PAGE } from "@/components/seller-frame/seller-frame";
import { SalesOverview } from "@/components/sales-overview";
import { HomeTopBar, NeedsYouBanner, QuickActions } from "@/components/seller-app";
import { api, type SellerOrder, sellerOrderSchema } from "@/lib/api";
import { shopStateOf, useMerchant } from "./merchant-context";
import { OrderNextStep } from "./order-next-step";
import { SetupChecklist } from "./setup-checklist";
import { useShareShop } from "./share-shop";
import { z } from "zod";

// The seller's home (design/screens.md S3), from the shared sections in
// components/seller-home. The numbers come
// from GET /orders/summary (kept fresh by the dashboard layout, every minute
// and after each order step); the rows from the order list.
export default function MerchantHomePage() {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const { me, store, summary, refreshSummary } = useMerchant();
  const { placeLabel, timeAgo, statusLabel } = useOrderText();
  const [orders, setOrders] = useState<SellerOrder[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const tApp = useTranslations("SellerApp");
  const [findOpen, setFindOpen] = useState(false);
  const shareShop = useShareShop();

  const loadOrders = useCallback(() => {
    api("/orders", z.array(sellerOrderSchema)).then(setOrders, () => setOrders((previous) => previous ?? []));
  }, []);
  // Again whenever the layout's minute refresh sees the waiting count change, so the rows follow the numbers.
  const waiting = summary?.waiting ?? 0;
  useEffect(loadOrders, [loadOrders, waiting]);

  const base = `/${locale}/m`;
  const header = (
    <HomeTopBar
      firstName={me.merchant.firstName}
      state={shopStateOf(me, store)}
      onSearch={() => setFindOpen(true)}
      codePrefix={trackingCodePrefix(store.slug)}
    />
  );

  if (!summary || !orders) {
    return (
      <div className={`${SELLER_PAGE} gap-5`} aria-busy="true">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const toHandle = orders.filter((order) => needsSellerAction(order.status));
  const rows: ActionRow[] = toHandle.map((order) => ({
    key: order.id,
    href: `${base}/orders/${order.id}`,
    number: `#${order.orderNumber}`,
    buyer: order.buyerName,
    details: `${placeLabel(order)} · ${timeAgo(order.createdAt)}`,
    total: formatMoney(order.totalMinor, order.currency),
    status: order.status,
    fulfilment: order.fulfilment,
    statusLabel: statusLabel(order),
    next: (
      <OrderNextStep
        order={order}
        onDone={() => {
          loadOrders();
          void refreshSummary();
        }}
        onProblem={setProblem}
      />
    ),
  }));

  const quickActions = [
    { key: "sell", href: `${base}/sell`, icon: ScanLine, label: tApp("quickSell"), hint: tApp("quickSellHint"), tone: "teal" as const },
    { key: "add", href: `${base}/products/new`, icon: PackagePlus, label: tApp("quickAddProduct"), hint: tApp("addProductHint"), tone: "teal" as const },
    { key: "share", onClick: shareShop.open, icon: Share2, label: tApp("quickShareShop"), hint: tApp("shareShopHint"), tone: "amber" as const },
  ];

  return (
    <div className={`${SELLER_PAGE} gap-5`}>
      {header}
      <NeedsYouBanner count={summary.waiting} href={`${base}/orders`} />
      <QuickActions items={quickActions} />
      <SetupChecklist />
      <SalesOverview days={summary.days} top={summary.topProducts} cashToCollect={summary.cashToCollect} mainCurrency={store.defaultCurrency} reportLink={{ href: `${base}/reports/profit`, label: tApp("profitReportLink") }} />
      {problem && (
        <p role="alert" className="rounded-DEFAULT bg-danger/10 px-4 py-2 text-sm text-danger">
          {problem}
        </p>
      )}

      {orders.length === 0 ? (
        <Card className="p-4">
          <EmptyState art={<Mio size={96} />} title={t("firstOrderTitle")} body={t("firstOrderBody")} />
        </Card>
      ) : (
        <OrdersNeedingAction rows={rows} total={summary.waiting} allHref={`${base}/orders`} />
      )}

      <BottomSheet open={findOpen} onClose={() => setFindOpen(false)} closeLabel={tApp("close")} title={tApp("findOrder")}>
        <FindOrderPanel
          prefix={trackingCodePrefix(store.slug)}
          hrefFor={(code) => {
            // Among the latest orders the list holds.
            const match = orders.find((order) => parseTrackingCode(order.trackingCode) === code);
            return match ? `${base}/orders/${match.id}` : null;
          }}
        />
      </BottomSheet>
    </div>
  );
}
