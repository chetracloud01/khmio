"use client";

import { changePercent, marginPercent, parseTrackingCode, planHasFeature, trackingCodePrefix, type Currency, type DashboardPeriod, getMinimumPlanFor } from "@khmio/shared";
import { BottomSheet, Card, EmptyState, Mio, SegmentedControl, Skeleton } from "@khmio/ui";
import { Bell, Boxes, Coins, Globe, HandCoins, Percent, ReceiptText, ScanLine, ShoppingBag, ShoppingCart, Store, TrendingUp, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import { BestSellersCard } from "@/components/dashboard/best-sellers-card";
import { KpiLink } from "@/components/dashboard/kpi-link";
import { LatestOrdersCard } from "@/components/dashboard/latest-orders-card";
import { NeedsYouStrip, type NeedsYouItem } from "@/components/dashboard/needs-you-strip";
import { ProfitSnapshotCard } from "@/components/dashboard/profit-snapshot-card";
import { SalesMixCard } from "@/components/dashboard/sales-mix-card";
import { SalesTrendCard } from "@/components/dashboard/sales-trend-card";
import { ChangeText } from "@/components/home/chart-parts";
import { PayablesCard } from "@/components/home/payables-card";
import { ReportLinks } from "@/components/reports/report-links";
import { chartAmount, moneyLines } from "@/components/reports/report-money";
import { FindOrderPanel } from "@/components/seller-cards";
import { SELLER_PAGE } from "@/components/seller-frame/seller-frame";
import { HomeTopBar, QuickActions } from "@/components/seller-app";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { api, type Dashboard, dashboardSchema, type PayablesReport, payablesReportSchema, type SellerOrder, sellerOrderSchema } from "@/lib/api";
import { listAddress } from "@/lib/list-address";
import { shopStateOf, useMerchant } from "./merchant-context";
import { SetupChecklist } from "./setup-checklist";

type Money = Record<Currency, number>;

/** The periods the dashboard offers, in order (each is also a report period). */
const PERIODS = ["today", "week", "month"] as const satisfies readonly DashboardPeriod[];
const PERIOD_LABEL = { today: "periodToday", week: "periodWeek", month: "periodMonth" } as const;

// The seller's dashboard (design/screens.md S3): what needs the seller now,
// Sell in shop, then one period — today, 7 or 30 days — summed up beside the
// period before: six headline figures, the sales trend, where sales came
// from, the profit in five lines (Pro), the best sellers, the bills (plans
// with stock), the newest orders, and every report one tap away. Each block
// opens the report behind it. From GET /dashboard (the reports' own sums),
// GET /orders/summary (kept fresh by the dashboard layout every minute: what's
// waiting, cash to collect), GET /purchases/report (the bills card) and
// GET /orders (the newest orders, and "Find order by code").
export default function MerchantHomePage() {
  const t = useTranslations("HomeDashboard");
  const tDash = useTranslations("Dashboard");
  const tApp = useTranslations("SellerApp");
  const locale = useLocale();
  const { me, store, summary } = useMerchant();
  const [orders, setOrders] = useState<SellerOrder[] | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [payables, setPayables] = useState<PayablesReport | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const showsProfit = planHasFeature(store.plan, "profitReport");
  const showsStock = planHasFeature(store.plan, "stock");
  const main = store.defaultCurrency;
  const rate = store.usdToKhrRate;

  const loadOrders = useCallback(() => {
    api("/orders", z.array(sellerOrderSchema)).then(setOrders, () => setOrders((previous) => previous ?? []));
  }, []);
  // Again whenever the layout's minute refresh sees the waiting count change.
  const waiting = summary?.waiting ?? 0;
  useEffect(loadOrders, [loadOrders, waiting]);
  useEffect(() => {
    api(`/dashboard?period=${period}`, dashboardSchema).then(setDashboard, () => setDashboard(null));
  }, [period, waiting]);
  // The bills card only: without it the dashboard still works.
  useEffect(() => {
    if (showsStock) api("/purchases/report", payablesReportSchema).then(setPayables, () => setPayables(null));
  }, [showsStock]);

  const base = `/${locale}/m`;
  const header = <HomeTopBar firstName={me.merchant.firstName} state={shopStateOf(me, store)} onSearch={() => setFindOpen(true)} codePrefix={trackingCodePrefix(store.slug)} />;

  if (!summary || !orders) {
    return (
      <div className={`${SELLER_PAGE} gap-5`} aria-busy="true">
        {header}
        <Skeleton className="h-20" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const money = (value: Money, sign = false) => moneyLines(value, main, null, rate, sign);
  const inMain = (value: Money) => chartAmount(value, main, main, rate);
  const reportHref = (report: string, view?: { chip: string }) => `${base}/reports/${report}?${new URLSearchParams({ period, ...(view ? Object.fromEntries(new URLSearchParams(listAddress("", view))) : {}) }).toString()}`;
  const needsYou: NeedsYouItem[] = [
    { key: "orders", icon: Bell, tone: "warning", text: t("ordersToHandle", { count: summary.waiting }), href: `${base}/orders`, show: summary.waiting > 0 },
    { key: "cash", icon: HandCoins, tone: "info", text: t("cashToCollect", { amount: money(summary.cashToCollect).main }), href: `${base}/reports/sales?${listAddress("", { chip: "collect" })}`, show: summary.cashToCollect.USD + summary.cashToCollect.KHR > 0 },
    { key: "reorder", icon: ShoppingCart, tone: "warning", text: t("toReorder", { count: dashboard?.stock?.toReorder ?? 0 }), href: `${base}/stock?${listAddress("", { chip: "reorder" })}`, show: (dashboard?.stock?.toReorder ?? 0) > 0 },
    { key: "bills", icon: ReceiptText, tone: "danger", text: t("billsOverdue", { count: dashboard?.stock?.overdueBills ?? 0 }), href: `${base}/purchases?${listAddress("", { filter: { key: "payment", value: "overdue" } })}`, show: (dashboard?.stock?.overdueBills ?? 0) > 0 },
  ];

  return (
    <div className={`${SELLER_PAGE} gap-5`}>
      {header}
      <NeedsYouStrip title={t("needsYouTitle")} items={needsYou} allClear={tApp("allCaughtUp")} />
      <QuickActions items={[{ key: "sell", href: `${base}/sell`, icon: ScanLine, label: tApp("quickSell"), hint: tApp("quickSellHint"), tone: "teal" }]} />
      <SetupChecklist />

      {orders.length === 0 ? (
        <Card className="p-4">
          <EmptyState art={<Mio size={96} />} title={tDash("firstOrderTitle")} body={tDash("firstOrderBody")} />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{t("title")}</h2>
              <p className="text-sm text-muted">{t(`compare_${period}`)}</p>
            </div>
            <SegmentedControl size="sm" label={t("title")} value={period} onChange={setPeriod} options={PERIODS.map((value) => ({ value, label: tApp(PERIOD_LABEL[value]) }))} />
          </div>
          {dashboard ? (
            <DashboardBody
              dashboard={dashboard}
              base={base}
              reportHref={reportHref}
              money={money}
              inMain={inMain}
              compare={t(`compare_${period}`)}
              previousLabel={t(`previous_${period}`)}
              mainCurrency={main}
              rate={rate}
              locked={{ profit: showsProfit ? null : getMinimumPlanFor("profitReport"), stock: showsStock ? null : getMinimumPlanFor("stock") }}
              bills={showsStock ? payables ? <PayablesCard report={payables} mainCurrency={main} href={`${base}/reports/payables`} /> : <Skeleton className="h-96" /> : null}
              orders={orders}
            />
          ) : (
            <Skeleton className="h-96" />
          )}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted">{t("reportsTitle")}</h2>
            <ReportLinks base={base} plan={store.plan} variant="compact" />
          </section>
        </>
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

/** The period's figures and blocks; what the plan doesn't have shows what it comes with. */
function DashboardBody({
  dashboard,
  base,
  reportHref,
  money,
  inMain,
  compare,
  previousLabel,
  mainCurrency,
  rate,
  locked,
  bills,
  orders,
}: {
  dashboard: Dashboard;
  base: string;
  reportHref: (report: string, view?: { chip: string }) => string;
  money: (value: Money, sign?: boolean) => { main: string; other: string | null };
  inMain: (value: Money) => number;
  compare: string;
  previousLabel: string;
  mainCurrency: Currency;
  rate: number;
  locked: { profit: ReturnType<typeof getMinimumPlanFor> | null; stock: ReturnType<typeof getMinimumPlanFor> | null };
  bills: ReactNode;
  orders: readonly SellerOrder[];
}) {
  const t = useTranslations("HomeDashboard");
  const { now, before } = dashboard.sales;
  const change = (current: number, previous: number, text?: string) => (
    <>
      <ChangeText percent={changePercent(current, previous)} newLabel={current > 0 ? t("new") : undefined} text={text} />
      <span>{compare}</span>
    </>
  );
  const salesSpark = dashboard.sales.points.map((point) => inMain(point.shop) + inMain(point.online));
  const share = (part: Money) => (inMain(now.sales) > 0 ? t("share", { value: Math.round((inMain(part) / inMain(now.sales)) * 100) }) : undefined);
  const { profit, stock } = dashboard;
  const marginOf = (figures: NonNullable<Dashboard["profit"]>["now"]) => marginPercent(inMain(figures.costedGoods) - inMain(figures.cost), inMain(figures.costedGoods));
  const marginNow = profit ? marginOf(profit.now) : null;
  const marginBefore = profit ? marginOf(profit.before) : null;
  const marginChange = marginNow !== null && marginBefore !== null ? marginNow - marginBefore : null;

  const kpis: { key: string; icon: LucideIcon; label: string; value: string; sub?: string; change?: ReactNode; spark?: readonly number[]; href: string }[] = [
    { key: "sales", icon: ShoppingBag, label: t("kpiSales"), value: money(now.sales).main, sub: money(now.sales).other ?? undefined, change: change(inMain(now.sales), inMain(before.sales)), spark: salesSpark, href: reportHref("sales") },
    { key: "orders", icon: Bell, label: t("kpiOrders"), value: String(now.orders), sub: now.bookings > 0 ? t("bookings", { count: now.bookings }) : undefined, change: change(now.orders, before.orders), spark: dashboard.sales.points.map((point) => point.orders), href: reportHref("sales") },
    { key: "average", icon: ReceiptText, label: t("kpiAverage"), value: money(now.average).main, sub: money(now.average).other ?? undefined, change: change(inMain(now.average), inMain(before.average)), href: reportHref("sales") },
    ...(profit
      ? [
          { key: "gross", icon: TrendingUp, label: t("kpiGrossProfit"), value: money(profit.now.grossProfit).main, sub: money(profit.now.grossProfit).other ?? undefined, change: change(inMain(profit.now.grossProfit), inMain(profit.before.grossProfit)), spark: profit.points.map((point) => inMain(point.profit)), href: reportHref("profit") },
          {
            key: "margin",
            icon: Percent,
            label: t("kpiMargin"),
            value: marginNow === null ? "—" : t("percent", { value: marginNow }),
            // Sales without a cost price aren't in the margin: say so.
            sub: profit.now.missingCostSales.USD + profit.now.missingCostSales.KHR > 0 ? t("marginKnownOnly") : undefined,
            change: marginChange === null ? undefined : (
              <>
                <ChangeText percent={marginChange} text={t("points", { value: Math.abs(marginChange) })} />
                <span>{compare}</span>
              </>
            ),
            href: reportHref("profit"),
          },
        ]
      : [
          { key: "shop", icon: Store, label: t("inShop"), value: money(now.shop).main, sub: share(now.shop), change: change(inMain(now.shop), inMain(before.shop)), href: reportHref("sales", { chip: "shop" }) },
          { key: "online", icon: Globe, label: t("online"), value: money(now.online).main, sub: share(now.online), change: change(inMain(now.online), inMain(before.online)), href: reportHref("sales", { chip: "online" }) },
        ]),
    stock
      ? { key: "stock", icon: Boxes, label: t("kpiStock"), value: money(stock.value).main, sub: stock.toReorder > 0 ? t("toReorderShort", { count: stock.toReorder }) : (money(stock.value).other ?? undefined), href: `${base}/reports/stock` }
      : { key: "collect", icon: Coins, label: t("kpiToCollect"), value: money(dashboard.sales.toCollect.money).main, sub: t("orders", { count: dashboard.sales.toCollect.orders }), href: reportHref("sales", { chip: "collect" }) },
  ];

  return (
    <>
      <nav aria-label={t("title")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <KpiLink key={kpi.key} href={kpi.href} icon={kpi.icon} label={kpi.label} value={kpi.value} sub={kpi.sub} change={kpi.change} spark={kpi.spark && kpi.spark.length > 1 ? { values: kpi.spark, label: t("trendOf", { name: kpi.label }) } : undefined} />
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesTrendCard dashboard={dashboard} mainCurrency={mainCurrency} rate={rate} previousLabel={previousLabel} href={reportHref("sales")} />
        </div>
        <SalesMixCard dashboard={dashboard} mainCurrency={mainCurrency} rate={rate} href={reportHref("sales")} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {profit ? (
          <ProfitSnapshotCard profit={profit} mainCurrency={mainCurrency} rate={rate} href={reportHref("profit")} addCostsHref={`${base}/products`} />
        ) : (
          locked.profit && <UpgradePrompt title={t("lockedProfitTitle")} body={t("lockedProfitBody")} plan={locked.profit} />
        )}
        <BestSellersCard products={dashboard.sales.products} mainCurrency={mainCurrency} rate={rate} href={reportHref("sales")} productHref={(productId) => `${base}/products/${productId}`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {bills ?? (locked.stock && <UpgradePrompt title={t("lockedStockTitle")} body={t("lockedStockBody")} plan={locked.stock} />)}
        <LatestOrdersCard orders={orders} href={`${base}/orders`} orderHref={(orderId) => `${base}/orders/${orderId}`} />
      </div>
    </>
  );
}
