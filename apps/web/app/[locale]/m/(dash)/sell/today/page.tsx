"use client";

import { currencySchema } from "@khmio/shared";
import { Button, ConfirmDialog, EmptyState, Notice, StatCard, StatusPill } from "@khmio/ui";
import { Banknote, ChevronRight, QrCode, ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/components/order-ui";
import { SubPage } from "@/components/seller-frame/sub-page";
import { useDateText } from "@/components/use-date-text";
import { api, apiSend, ApiError, type CounterDay, counterDaySchema } from "@/lib/api";
import { PageLoading, PageOffline } from "../../page-states";

type DaySale = CounterDay["sales"][number];

/** Dollars and riel are never added together: one figure per currency. */
function sumsText(sums: CounterDay["totals"]["all"]): string {
  const parts = currencySchema.options.filter((currency) => sums[currency] > 0).map((currency) => formatMoney(sums[currency], currency));
  return parts.length ? parts.join(" + ") : formatMoney(0, "USD");
}

// Today's sales at the counter (design/screens.md P4): totals by cash and shop
// QR, each sale with its receipt, and void for a mistake (the seller hands the
// money back).
export default function TodaySalesPage() {
  const t = useTranslations("Counter");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const { clockTime } = useDateText();
  const [day, setDay] = useState<CounterDay | null>(null);
  const [failed, setFailed] = useState(false);
  const [voiding, setVoiding] = useState<DaySale | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    api("/counter/sales/today", counterDaySchema).then(setDay, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  async function confirmVoid(sale: DaySale) {
    setVoiding(null);
    setProblem(null);
    try {
      await apiSend(`/counter/sales/${sale.id}/void`, { method: "POST" });
      load();
    } catch (failure) {
      setProblem(failure instanceof ApiError && failure.code === "store_paused" ? tApp("storePaused") : tApp("saveFailed"));
    }
  }

  if (failed) return <PageOffline onRetry={load} />;
  if (!day) return <PageLoading />;
  const base = `/${locale}/m/sell`;

  return (
    <SubPage back={{ href: base, label: t("title") }} title={t("todayTitle")}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={ReceiptText} label={t("statTotal", { count: day.totals.all.count })} value={sumsText(day.totals.all)} />
        <StatCard icon={Banknote} tone="success" label={t("statCash", { count: day.totals.cash.count })} value={sumsText(day.totals.cash)} />
        <StatCard icon={QrCode} tone="info" label={t("statQr", { count: day.totals.shopQr.count })} value={sumsText(day.totals.shopQr)} />
      </div>

      {problem && (
        <Notice tone="danger" role="alert">
          {problem}
        </Notice>
      )}

      {day.sales.length === 0 ? (
        <EmptyState icon={ReceiptText} title={t("todayEmpty")} action={<Link href={base} className="font-semibold text-brand">{t("startSelling")}</Link>} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-bg">
          {day.sales.map((sale) => (
            <li key={sale.id} className="flex items-center gap-2 p-2 pl-3">
              <Link href={`/${locale}/m/orders/${sale.id}/invoice`} className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={sale.voided ? "font-semibold line-through" : "font-semibold"}>#{sale.orderNumber}</span>
                    {sale.voided ? (
                      <StatusPill tone="danger">{t("voided")}</StatusPill>
                    ) : (
                      <StatusPill tone={sale.paymentMethod === "cash" ? "success" : "info"}>{sale.paymentMethod === "cash" ? t("methodCash") : t("methodQr")}</StatusPill>
                    )}
                  </span>
                  <span className="block text-xs text-muted">
                    {clockTime(sale.createdAt)} · {t("lineCount", { count: sale.lineCount })}
                    {sale.buyerName && ` · ${sale.buyerName}`}
                  </span>
                </span>
                <span className={sale.voided ? "font-semibold tabular-nums text-muted line-through" : "font-semibold tabular-nums"}>{formatMoney(sale.totalMinor, sale.currency)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
              {!sale.voided && (
                <Button variant="ghost" tone="danger" size="sm" onClick={() => setVoiding(sale)}>
                  {t("void")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={voiding !== null}
        title={t("voidTitle", { number: voiding ? `#${voiding.orderNumber}` : "" })}
        body={voiding ? t(voiding.paymentMethod === "cash" ? "voidBodyCash" : "voidBodyQr", { amount: formatMoney(voiding.totalMinor, voiding.currency) }) : ""}
        confirmLabel={t("voidConfirm")}
        cancelLabel={t("cancel")}
        danger
        onConfirm={() => voiding && void confirmVoid(voiding)}
        onClose={() => setVoiding(null)}
      />
    </SubPage>
  );
}
