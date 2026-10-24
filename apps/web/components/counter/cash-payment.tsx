"use client";

import { cashChange, parseKhrInput, parseUsdInput, quickCashAmounts, type Currency } from "@khmio/shared";
import { cn, Input } from "@khmio/ui";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/components/order-ui";

/** What the seller typed as the cash received, in cents or riel; undefined while it doesn't read as money. */
export function parseCashReceived(text: string, currency: Currency): number | undefined {
  const amount = currency === "USD" ? parseUsdInput(text) : parseKhrInput(text);
  return amount === undefined || Number.isNaN(amount) ? undefined : amount;
}

/** The box's text for an amount, as the seller would type it. */
function cashText(amount: number, currency: Currency): string {
  return currency === "USD" ? (amount / 100).toFixed(2) : String(amount);
}

/**
 * Paying cash at the counter (design/screens.md P2): one-tap amounts the
 * buyer usually hands over, the amount received, and the change to give —
 * all in the sale's one currency. The page keeps the text.
 */
export function CashPayment({
  total,
  currency,
  receivedText,
  onReceivedText,
}: {
  total: number;
  currency: Currency;
  receivedText: string;
  onReceivedText: (text: string) => void;
}) {
  const t = useTranslations("Counter");
  const received = parseCashReceived(receivedText, currency);
  const change = received === undefined ? null : cashChange(total, received);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {quickCashAmounts(total, currency).map((amount) => {
          const chosen = received === amount;
          return (
            <button
              key={amount}
              type="button"
              aria-pressed={chosen}
              onClick={() => onReceivedText(cashText(amount, currency))}
              className={cn(
                "min-h-touch rounded-xl border px-2 text-sm font-semibold tabular-nums transition-colors",
                chosen ? "border-brand bg-brand text-on-brand" : "border-border bg-bg hover:border-brand/40",
              )}
            >
              {amount === total ? t("exactAmount") : formatMoney(amount, currency)}
            </button>
          );
        })}
      </div>
      <Input
        label={t("cashReceived")}
        prefix={currency === "USD" ? "$" : "៛"}
        inputMode={currency === "USD" ? "decimal" : "numeric"}
        value={receivedText}
        onChange={(event) => onReceivedText(event.target.value)}
        error={received !== undefined && change === null ? t("cashShort", { amount: formatMoney(total - received, currency) }) : undefined}
      />
      <div className={cn("flex items-baseline justify-between rounded-2xl p-4", change === null ? "bg-border/20" : "bg-success/10")}>
        <span className="text-sm font-medium">{t("changeDue")}</span>
        <span className={cn("text-2xl font-bold tabular-nums", change !== null && "text-success")}>{change === null ? "—" : formatMoney(change, currency)}</span>
      </div>
    </div>
  );
}
