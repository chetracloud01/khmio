"use client";

import type { Currency } from "@khmio/shared";
import { cn } from "@khmio/ui";

/**
 * The KHQR payment card, laid out as NBC's KHQR guideline asks: red header
 * with the KHQR mark and the folded corner, receiver name, amount and
 * currency, a dashed divider, then the QR with the currency mark in its
 * centre. Its colours are fixed (`khqr` tokens) — it looks the same in light
 * and dark mode, and the QR stays dark-on-white so bank apps can scan it.
 */
export function KhqrCard({
  merchantName,
  amountMinor,
  currency,
  qrDataUrl,
  qrAlt,
  dimmed = false,
}: {
  merchantName: string;
  /** Cents for USD, riel for KHR. */
  amountMinor: number;
  currency: Currency;
  /** The QR as an image; a grey block is shown while it's being made. */
  qrDataUrl: string | null;
  qrAlt: string;
  /** Expired: shown faded so nobody tries to scan it. */
  dimmed?: boolean;
}) {
  const amount =
    currency === "USD"
      ? (amountMinor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : amountMinor.toLocaleString("en-US");

  return (
    <div
      className={cn(
        "w-full max-w-[300px] overflow-hidden rounded-2xl bg-khqr-surface text-khqr-ink shadow-raised transition-opacity",
        dimmed && "opacity-40",
      )}
    >
      <div className="relative flex h-14 items-center justify-center bg-khqr">
        {/* The KHQR wordmark is the payment standard's name, not translatable text. */}
        <span className="text-2xl font-extrabold tracking-[0.18em] text-khqr-surface">KHQR</span>
        {/* The folded corner under the header's right edge. */}
        <span aria-hidden="true" className="absolute right-0 top-full h-5 w-5 bg-khqr [clip-path:polygon(100%_0,0_0,100%_100%)]" />
      </div>

      <div className="flex flex-col gap-1 px-6 pb-4 pt-5">
        <p className="truncate text-sm leading-normal">{merchantName}</p>
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-bold leading-normal tabular-nums">{amount}</span>
          <span className="text-sm font-medium">{currency}</span>
        </p>
      </div>

      <div aria-hidden="true" className="border-t border-dashed border-khqr-ink/30" />

      <div className="flex items-center justify-center p-6">
        <div className="relative aspect-square w-full">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR generated in the browser, not a remote image
            <img src={qrDataUrl} alt={qrAlt} className="h-full w-full" />
          ) : (
            <div className="h-full w-full animate-pulse rounded-DEFAULT bg-khqr-ink/10 motion-reduce:animate-none" />
          )}
          {/* Currency mark in the middle; the QR is made with high error correction so it still scans. */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-khqr-surface bg-khqr-ink font-bold leading-none text-khqr-surface",
              // The riel sign is drawn much smaller than "$" at the same font size.
              currency === "USD" ? "text-lg" : "text-2xl",
            )}
          >
            {currency === "USD" ? "$" : "៛"}
          </span>
        </div>
      </div>
    </div>
  );
}
