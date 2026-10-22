"use client";

import { isCashOrder, needsSellerAction, trackingCodePrefix } from "@khmio/shared";
import { BottomSheet, Card, EmptyState, Mio, Skeleton } from "@khmio/ui";
import { Bell, PackagePlus, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { formatMoney, useOrderText } from "@/components/order-ui";
import { SELLER_PAGE } from "@/components/seller-frame/seller-frame";
import { type Money, type ShopState } from "@/components/seller-home";
import { FindOrderPanel, OrdersNeedingAction, ShareShopCard, type ActionRow } from "@/components/seller-cards";
import { SalesOverview, type SalesHistoryDay, type TopProduct } from "@/components/sales-overview";
import { HomeTopBar, NeedsYouBanner, NewOrderToast, playNewOrderChime, QuickActions } from "@/components/seller-app";
import { mockDailyStats, mockMerchant, mockStore, mockTrackingCode } from "@/mock/mock-data";
import { orderLineLabel, type OrderRecord } from "@/mock/mock-orders";
import { useMerchantProducts } from "../merchant-products-context";
import { useMerchantProfile } from "../merchant-profile-context";
import { useMerchantSubscription } from "../merchant-subscription-context";
import { OrderNextButton, sellerOrderHref } from "../order-next-button";
import { useOrders } from "../orders-context";
import { useStoreSettings } from "../store-settings-context";
import { SetupChecklist } from "./setup-checklist";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dollars and riel kept apart — a riel order is never converted (docs/blueprint.md "Multi-currency pricing and totals"). */
function sumByCurrency(orders: OrderRecord[]): Money {
  const sums: Money = { USD: 0, KHR: 0 };
  for (const order of orders) sums[order.currency] += order.total;
  return sums;
}

const isSale = (order: OrderRecord) => order.status !== "cancelled" && order.status !== "awaiting_payment";

export default function DashboardMockupPage() {
  const { hydrated: ordersReady } = useOrders();
  const { hydrated: profileReady } = useMerchantProfile();
  const { hydrated: settingsReady } = useStoreSettings();
  const { hydrated: subscriptionReady } = useMerchantSubscription();
  return ordersReady && profileReady && settingsReady && subscriptionReady ? <DashboardHome /> : <DashboardSkeleton />;
}

function DashboardSkeleton() {
  const t = useTranslations("Dashboard");
  return (
    <div className={`${SELLER_PAGE} gap-5`} aria-busy="true">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

// The seller's home mockup (design/screens.md S3): the same shared sections as
// the live page (components/seller-home), fed with the mockup's sample orders.
// The chart's daily totals are made-up numbers, and say so.
function DashboardHome() {
  const tApp = useTranslations("SellerApp");
  const [findOpen, setFindOpen] = useState(false);
  const [toast, setToast] = useState<{ number: string; total: string; place: string; href: string } | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const profile = useMerchantProfile();
  const { orders } = useOrders();
  const { settings } = useStoreSettings();
  const { subscription } = useMerchantSubscription();
  const { placeLabel, timeAgo, statusLabel } = useOrderText();

  const now = Date.now();
  const needingAction = orders.filter((order) => needsSellerAction(order.status));
  const today = new Date().toDateString();
  const ageInDays = (order: OrderRecord) => (now - new Date(order.placedAtIso).getTime()) / DAY_MS;
  const thisWeek = orders.filter((order) => isSale(order) && ageInDays(order) < 7);

  const { products } = useMerchantProducts();
  // Top products by sales for each period, from the sample orders (the API works these out in the live app).
  const topProducts = useMemo(() => {
    const forDays = (length: number): TopProduct[] => {
      const totals = new Map<string, TopProduct>();
      for (const order of orders) {
        if (!isSale(order) || ageInDays(order) >= length) continue;
        for (const line of order.lines) {
          const name = orderLineLabel(line, locale, products);
          const entry = totals.get(line.key) ?? { nameKm: name, nameEn: name, quantity: 0, USD: 0, KHR: 0 };
          entry.quantity += line.qty;
          entry[order.currency] += line.lineTotal;
          totals.set(line.key, entry);
        }
      }
      return [...totals.values()].sort((x, y) => y.USD - x.USD || y.KHR - x.KHR).slice(0, 5);
    };
    return { today: forDays(1), week: forDays(7), month: forDays(30) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` moves every render; the orders are what change the answer
  }, [orders, locale, products]);

  // 60 sample days in the shape of the API's sales history (dollars only in the samples).
  const salesDays: SalesHistoryDay[] = useMemo(
    () =>
      [...mockDailyStats]
        .sort((x, y) => y.daysAgo - x.daysAgo)
        .map((stat) => ({ date: new Date(now - stat.daysAgo * DAY_MS).toISOString().slice(0, 10), USD: stat.revenueUsdCents, KHR: 0, ordersUSD: stat.orders, ordersKHR: 0 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit
    [],
  );

  const state: ShopState =
    subscription.status === "paused"
      ? { kind: "paused" }
      : subscription.status === "grace"
        ? { kind: "due" }
        : subscription.status === "trialing"
          ? { kind: "trial", daysLeft: subscription.daysLeft }
          : { kind: "open" };

  const base = `/${locale}/mockup/dashboard`;
  const storefrontHref = `/${locale}/mockup/storefront`;
  const shopName = profile.hasProfile ? profile.shopName : locale === "km" ? mockStore.nameKm : mockStore.nameEn;
  const shopLink = <ShareShopCard url={`${window.location.origin}${storefrontHref}`} shopName={shopName} />;
  const rows: ActionRow[] = needingAction.map((order) => ({
    key: order.orderNumber,
    href: sellerOrderHref(locale, order.orderNumber),
    number: order.orderNumber,
    buyer: order.name,
    details: `${placeLabel(order)} · ${timeAgo(order.placedAtIso)}`,
    total: formatMoney(order.total, order.currency),
    status: order.status,
    fulfilment: order.fulfilment,
    statusLabel: statusLabel(order),
    next: <OrderNextButton order={order} />,
  }));

  const findHref = (code: string) => {
    const match = orders.find((order) => mockTrackingCode(order.orderNumber) === code);
    return match ? sellerOrderHref(locale, match.orderNumber) : null;
  };
  const quickActions = [
    { key: "add", href: `${base}/products/new`, icon: PackagePlus, label: tApp("quickAddProduct"), hint: tApp("addProductHint"), tone: "teal" as const },
    { key: "share", href: `${base}#share`, icon: Share2, label: tApp("quickShareShop"), hint: tApp("shareShopHint"), tone: "amber" as const },
  ];
  // Mockup only: what the live app does when the dashboard hears of a new order.
  function simulateNewOrder() {
    const latest = orders[0];
    if (!latest) return;
    playNewOrderChime();
    setToast({ number: latest.orderNumber, total: formatMoney(latest.total, latest.currency), place: placeLabel(latest), href: sellerOrderHref(locale, latest.orderNumber) });
  }

  return (
    <div className={`${SELLER_PAGE} gap-5`}>
      {!profile.hasProfile && <div className="rounded-DEFAULT border border-dashed border-border p-3 text-sm text-muted">{t("noProfileYet")}</div>}
      <HomeTopBar firstName={mockMerchant.firstName} state={state} onSearch={() => setFindOpen(true)} codePrefix={trackingCodePrefix(mockStore.slug)} />
      <NeedsYouBanner count={needingAction.length} href={`${base}/orders`} />
      <QuickActions items={quickActions} />
      <SetupChecklist />
      <SalesOverview
        days={salesDays}
        top={topProducts}
        cashToCollect={sumByCurrency(orders.filter((order) => isCashOrder(order) && order.status !== "completed" && order.status !== "cancelled"))}
        mainCurrency={settings.defaultCurrency}
        sample
      />

      {orders.length === 0 ? (
        <Card className="p-4">
          <EmptyState art={<Mio size={96} />} title={t("firstOrderTitle")} body={t("firstOrderBody")} />
        </Card>
      ) : (
        <OrdersNeedingAction rows={rows} total={needingAction.length} allHref={`${base}/orders`} />
      )}
      <div id="share" className="scroll-mt-4">
        {shopLink}
      </div>

      <button type="button" onClick={simulateNewOrder} className="flex min-h-touch items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm font-medium text-muted hover:text-fg">
        <Bell className="h-4 w-4" aria-hidden="true" />
        {tApp("simulateNewOrder")}
      </button>

      <BottomSheet open={findOpen} onClose={() => setFindOpen(false)} closeLabel={tApp("close")} title={tApp("findOrder")}>
        <FindOrderPanel hrefFor={findHref} prefix={trackingCodePrefix(mockStore.slug)} />
      </BottomSheet>
      <NewOrderToast order={toast} onClose={closeToast} />
    </div>
  );
}
