"use client";

import { getMissingForSharing, SHARE_REQUIREMENTS, type ShareRequirement } from "@khmio/shared";
import { Card, cn, ProgressBar, TONE_STYLES } from "@khmio/ui";
import { Check, ChevronRight, ImagePlus, Lock, PackagePlus, Phone, Share2, Truck, Wallet, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useMerchant } from "./merchant-context";
import { useShareShop } from "./share-shop";

interface SetupItem {
  key: string;
  icon: LucideIcon;
  title: string;
  hint?: string;
  /** Where the step is done; none = its page comes in a later roadmap step. */
  href?: string;
  /** Opens something on the page instead of going to one (the Share sheet). */
  onClick?: () => void;
  done: boolean;
  locked?: boolean;
}

const REQUIREMENT_ICON: Record<ShareRequirement, LucideIcon> = {
  products: PackagePlus,
  phone: Phone,
  delivery: Truck,
  payment: Wallet,
};

/**
 * What the shop still needs before its link is shared — the same rule as the
 * checklist (packages/shared shop-readiness.ts), from the real shop's
 * facts. Delivery settings and sharing arrive in later roadmap steps, so
 * those rows say so instead of linking to a page that doesn't save yet.
 */
export function SetupChecklist() {
  const t = useTranslations("Dashboard");
  const tReady = useTranslations("Readiness");
  const locale = useLocale();
  const { store } = useMerchant();
  const shareShop = useShareShop();
  const missing = getMissingForSharing({
    businessType: store.businessType,
    shopPhone: store.phone,
    ...store.readiness,
  });
  const ready = missing.length === 0;
  const isService = store.businessType === "service";
  const base = `/${locale}/m`;

  const requirementHref: Partial<Record<ShareRequirement, string>> = {
    products: `${base}/products/new`,
    phone: `${base}/shop-details#details`,
    delivery: `${base}/delivery`,
    payment: `${base}/shop-details#payments`,
  };
  const requirementHint: Record<ShareRequirement, string | undefined> = {
    products: tReady("hint_products"),
    phone: undefined,
    delivery: tReady(isService ? "hint_delivery_service" : "hint_delivery"),
    payment: tReady("hint_payment"),
  };
  const steps: SetupItem[] = [
    ...SHARE_REQUIREMENTS.map((requirement) => ({
      key: requirement,
      icon: REQUIREMENT_ICON[requirement],
      title: tReady(requirement === "products" && isService ? "req_products_service" : `req_${requirement}`),
      hint: requirementHint[requirement],
      href: requirementHref[requirement],
      done: !missing.includes(requirement),
    })),
    // Unlocks once the four steps above are done; done when the link was copied, shared or its QR downloaded.
    {
      key: "share",
      icon: Share2,
      title: t("setupShare"),
      hint: ready ? t("setupShareHint") : tReady("shareLocked"),
      onClick: ready ? shareShop.open : undefined,
      done: store.linkShared,
      locked: !ready,
    },
  ];
  const extras: SetupItem[] = [
    {
      key: "bakong",
      icon: Wallet,
      title: t("setupBakongExtra"),
      href: `${base}/shop-details#payments`,
      done: store.readiness.khqrReady,
    },
    {
      key: "logo",
      icon: ImagePlus,
      title: t("setupLogo"),
      href: `${base}/shop-details#details`,
      done: !!store.logoUrl,
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  // Every step done: the checklist has done its job and goes away (Share stays in the header).
  if (doneCount === steps.length) return null;
  const nextKey = steps.find((step) => !step.done && !step.locked && (step.href || step.onClick))?.key;

  function row(item: SetupItem, position: number | null) {
    const isNext = item.key === nextKey;
    const inactive = item.done || item.locked || !(item.href || item.onClick);
    const content = (
      <>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            item.done ? TONE_STYLES.success : isNext ? "bg-brand text-on-brand" : TONE_STYLES.muted,
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
          <span className={cn("block text-sm font-medium", item.done && "text-muted line-through", inactive && !item.done && "text-muted")}>
            {item.title}
          </span>
          {item.hint && !item.done && <span className="block text-sm text-muted">{item.hint}</span>}
        </span>
        {!inactive && <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
      </>
    );
    const className = cn(
      "flex min-h-touch w-full items-center gap-3 rounded-DEFAULT px-2 py-2 text-left",
      !inactive && "hover:bg-border/10",
      isNext && "border border-brand/40 bg-brand/5",
    );
    return (
      <li key={item.key}>
        {item.href && !inactive ? (
          <Link href={item.href} className={className}>
            {content}
          </Link>
        ) : item.onClick && !inactive ? (
          // eslint-disable-next-line no-restricted-syntax -- a checklist row: the same row look as the Link beside it, so it can't be a kit Button
          <button type="button" onClick={item.onClick} className={className}>
            {content}
          </button>
        ) : (
          <div className={className}>{content}</div>
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
      <ProgressBar value={doneCount} max={steps.length} label={t("setupProgress", { done: doneCount, total: steps.length })} />
      <ol className="flex flex-col gap-1">{steps.map((step, index) => row(step, index + 1))}</ol>
      {extras.some((item) => !item.done) && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <h3 className="px-2 text-sm font-medium text-muted">{t("setupExtras")}</h3>
          <ul className="flex flex-col gap-1">{extras.map((item) => row(item, null))}</ul>
        </div>
      )}
    </Card>
  );
}
