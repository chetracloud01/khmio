"use client";

import { IconBadge, Mio } from "@khmio/ui";
import { ChevronRight, PackageSearch, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BuyerShell } from "@/components/buyer-shell";
import { formatMoney, OrderStatusPill } from "@/components/order-ui";
import { api, type PublicOrder } from "@/lib/api";
import { forgetMyOrders, readMyOrders, type MyOrder } from "@/lib/my-orders";

/** Read fresh, newest first; the rest stay in the list for later. */
const SHOWN = 20;

// "My orders" without an account (2026-10-22 buyer review): every order this
// phone placed or opened, in any Khmio shop, with its status read fresh from
// its own link. The list lives on the phone only.
export default function MyOrdersPage() {
  const t = useTranslations("MyOrders");
  const locale = useLocale();
  const [saved, setSaved] = useState<MyOrder[] | null>(null);
  const [live, setLive] = useState<Record<string, PublicOrder | "gone">>({});

  useEffect(() => {
    const orders = readMyOrders();
    setSaved(orders);
    // Each order by its own link, all at once; one that can't be read (deleted, offline) just shows what was saved.
    for (const order of orders.slice(0, SHOWN)) {
      api<PublicOrder>(`/public/orders/${encodeURIComponent(order.token)}`)
        .then((found) => setLive((current) => ({ ...current, [order.token]: found })))
        .catch(() => setLive((current) => ({ ...current, [order.token]: "gone" })));
    }
  }, []);

  const tInvoice = useTranslations("Invoice");
  // Our own month names in Phnom Penh time (UTC+7), as on the invoice: the same on every phone.
  const dateLabel = (iso: string) => {
    const local = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
    return `${local.getUTCDate()} ${tInvoice(`month_${local.getUTCMonth() + 1}`)} ${local.getUTCFullYear()}`;
  };

  return (
    <BuyerShell className="gap-5 p-4 pt-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold leading-normal">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </header>

      {saved === null ? null : saved.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-bg p-8 text-center shadow-card">
          <Mio pose="face" size={80} />
          <p className="font-semibold">{t("emptyTitle")}</p>
          <p className="max-w-[32ch] text-sm text-muted">{t("emptyBody")}</p>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {saved.slice(0, SHOWN).map((entry) => {
            const order = live[entry.token];
            const found = order && order !== "gone" ? order : null;
            return (
              <li key={entry.token}>
                <Link
                  href={`/${locale}/o/${encodeURIComponent(entry.token)}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-3 shadow-card transition-colors hover:border-brand/40"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand/10 text-brand">
                    {found?.store.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- the shop's own uploaded logo
                      <img src={found.store.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-6 w-6" aria-hidden="true" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{entry.shopName}</span>
                      {found && <span className="shrink-0 font-semibold tabular-nums">{formatMoney(found.totalMinor, found.currency)}</span>}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="tabular-nums">
                        #{entry.orderNumber} · {dateLabel(entry.placedAt)}
                      </span>
                      {found ? <OrderStatusPill order={found} /> : order === "gone" ? <span>{t("unavailable")}</span> : null}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link href={`/${locale}/track`} className="flex min-h-[52px] items-center gap-3 rounded-full border border-border bg-bg pl-1.5 pr-4 shadow-card hover:border-brand/40">
        <IconBadge icon={PackageSearch} shape="circle" />
        <span className="min-w-0 flex-1 text-sm font-semibold">{t("trackAnother")}</span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
      </Link>

      {saved && saved.length > 0 && (
        <button
          type="button"
          onClick={() => {
            forgetMyOrders();
            setSaved([]);
          }}
          className="flex min-h-touch items-center justify-center text-sm font-medium text-muted hover:text-danger"
        >
          {t("clear")}
        </button>
      )}
    </BuyerShell>
  );
}
