"use client";

import { Card, cn, ProgressBar, TONE_STYLES, type Tone } from "@khmio/ui";
import { Clock3, PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/components/order-ui";
import { useDateText } from "@/components/use-date-text";
import type { PurchaseDetail } from "@/lib/api";
import { PAYMENT_STATE_TONES, PaymentStatePill } from "./payment-ui";
import { usePurchaseText } from "./use-purchase-text";

/** One of the card's two answers: an icon in its tone, a title and a line under it. */
function Standing({ icon: Icon, tone, title, detail }: { icon: typeof Clock3; tone: Tone; title: string; detail: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", TONE_STYLES[tone])} aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted">{detail}</span>
      </span>
    </div>
  );
}

/**
 * The top of a bill's page (design/screens.md S13 "Bill"): the two things a
 * shop asks of a bill — have the goods arrived, and is it paid — then how
 * much is paid of what it owes, as a bar, with what's left and when it's due.
 */
export function BillStatusCard({ purchase }: { purchase: PurchaseDetail }) {
  const t = useTranslations("Purchases");
  const { dateTime } = useDateText();
  const { billDay } = usePurchaseText();
  const payment = purchase.payment;
  const received = purchase.receivedAt !== null;
  const money = (amount: number) => formatMoney(amount, purchase.currency);
  // What the bill comes to after its returns: what paying it off means.
  const due = purchase.totalMinor - (payment?.returned ?? 0);

  return (
    <Card className="flex flex-col gap-4 p-4 md:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Standing
          icon={received ? PackageCheck : Clock3}
          tone={received ? "success" : "warning"}
          title={t(received ? "goodsReceived" : "goodsWaiting")}
          detail={purchase.receivedAt ? dateTime(purchase.receivedAt) : t("goodsWaitingHint")}
        />
        {payment && (
          <div className="flex min-w-0 items-center gap-3">
            <PaymentStatePill state={payment.state} />
            <span className="truncate text-xs text-muted">{purchase.dueOn && payment.owed > 0 ? t("dueOnText", { day: billDay(purchase.dueOn) }) : t("lineCount", { count: purchase.lineCount })}</span>
          </div>
        )}
      </div>
      {payment && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm text-muted">{t("paidOf", { paid: money(payment.paid), total: money(due) })}</p>
            <p className={cn("text-2xl font-bold tabular-nums", payment.owed > 0 ? (payment.state === "overdue" ? "text-danger" : "text-warning") : "text-success")}>
              {payment.owed > 0 ? t("leftToPay", { amount: money(payment.owed) }) : payment.owed < 0 ? t("supplierOwesShort", { amount: money(-payment.owed) }) : t("paidInFull")}
            </p>
          </div>
          <ProgressBar value={payment.paid} max={due} tone={PAYMENT_STATE_TONES[payment.state]} label={t("paidOf", { paid: money(payment.paid), total: money(due) })} />
          {payment.returned > 0 && <p className="text-xs text-muted">{t("sentBackShort", { amount: money(payment.returned) })}</p>}
        </div>
      )}
    </Card>
  );
}
