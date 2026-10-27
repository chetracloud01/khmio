"use client";

import { khrTextFromUsdText, usdTextFromKhrText } from "@khmio/shared";
import { cn } from "./cn";
import { Input } from "./Input";

export interface MoneyInputProps {
  /** The two boxes' text (what the seller typed); turn it into cents and riel with parseUsdInput / parseKhrInput. */
  usd: string;
  khr: string;
  onUsdChange: (text: string) => void;
  onKhrChange: (text: string) => void;
  usdLabel: string;
  khrLabel: string;
  usdError?: string;
  khrError?: string;
  /** Called when a box loses focus (after any auto-fill), e.g. to check the field. */
  onUsdBlur?: () => void;
  onKhrBlur?: () => void;
  /** The store's rate: leaving one box fills the other when it's still empty (docs/blueprint.md "Multi-currency pricing"). */
  autoFillRate?: number;
  usdPlaceholder?: string;
  khrPlaceholder?: string;
  className?: string;
}

/**
 * One price in dollars and riel, side by side: a product's retail and
 * wholesale price, its options' prices, a delivery fee. Either box or both
 * may be filled (a product may have one or both prices); amounts are typed
 * as text and saved as whole cents and riel by the page.
 */
export function MoneyInput({
  usd,
  khr,
  onUsdChange,
  onKhrChange,
  usdLabel,
  khrLabel,
  usdError,
  khrError,
  onUsdBlur,
  onKhrBlur,
  autoFillRate,
  usdPlaceholder,
  khrPlaceholder,
  className,
}: MoneyInputProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <Input
        label={usdLabel}
        inputMode="decimal"
        placeholder={usdPlaceholder}
        value={usd}
        onChange={(event) => onUsdChange(event.target.value)}
        onBlur={() => {
          if (autoFillRate && !khr) {
            const filled = khrTextFromUsdText(usd, autoFillRate);
            if (filled !== undefined) onKhrChange(filled);
          }
          onUsdBlur?.();
        }}
        error={usdError}
      />
      <Input
        label={khrLabel}
        inputMode="numeric"
        placeholder={khrPlaceholder}
        value={khr}
        onChange={(event) => onKhrChange(event.target.value)}
        onBlur={() => {
          if (autoFillRate && !usd) {
            const filled = usdTextFromKhrText(khr, autoFillRate);
            if (filled !== undefined) onUsdChange(filled);
          }
          onKhrBlur?.();
        }}
        error={khrError}
      />
    </div>
  );
}
