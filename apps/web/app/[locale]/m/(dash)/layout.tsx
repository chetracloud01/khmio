"use client";

import { ExternalLink, LayoutDashboard, Package, ShoppingBag, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SellerFrame } from "@/components/seller-frame/seller-frame";
import { formatMoney, useOrderText } from "@/components/order-ui";
import { NewOrderToast, playNewOrderChime, useServiceWorker } from "@/components/seller-app";
import { api, getMe, type Me, type SellerOrder, type SellerSummary, type StoreDetails } from "@/lib/api";
import { AppLoading, AppOffline } from "../app-frame";
import { MerchantContext, shopStateOf } from "./merchant-context";

// The real dashboard (roadmap step 3): every signed-in page sits in this
// frame. It reads who is signed in and their shop once, sends anyone without
// a session to login and anyone without a shop to onboarding, and gives the
// pages the shop through useMerchant().
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<{ me: Me; store: StoreDetails } | null>(null);
  const [state, setState] = useState<"checking" | "ready" | "offline">("checking");

  const load = useCallback(() => {
    setState("checking");
    getMe()
      .then(async (me) => {
        if (!me) return router.replace(`/${locale}/m/login`);
        if (!me.store) return router.replace(`/${locale}/m/onboarding`);
        setData({ me, store: await api<StoreDetails>("/store") });
        setState("ready");
      })
      .catch(() => setState("offline"));
  }, [locale, router]);
  useEffect(load, [load]);

  const refreshStore = useCallback(async () => {
    const store = await api<StoreDetails>("/store");
    setData((previous) => (previous ? { ...previous, store } : previous));
  }, []);

  // The home page's numbers and the Orders badge: once ready, then every 30 seconds (a missed refresh keeps the last numbers).
  const [summary, setSummary] = useState<SellerSummary | null>(null);
  const refreshSummary = useCallback(async () => {
    await api<SellerSummary>("/orders/summary").then(setSummary, () => undefined);
  }, []);
  useEffect(() => {
    if (state !== "ready") return;
    void refreshSummary();
    const timer = window.setInterval(() => void refreshSummary(), 30_000);
    return () => window.clearInterval(timer);
  }, [state, refreshSummary]);

  useServiceWorker();
  const newOrder = useNewOrderAlert(summary, `/${locale}/m`);

  if (state === "offline") return <AppOffline onRetry={load} />;
  if (state === "checking" || !data) return <AppLoading />;
  return (
    <MerchantContext.Provider value={{ ...data, refreshStore, summary, refreshSummary }}>
      <DashboardFrame me={data.me} store={data.store} waiting={summary?.waiting ?? 0}>
        {children}
        <NewOrderToast order={newOrder.toast} onClose={newOrder.close} />
      </DashboardFrame>
    </MerchantContext.Provider>
  );
}

/**
 * A popup and a chime when a new order comes in while the dashboard is open
 * (2026-10-22 seller review). The numbers refresh every 30 seconds; when the
 * waiting count goes up, the newest orders are read and the first one not
 * seen yet is shown. Phone notifications with the app closed come later.
 */
function useNewOrderAlert(summary: SellerSummary | null, base: string) {
  const { placeLabel } = useOrderText();
  const [toast, setToast] = useState<{ number: string; total: string; place: string; href: string } | null>(null);
  const lastWaiting = useRef<number | null>(null);
  const lastSeenAt = useRef<string | null>(null);
  useEffect(() => {
    if (!summary) return;
    const before = lastWaiting.current;
    lastWaiting.current = summary.waiting;
    const readOrders = () => api<SellerOrder[]>("/orders").catch(() => [] as SellerOrder[]);
    // First numbers: remember the newest order, so only later ones pop up.
    if (before === null) {
      void readOrders().then((orders) => {
        lastSeenAt.current = orders[0]?.createdAt ?? new Date().toISOString();
      });
      return;
    }
    if (summary.waiting <= before) return;
    void readOrders().then((orders) => {
      const fresh = orders.filter((order) => !lastSeenAt.current || order.createdAt > lastSeenAt.current);
      const newest = fresh[0];
      if (!newest) return;
      lastSeenAt.current = newest.createdAt;
      playNewOrderChime();
      setToast({ number: String(newest.orderNumber), total: formatMoney(newest.totalMinor, newest.currency), place: placeLabel(newest), href: `${base}/orders/${newest.id}` });
    });
  }, [summary, base, placeLabel]);
  const close = useCallback(() => setToast(null), []);
  return { toast, close };
}

/**
 * The shared seller frame (components/seller-frame) in its Deep Khmio Teal
 * look, with the live dashboard's sections: the Orders count, the plan in a
 * box at the bottom of the sidebar, and "View my shop" in the laptop's top bar.
 */
function DashboardFrame({ me, store, waiting, children }: { me: Me; store: StoreDetails; waiting: number; children: ReactNode }) {
  const t = useTranslations("App");
  const tDash = useTranslations("Dashboard");
  const tPlans = useTranslations("Plans");
  const locale = useLocale();
  const base = `/${locale}/m`;
  const shopPath = `/s/${store.slug}`;
  // The product form fills the phone: no bottom tabs while adding or editing a product.
  const editingProduct = /\/m\/products\/[^/]+$/.test(usePathname());
  const state = shopStateOf(me, store);
  const stateLabel =
    state.kind === "paused" ? tDash("statusPaused") : state.kind === "due" ? tDash("statusDue") : state.kind === "trial" ? tDash("statusTrial", { count: state.daysLeft }) : tDash("statusOpen");
  return (
    <SellerFrame
      look="teal"
      hideMobileNav={editingProduct}
      shop={{
        name: store.name,
        logoUrl: store.logoUrl,
        belowOnTeal: <span className="block truncate text-xs text-nav-muted">{shopPath}</span>,
      }}
      homeHref={base}
      sidebarFooter={
        <div className="flex flex-col gap-0.5 rounded-DEFAULT border border-nav-border p-3">
          <span className="text-sm font-semibold text-nav-fg">{tDash("planLine", { plan: tPlans(store.plan) })}</span>
          <span className="text-xs text-nav-muted">{stateLabel}</span>
        </div>
      }
      topBarExtra={
        <Link href={`/${locale}${shopPath}`} target="_blank" className="flex min-h-touch items-center gap-2 rounded-DEFAULT px-3 text-sm font-medium text-brand hover:bg-brand/5">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {tDash("actionViewShop")}
        </Link>
      }
      nav={[
        { href: base, label: tDash("navHome"), icon: LayoutDashboard, mobile: true },
        { href: `${base}/products`, label: tDash("navProducts"), icon: Package, mobile: true },
        { href: `${base}/orders`, label: tDash("navOrders"), icon: ShoppingBag, mobile: true, badge: waiting },
        // The same four on a laptop and a phone: delivery, store settings, invoices and Telegram alerts are reached from "My shop", which stays lit there.
        { href: `${base}/settings`, label: t("navShop"), icon: Store, mobile: true, alsoActiveOn: [`${base}/delivery`, `${base}/store-settings`, `${base}/invoice-settings`, `${base}/telegram-alerts`] },
      ]}
      banner={store.paused && <p className="bg-danger/10 px-4 py-2 text-sm font-medium text-danger">{tDash("bannerPaused")}</p>}
    >
      {children}
    </SellerFrame>
  );
}
