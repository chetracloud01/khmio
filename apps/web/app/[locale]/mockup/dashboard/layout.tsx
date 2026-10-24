"use client";

import { needsSellerAction, planHasFeature } from "@khmio/shared";
import { Badge } from "@khmio/ui";
import {
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  Package,
  ScanLine,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Warehouse,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SellerFrame } from "@/components/seller-frame/seller-frame";
import { mockStore } from "@/mock/mock-data";
import { useAdmin } from "../admin-context";
import { AppSwitcher } from "../app-switcher";
import { useMerchantProfile } from "../merchant-profile-context";
import { useMerchantSubscription } from "../merchant-subscription-context";
import { useOrders } from "../orders-context";
import { useStorePayments, useStoreSettings } from "../store-settings-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("Dashboard");
  const tPlans = useTranslations("Plans");
  const { orders } = useOrders();
  const waiting = orders.filter((order) => needsSellerAction(order.status)).length;
  const locale = useLocale();
  const pathname = usePathname();
  const profile = useMerchantProfile();

  const shopName = profile.hasProfile ? profile.shopName : locale === "km" ? mockStore.nameKm : mockStore.nameEn;
  const logoDataUrl = profile.hasProfile ? profile.logoDataUrl : null;

  const billingHref = `/${locale}/mockup/dashboard/billing`;
  const profileHref = `/${locale}/mockup/dashboard/profile`;
  const verificationHref = `/${locale}/mockup/dashboard/verification`;
  const deliveryHref = `/${locale}/mockup/dashboard/delivery`;
  const { demoKycStatus } = useAdmin();

  // Delivery, Verification and Billing are sidebar-only: five tabs is
  // the most a 360px bottom bar holds. On phones they're reached from the
  // Profile page, and the Profile tab stays highlighted while you're there.
  const navItems = [
    { href: `/${locale}/mockup/dashboard`, label: t("navHome"), icon: LayoutDashboard, mobile: true },
    { href: `/${locale}/mockup/dashboard/products`, label: t("navProducts"), icon: Package, mobile: true },
    { href: `/${locale}/mockup/dashboard/stock`, label: t("navStock"), icon: Warehouse, mobile: true },
    { href: `/${locale}/mockup/dashboard/orders`, label: t("navOrders"), icon: ShoppingBag, mobile: true },
    { href: profileHref, label: t("navProfile"), icon: Store, mobile: true },
    { href: `/${locale}/mockup/dashboard/sell`, label: t("navSell"), icon: ScanLine, mobile: false },
    { href: deliveryHref, label: t("navDelivery"), icon: Truck, mobile: false },
    { href: verificationHref, label: t("navVerification"), icon: ShieldCheck, mobile: false },
    { href: billingHref, label: t("navBilling"), icon: CreditCard, mobile: false },
  ];

  const homeHref = `/${locale}/mockup/dashboard`;
  const reachedFromProfile = [billingHref, verificationHref, deliveryHref];

  const { hydrated: subscriptionReady, subscription } = useMerchantSubscription();
  const stockHref = `/${locale}/mockup/dashboard/stock`;
  const stockLocked = subscriptionReady && !planHasFeature(subscription.plan, "stock");
  const { khqrReady } = useStorePayments();
  const { settings: storeSettings } = useStoreSettings();
  const planBanner =
    subscriptionReady && !pathname.startsWith(billingHref)
      ? subscription.status === "trialing"
        ? { text: t("bannerTrial", { count: subscription.daysLeft }), action: t("bannerChoosePlan"), tone: "bg-brand/10 text-brand", href: billingHref, urgent: false }
        : subscription.status === "grace"
          ? { text: t("bannerGrace", { count: subscription.daysLeft }), action: t("bannerPayNow"), tone: "bg-warning/10 text-warning", href: billingHref, urgent: true }
          : subscription.status === "paused"
            ? { text: t("bannerPaused"), action: t("bannerReopen"), tone: "bg-danger/10 text-danger", href: billingHref, urgent: true }
            : null
      : null;
  // An overdue or paused plan matters most; next, a missing Bakong ID (buyers
  // can't pay); the trial reminder comes last.
  // A Bakong ID isn't required: with cash on delivery on, buyers can already pay.
  const paymentBanner =
    profile.hasProfile && !khqrReady && !storeSettings.allowCod && !pathname.startsWith(profileHref)
      ? { text: t("bannerNoPayment"), action: t("bannerAddBakong"), tone: "bg-warning/10 text-warning", href: `${profileHref}#payments`, urgent: true }
      : null;
  const banner = planBanner?.urgent ? planBanner : (paymentBanner ?? planBanner);

  const storefrontHref = `/${locale}/mockup/storefront`;
  const verification =
    demoKycStatus === "approved" ? t("verified") : demoKycStatus === "pending" ? t("verificationPending") : t("verifyShop");
  const planBox = subscriptionReady && (
    <Link href={billingHref} className="flex flex-col gap-0.5 rounded-DEFAULT border border-nav-border p-3 hover:bg-nav-fg/5">
      <span className="text-sm font-semibold text-nav-fg">{t("planLine", { plan: tPlans(subscription.plan) })}</span>
      <span className="text-xs text-nav-muted">
        {subscription.status === "trialing" ? t("statusTrial", { count: subscription.daysLeft }) : subscription.status === "paused" ? t("statusPaused") : subscription.status === "grace" ? t("statusDue") : t("statusOpen")}
      </span>
    </Link>
  );

  return (
    <SellerFrame
      look="teal"
      shopHref={storefrontHref}
      shop={{
        name: shopName,
        logoUrl: logoDataUrl,
        below:
          demoKycStatus === "approved" ? (
            <Badge className="truncate">{t("verified")}</Badge>
          ) : (
            <Link href={verificationHref} className="-my-2 flex min-h-touch items-center truncate text-sm font-medium text-warning underline-offset-2 hover:underline">
              {demoKycStatus === "pending" ? t("verificationPending") : t("verifyShop")}
            </Link>
          ),
        belowOnTeal: (
          <Link href={verificationHref} className="-my-2 flex min-h-touch items-center truncate text-xs font-medium text-nav-muted underline-offset-2 hover:text-nav-fg hover:underline">
            {verification}
          </Link>
        ),
      }}
      homeHref={homeHref}
      nav={navItems.map((item) => ({
        ...item,
        // Delivery, Store settings, Verification and Billing are reached from the Profile tab on a phone.
        alsoActiveOn: item.href === profileHref ? reachedFromProfile : undefined,
        locked: item.href === stockHref && stockLocked,
        lockedLabel: t("lockedOnPlan"),
        badge: item.href === `/${locale}/mockup/dashboard/orders` ? waiting : undefined,
      }))}
      sidebarFooter={planBox}
      topBarExtra={
        <>
          <Link
            href={storefrontHref}
            target="_blank"
            className="flex min-h-touch items-center gap-2 rounded-DEFAULT px-3 text-sm font-medium text-brand hover:bg-brand/5"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {t("actionViewShop")}
          </Link>
          <AppSwitcher current="shop" align="right" />
        </>
      }
      headerExtra={<AppSwitcher current="shop" align="right" />}
      banner={
        banner && (
          <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm font-medium ${banner.tone}`}>
            <span>{banner.text}</span>
            <Link href={banner.href} className="flex min-h-touch items-center underline underline-offset-2">
              {banner.action}
            </Link>
          </div>
        )
      }
    >
      {children}
    </SellerFrame>
  );
}
