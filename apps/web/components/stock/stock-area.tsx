"use client";

import { buttonVariants, PageHeader, SegmentedControl, type Tone } from "@khmio/ui";
import { Boxes, ClipboardCheck, Plus, ReceiptText, Truck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SELLER_PAGE } from "@/components/seller-frame/seller-frame";
import { api, type StockSummary, stockSummarySchema } from "@/lib/api";

/** The Stock area's pages, in the tab row's order: address under /m, icon, and words (messages "Stock"). */
const STOCK_TABS = [
  { key: "stock", path: "stock", icon: Boxes, label: "tabStock", description: "description" },
  { key: "purchases", path: "purchases", icon: ReceiptText, label: "tabPurchases", description: "tabPurchasesDescription" },
  { key: "suppliers", path: "suppliers", icon: Truck, label: "tabSuppliers", description: "tabSuppliersDescription" },
  { key: "count", path: "stock/count", icon: ClipboardCheck, label: "tabCount", description: "countDescription" },
] as const satisfies readonly { key: string; path: string; icon: LucideIcon; label: string; description: string }[];
export type StockTab = (typeof STOCK_TABS)[number]["key"];

/** Each tab's badge: what needs attention there (none on Count). */
function badgeOf(tab: StockTab, summary: StockSummary | null): { value: number; tone: Tone } | undefined {
  if (!summary) return undefined;
  if (tab === "stock") return { value: summary.toReorder, tone: "warning" };
  if (tab === "purchases") return { value: summary.unpaidBills, tone: summary.overdueBills > 0 ? "danger" : "warning" };
  if (tab === "suppliers") return { value: summary.suppliers, tone: "muted" };
  return undefined;
}

/**
 * Every Stock list page (design/screens.md S13), like Products and Orders: the
 * title, New bill top-right, and one row of underline tabs — Stock ·
 * Purchases · Suppliers · Count — each with its icon and what needs attention
 * there (to reorder, bills unpaid — red when one is overdue —, suppliers in
 * use; GET /stock/summary). The side menu's Stock stays lit on all.
 */
export function StockArea({ tab, writable, actions, children }: { tab: StockTab; /** A plan that follows stock: the buttons that write show. */ writable: boolean; /** The page's own buttons, before the main one. */ actions?: ReactNode; children: ReactNode }) {
  const t = useTranslations("Stock");
  const locale = useLocale();
  const router = useRouter();
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const href = (path: string) => `/${locale}/m/${path}`;
  const current = STOCK_TABS.find((entry) => entry.key === tab) ?? STOCK_TABS[0];

  // The badges only: without them the tabs still work.
  useEffect(() => {
    api("/stock/summary", stockSummarySchema).then(setSummary, () => setSummary(null));
  }, []);

  return (
    <div className={`${SELLER_PAGE} gap-4 pb-24 md:pb-6`}>
      <PageHeader
        title={t("title")}
        description={t(current.description)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {writable && (
              <Link href={href("purchases/new")} className={buttonVariants({ variant: "primary" })}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("newBill")}
              </Link>
            )}
          </div>
        }
      />
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <SegmentedControl
          look="underline"
          size="sm"
          label={t("title")}
          value={tab}
          onChange={(next) => {
            const target = STOCK_TABS.find((entry) => entry.key === next);
            if (target) router.push(href(target.path));
          }}
          options={STOCK_TABS.map((entry) => {
            const badge = badgeOf(entry.key, summary);
            return { value: entry.key, label: t(entry.label), icon: entry.icon, ...(badge ? { badge: { ...badge, label: t(`badge_${entry.key}`, { count: badge.value }) } } : {}) };
          })}
        />
      </div>
      {children}
    </div>
  );
}
