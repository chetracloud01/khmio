"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { QuantityStepper } from "@/components/buyer/quantity-control";

export interface CounterCartLine {
  key: string;
  title: string;
  /** "Large", "Red" … */
  option?: string;
  quantity: number;
  /** As shown: "$3.00". */
  lineTotal: string;
}

export interface CounterCartTotals {
  subtotal: string;
  /** Shown only when there is one: "−$0.50". */
  discount?: string;
  /** Shown only when the shop charges VAT: "VAT 10%" and its amount. */
  vat?: { label: string; amount: string };
  total: string;
  /** The other currency, small: "≈ 41,000៛". */
  approx: string;
}

/**
 * The sale being rung up at the counter (design/screens.md P1): each line with
 * − n + (the − at 1 removes it), the totals, and `footer` (the Charge button).
 * The page owns the lines; amounts come in already written as money.
 */
export function CounterCart({
  lines,
  totals,
  onQuantity,
  footer,
}: {
  lines: CounterCartLine[];
  totals: CounterCartTotals;
  onQuantity: (key: string, quantity: number) => void;
  footer?: ReactNode;
}) {
  const t = useTranslations("Counter");

  return (
    <section className="flex flex-col gap-3">
      {lines.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">{t("cartEmpty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-bg">
          {lines.map((line) => (
            <li key={line.key} className="flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{line.title}</span>
                {line.option && <span className="block truncate text-xs text-muted">{line.option}</span>}
                <span className="block text-sm font-semibold tabular-nums">{line.lineTotal}</span>
              </span>
              <QuantityStepper
                quantity={line.quantity}
                binAtOne
                decreaseLabel={t("decrease", { title: line.title })}
                increaseLabel={t("increase", { title: line.title })}
                onDecrease={() => onQuantity(line.key, line.quantity - 1)}
                onIncrease={() => onQuantity(line.key, line.quantity + 1)}
                className="w-32 shrink-0"
              />
            </li>
          ))}
        </ul>
      )}

      <dl className="flex flex-col gap-1 rounded-2xl bg-border/20 p-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{t("subtotal")}</dt>
          <dd className="tabular-nums">{totals.subtotal}</dd>
        </div>
        {totals.discount && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t("discount")}</dt>
            <dd className="tabular-nums text-success">{totals.discount}</dd>
          </div>
        )}
        {totals.vat && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{totals.vat.label}</dt>
            <dd className="tabular-nums">{totals.vat.amount}</dd>
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-2">
          <dt className="font-semibold">{t("total")}</dt>
          <dd className="text-right">
            <span className="block text-xl font-bold tabular-nums">{totals.total}</span>
            <span className="block text-xs text-muted tabular-nums">{totals.approx}</span>
          </dd>
        </div>
      </dl>

      {footer}
    </section>
  );
}
