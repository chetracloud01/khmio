"use client";

import { SHARE_REQUIREMENTS, type ShareRequirement } from "@khmio/shared";
import { Button, Card, cn } from "@khmio/ui";
import {
  BadgeCheck,
  Bell,
  Check,
  ChevronRight,
  ImagePlus,
  Lock,
  PackagePlus,
  Phone,
  Share2,
  ShoppingBag,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "../admin-context";
import { useMerchantAccount } from "../merchant-account-context";
import { useMerchantProfile } from "../merchant-profile-context";
import { useShopReadiness } from "../new-shop";
import { useOrders } from "../orders-context";
import { shareOrCopyLink } from "@/components/share-link";
import { useStorePayments } from "../store-settings-context";

interface SetupItem {
  key: string;
  icon: LucideIcon;
  title: string;
  hint?: string;
  /** Where the step is done. The last step (share) is done right here instead. */
  href?: string;
  done: boolean;
  /** Can't be done yet — shows a lock and the hint says why. */
  locked?: boolean;
}

const REQUIREMENT_ICON: Record<ShareRequirement, LucideIcon> = {
  products: PackagePlus,
  phone: Phone,
  delivery: Truck,
  payment: Wallet,
};

/**
 * What a new shop still needs after the 2-step onboarding. Steps 1–4 are what
 * a buyer needs before the link is shared (packages/shared shop-readiness.ts):
 * a product, the shop's phone, delivery, and a way to pay — cash on delivery
 * is enough, so a Bakong ID is never forced. Sharing unlocks when they're done.
 * Bakong, logo and verification sit underneath as extras.
 * Hidden once the seven steps are done.
 */
export function SetupChecklist() {
  const t = useTranslations("Dashboard");
  const tReady = useTranslations("Readiness");
  const locale = useLocale();
  const profile = useMerchantProfile();
  const { telegramLogin } = useMerchantAccount();
  const { demoKycStatus } = useAdmin();
  const { khqrReady } = useStorePayments();
  const { orders } = useOrders();
  const readiness = useShopReadiness();
  const [shareNote, setShareNote] = useState<"idle" | "manual">("idle");

  if (!profile.hasProfile) return null;

  const base = `/${locale}/mockup/dashboard`;
  const requirementHref: Record<ShareRequirement, string> = {
    products: `${base}/products/new`,
    phone: `${base}/profile#details`,
    delivery: `${base}/delivery`,
    payment: `${base}/profile#payments`,
  };
  const isService = profile.businessType === "service";
  const requirementHint: Partial<Record<ShareRequirement, string>> = {
    products: tReady("hint_products"),
    delivery: tReady(isService ? "hint_delivery_service" : "hint_delivery"),
    payment: tReady("hint_payment"),
  };
  /** A service shop is asked for "a service with a price" — no photo needed. */
  const requirementTitle = (requirement: ShareRequirement) =>
    tReady(requirement === "products" && isService ? "req_products_service" : `req_${requirement}`);

  const steps: SetupItem[] = [
    ...SHARE_REQUIREMENTS.map((requirement) => ({
      key: requirement,
      icon: REQUIREMENT_ICON[requirement],
      title: requirementTitle(requirement),
      hint: requirementHint[requirement],
      href: requirementHref[requirement],
      done: !readiness.missing.includes(requirement),
    })),
    {
      key: "alerts",
      icon: Bell,
      title: t("setupAlerts"),
      href: `${base}/profile#alerts`,
      done: !!telegramLogin || profile.telegramConnected,
    },
    {
      key: "testOrder",
      icon: ShoppingBag,
      title: t("setupTestOrder"),
      hint: t("setupTestOrderHint"),
      href: `/${locale}/mockup/storefront`,
      done: orders.some((order) => order.fromShop),
    },
    {
      key: "share",
      icon: Share2,
      title: t("setupShare"),
      hint: readiness.ready ? t("setupShareHint") : tReady("shareLocked"),
      done: profile.linkShared,
      locked: !readiness.ready,
    },
  ];
  const extras: SetupItem[] = [
    { key: "bakong", icon: Wallet, title: t("setupBakongExtra"), href: `${base}/profile#payments`, done: khqrReady },
    { key: "logo", icon: ImagePlus, title: t("setupLogo"), href: `${base}/profile`, done: !!profile.logoDataUrl },
    {
      key: "verify",
      icon: BadgeCheck,
      title: t("setupVerify"),
      href: `${base}/verification`,
      // Sent counts: the rest is the admin's turn.
      done: demoKycStatus === "pending" || demoKycStatus === "approved",
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;
  const nextKey = steps.find((step) => !step.done && !step.locked)?.key;
  const shopUrl = () => `${window.location.origin}/s/${profile.slug}`;

  async function handleShare() {
    const outcome = await shareOrCopyLink(profile.shopName, shopUrl());
    if (outcome === "shared" || outcome === "copied") profile.setLinkShared(true);
    if (outcome === "manual") setShareNote("manual");
  }

  function row(item: SetupItem, position: number | null) {
    const isNext = item.key === nextKey;
    const inactive = item.done || item.locked;
    const content = (
      <>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            item.done ? "bg-success/10 text-success" : isNext ? "bg-brand text-on-brand" : "bg-border/30 text-muted",
          )}
        >
          {item.done ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : item.locked ? (
            <Lock className="h-4 w-4" aria-hidden="true" />
          ) : position !== null ? (
            position
          ) : (
            <item.icon className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm font-medium", item.done && "text-muted line-through", item.locked && "text-muted")}>
            {item.title}
          </span>
          {item.hint && !item.done && <span className="block text-sm text-muted">{item.hint}</span>}
        </span>
        {!inactive && <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
      </>
    );
    const className = cn(
      "flex min-h-touch w-full items-center gap-3 rounded-DEFAULT px-2 py-2 text-left",
      inactive ? "pointer-events-none" : "hover:bg-border/10",
      isNext && "border border-brand/40 bg-brand/5",
    );
    return (
      <li key={item.key}>
        {item.href ? (
          <Link href={item.href} aria-disabled={inactive} className={className}>
            {content}
          </Link>
        ) : (
          <button type="button" onClick={handleShare} disabled={inactive} className={className}>
            {content}
          </button>
        )}
      </li>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t("setupTitle")}</h2>
        <span className="shrink-0 text-sm text-muted">{t("setupProgress", { done: doneCount, total: steps.length })}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-border/40" aria-hidden="true">
        <div
          className="h-full rounded-full bg-brand transition-all motion-reduce:transition-none"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <ol className="flex flex-col gap-1">{steps.map((step, index) => row(step, index + 1))}</ol>

      {shareNote === "manual" && !profile.linkShared && (
        <div className="flex flex-col gap-2 rounded-DEFAULT border border-border p-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">{t("setupShareManual")}</span>
            <input
              readOnly
              value={shopUrl()}
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-touch w-full rounded-DEFAULT border border-border bg-bg px-3 text-base text-fg"
            />
          </label>
          <Button variant="secondary" className="self-start" onClick={() => profile.setLinkShared(true)}>
            {t("setupShareDone")}
          </Button>
        </div>
      )}

      {extras.some((item) => !item.done) && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <h3 className="px-2 text-sm font-medium text-muted">{t("setupExtras")}</h3>
          <ul className="flex flex-col gap-1">{extras.map((item) => row(item, null))}</ul>
        </div>
      )}
    </Card>
  );
}
