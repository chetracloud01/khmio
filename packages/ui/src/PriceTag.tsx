import { formatKhr, formatUsd, type Currency } from "@khmio/shared";
import { cn } from "./cn";

export interface PriceTagProps {
  usdCents?: number;
  khr?: number;
  /** Pre-discount price, shown struck through next to the current price. */
  originalUsdCents?: number;
  originalKhr?: number;
  /**
   * Stacked layout for narrow cards: the price in `primary` (the buyer's
   * currency) on top, the other currency small underneath. Without it, both
   * sit on one line as "$1.25 / 5,125៛".
   */
  primary?: Currency;
  className?: string;
}

export function PriceTag({ usdCents, khr, originalUsdCents, originalKhr, primary, className }: PriceTagProps) {
  if (usdCents == null && khr == null) return null;

  if (primary) {
    // Fall back to whichever currency the product actually has.
    const showUsdFirst = primary === "USD" ? usdCents != null : khr == null;
    const main = showUsdFirst ? formatUsd(usdCents!) : formatKhr(khr!);
    const secondary = showUsdFirst ? (khr != null ? formatKhr(khr) : null) : usdCents != null ? formatUsd(usdCents) : null;
    const original = showUsdFirst
      ? originalUsdCents != null
        ? formatUsd(originalUsdCents)
        : null
      : originalKhr != null
        ? formatKhr(originalKhr)
        : null;
    return (
      <span className={cn("flex min-w-0 flex-col", className)}>
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-semibold text-fg">{main}</span>
          {original && <span className="text-xs font-normal text-muted line-through">{original}</span>}
        </span>
        {secondary && <span className="text-xs font-normal text-muted">{secondary}</span>}
      </span>
    );
  }

  const hasDiscount = originalUsdCents != null || originalKhr != null;

  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className="font-semibold text-fg">
        {usdCents != null && <span>{formatUsd(usdCents)}</span>}
        {usdCents != null && khr != null && <span className="mx-1 font-normal text-muted">/</span>}
        {khr != null && <span>{formatKhr(khr)}</span>}
      </span>
      {hasDiscount && (
        <span className="text-xs font-normal text-muted line-through">
          {originalUsdCents != null ? formatUsd(originalUsdCents) : formatKhr(originalKhr!)}
        </span>
      )}
    </span>
  );
}
