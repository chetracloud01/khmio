"use client";

import { cn, DiscountBadge } from "@khmio/ui";
import { ImageOff } from "lucide-react";
import type { ReactNode } from "react";
import { QuantityStepper, RoundAddButton } from "./quantity-control";

export type ProductView = "grid" | "list";

export interface ProductTileLabels {
  /** Read out for the round + button, e.g. "Add Toyota Prius". */
  add: string;
  decrease: string;
  increase: string;
  /** "From" over a product with options' cheapest price. */
  from: string;
  /** "3 options". */
  options: string;
  /** "2 in cart". */
  inCart: string;
  soldOut: string;
}

/**
 * One product in the shop's list (design/screens.md B1), as a grid card or a
 * list row: the photo with its discount badge and a round + on it, the name
 * on two lines, how many options, and the price. The live shop and its mockup
 * both draw this — their data comes in already turned into words and prices.
 */
export function ProductTile({
  view,
  title,
  photo,
  discountPercent,
  optionCount,
  price,
  note,
  quantity,
  ordering,
  soldOut = false,
  canAddMore = true,
  picksFirst = false,
  labels,
  onOpen,
  onAdjust,
  className,
}: {
  view: ProductView;
  title: string;
  /** An <img> (or PhotoThumb) filling its box with object-cover; null shows a placeholder. */
  photo: ReactNode | null;
  discountPercent?: number | null;
  /** 0 = a product without options: + adds it straight away. */
  optionCount: number;
  price: ReactNode;
  /** A small line under the price, e.g. "Only 3 left". */
  note?: ReactNode;
  /** In the cart, across all its options. */
  quantity: number;
  ordering: boolean;
  soldOut?: boolean;
  canAddMore?: boolean;
  /** Choices to make first (sugar level, add-ons): + opens the sheet even without options. */
  picksFirst?: boolean;
  labels: ProductTileLabels;
  onOpen: () => void;
  /** +1 / −1 for a product without options. */
  onAdjust: (delta: number) => void;
  className?: string;
}) {
  const list = view === "list";
  const hasOptions = optionCount > 0;
  const opensSheet = hasOptions || picksFirst;
  const showStepper = ordering && !opensSheet && quantity > 0 && !soldOut;
  // + adds a product with nothing to choose straight away; one with options or choices opens its sheet.
  const add = () => (opensSheet ? onOpen() : onAdjust(1));
  const addLabel = quantity > 0 ? `${labels.add} · ${labels.inCart}` : labels.add;

  const media = (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl bg-border/30", list ? "h-28 w-28 sm:h-32 sm:w-32" : "aspect-square w-full")}>
      {/* The photo opens the product too; the title is the one a keyboard or screen reader uses. */}
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onOpen} className={cn("block h-full w-full", soldOut && "opacity-40 grayscale")}>
        {photo ?? (
          <span className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-6 w-6 text-muted" aria-hidden="true" />
          </span>
        )}
      </button>
      {discountPercent && !soldOut ? <DiscountBadge percent={discountPercent} className="absolute left-1.5 top-1.5" /> : null}
      {soldOut && (
        <span className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-full bg-fg/80 px-3 py-1 text-xs font-semibold text-bg">
          {labels.soldOut}
        </span>
      )}
      {/* In a grid the + sits on the photo; in a list it sits by the price. */}
      {!list && ordering && !soldOut && !showStepper && <RoundAddButton label={addLabel} count={quantity} onClick={add} className="absolute bottom-1.5 right-1.5" />}
    </div>
  );

  const details = (
    <div className={cn("flex min-w-0 flex-1 flex-col", list ? "gap-1 py-0.5" : "gap-1")}>
      {/* At least 44 px tall to tap, whatever the name's length. */}
      <button type="button" onClick={onOpen} className={cn("min-h-touch text-left font-medium leading-normal", list ? "line-clamp-2 text-base" : "line-clamp-2 text-sm")}>
        {title}
      </button>
      {hasOptions && (
        <span className="w-fit rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium leading-normal text-brand">{labels.options}</span>
      )}
      {/* Pinned to the bottom, so prices line up across a row whatever the name and options take. */}
      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          {hasOptions && <span className="text-xs leading-normal text-muted">{labels.from}</span>}
          <div className="text-sm">{price}</div>
          {note}
        </div>
        {list && ordering && !soldOut && !showStepper && <RoundAddButton label={addLabel} count={quantity} onClick={add} />}
      </div>
      {showStepper && (
        <QuantityStepper
          quantity={quantity}
          decreaseLabel={labels.decrease}
          increaseLabel={labels.increase}
          onDecrease={() => onAdjust(-1)}
          onIncrease={() => onAdjust(1)}
          increaseDisabled={!canAddMore}
          className={list ? "self-end" : "mt-1"}
        />
      )}
    </div>
  );

  return (
    <article
      className={cn(
        "flex h-full rounded-2xl border border-border bg-bg shadow-card transition-shadow hover:shadow-raised",
        list ? "flex-row gap-3 p-2.5" : "flex-col gap-2 p-2",
        className,
      )}
    >
      {media}
      {details}
    </article>
  );
}
