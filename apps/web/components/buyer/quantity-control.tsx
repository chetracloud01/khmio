"use client";

import { cn } from "@khmio/ui";
import { Minus, Plus } from "lucide-react";

// The buyer's add and quantity buttons, one look everywhere in the shop: the
// list's cards and rows, and each option in a product's sheet. Every button is
// 44 px (design standard: no tap target under 44 px).

/** The round +. With some already in the cart, a small count bubble on it. */
export function RoundAddButton({ label, count = 0, onClick, disabled = false, className }: { label: string; count?: number; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-raised ring-2 ring-bg transition-transform active:scale-90 disabled:opacity-40 motion-reduce:transition-none",
        className,
      )}
    >
      <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fg px-1 text-[11px] font-bold leading-none text-bg">{count}</span>
      )}
    </button>
  );
}

/** − 2 + on a soft teal pill. */
export function QuantityStepper({
  quantity,
  decreaseLabel,
  increaseLabel,
  onDecrease,
  onIncrease,
  increaseDisabled = false,
  className,
}: {
  quantity: number;
  decreaseLabel: string;
  increaseLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
  /** At the stock limit: the buyer can't add more than the shop has. */
  increaseDisabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-1 rounded-full bg-brand/10 p-0.5", className)}>
      <button type="button" aria-label={decreaseLabel} onClick={onDecrease} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg text-brand shadow-card active:scale-90">
        <Minus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </button>
      <span className="min-w-6 text-center text-sm font-bold tabular-nums" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={increaseLabel}
        onClick={onIncrease}
        disabled={increaseDisabled}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-card active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Round + while none are in the cart, then − n +. `onChange` gets the new quantity (0 takes it out). */
export function QuantityControl({
  quantity,
  addLabel,
  decreaseLabel,
  increaseLabel,
  onChange,
  canAddMore = true,
  className,
}: {
  quantity: number;
  addLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (quantity: number) => void;
  canAddMore?: boolean;
  className?: string;
}) {
  if (quantity === 0) return <RoundAddButton label={addLabel} onClick={() => onChange(1)} disabled={!canAddMore} className={className} />;
  return (
    <QuantityStepper
      quantity={quantity}
      decreaseLabel={decreaseLabel}
      increaseLabel={increaseLabel}
      onDecrease={() => onChange(quantity - 1)}
      onIncrease={() => onChange(quantity + 1)}
      increaseDisabled={!canAddMore}
      className={className}
    />
  );
}
