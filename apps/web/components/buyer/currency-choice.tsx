"use client";

import type { Currency } from "@khmio/shared";
import { SegmentedControl } from "@khmio/ui";

const CURRENCIES: readonly Currency[] = ["USD", "KHR"];

/**
 * "Pay in $ USD / ៛ KHR": the one currency for the whole order (CLAUDE.md
 * "Prices"), the same choice in the cart and at checkout.
 */
export function CurrencyChoice({ label, value, onChange }: { label: string; value: Currency; onChange: (currency: Currency) => void }) {
  return (
    <SegmentedControl
      mode="choice"
      label={label}
      value={value}
      onChange={(next) => {
        const currency = CURRENCIES.find((option) => option === next);
        if (currency) onChange(currency);
      }}
      options={CURRENCIES.map((option) => ({ value: option, label: `${option === "USD" ? "$" : "៛"} ${option}` }))}
      className="w-fit"
    />
  );
}
