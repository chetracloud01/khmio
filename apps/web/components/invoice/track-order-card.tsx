"use client";

import { ChevronRight, ListOrdered, PackageSearch } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readMyOrders } from "@/lib/my-orders";

/**
 * "Track my order" on a shop page (design/screens.md B1, B8): a slim pill in
 * the same style as the seller's find-order bar — white, rounded, teal icon —
 * so a returning buyer finds it next to the product search without it
 * looking like a second search box. One block for the live shop and its mockup.
 */
export function TrackOrderCard({ href }: { href: string }) {
  const t = useTranslations("Track");
  return (
    <Link
      href={href}
      className="group flex min-h-[52px] items-center gap-3 rounded-full border border-border bg-bg pl-1.5 pr-4 shadow-card transition-colors hover:border-brand/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        <PackageSearch className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold leading-normal">{t("title")}</span>
        <span className="truncate text-xs leading-normal text-muted">{t("cardHint")}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
    </Link>
  );
}

/**
 * The shop page's way back to earlier orders: "My orders" (this phone's orders)
 * and "Track order" side by side once the phone has ordered before; until
 * then, the single "Track my order" pill.
 */
export function BuyerOrderLinks({ myOrdersHref, trackHref }: { myOrdersHref: string; trackHref: string }) {
  const t = useTranslations("Track");
  const tOrders = useTranslations("MyOrders");
  const [count, setCount] = useState(0);
  useEffect(() => setCount(readMyOrders().length), []);
  if (count === 0) return <TrackOrderCard href={trackHref} />;
  const pill = "flex min-h-[52px] min-w-0 items-center gap-2 rounded-full border border-border bg-bg pl-1.5 pr-3 shadow-card transition-colors hover:border-brand/40";
  const icon = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand";
  return (
    <div className="grid grid-cols-[3fr_2fr] gap-2">
      <Link href={myOrdersHref} className={pill}>
        <span className={icon}>
          <ListOrdered className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tOrders("myOrders")}</span>
        <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand tabular-nums">{count}</span>
      </Link>
      <Link href={trackHref} className={pill}>
        <span className={icon}>
          <PackageSearch className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t("trackShort")}</span>
      </Link>
    </div>
  );
}
