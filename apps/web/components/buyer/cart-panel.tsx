"use client";

import { Button } from "@khmio/ui";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";

export interface CartPanelLine {
  key: string;
  name: string;
  qty: number;
  /** The line's amount, already formatted in the buyer's currency. */
  amount: string;
}

/**
 * The shop page's cart on a laptop (from 1024 px): what's in it, the goods
 * total and Checkout, beside the products — the phone gets the floating cart
 * bar instead. One block for the live shop and its mockup; words come in as props.
 */
export function CartPanel({
  title,
  lines,
  totalLabel,
  total,
  otherTotal,
  checkoutHref,
  checkoutLabel,
  emptyText,
}: {
  title: string;
  lines: CartPanelLine[];
  totalLabel: string;
  total: string;
  /** "≈ 30,750៛": the other currency, small. */
  otherTotal?: string;
  checkoutHref: string;
  checkoutLabel: string;
  emptyText: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <ShoppingBag className="h-5 w-5 text-brand" aria-hidden="true" />
        {title}
      </h2>
      {lines.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{emptyText}</p>
      ) : (
        <>
          <ul className="flex max-h-[45vh] flex-col divide-y divide-border overflow-y-auto">
            {lines.map((line) => (
              <li key={line.key} className="flex items-start gap-3 py-2 text-sm">
                <span className="shrink-0 font-semibold tabular-nums text-brand">{line.qty}×</span>
                <span className="min-w-0 flex-1 leading-normal">{line.name}</span>
                <span className="shrink-0 font-medium tabular-nums">{line.amount}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="font-semibold">{totalLabel}</span>
            <span className="text-right">
              <span className="block text-lg font-bold tabular-nums">{total}</span>
              {otherTotal && <span className="block text-xs text-muted">{otherTotal}</span>}
            </span>
          </div>
          <Link href={checkoutHref} className="block">
            <Button variant="primary" className="w-full">
              {checkoutLabel}
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
