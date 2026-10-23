"use client";

import { Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface ActionTile {
  key: string;
  icon: LucideIcon;
  label: ReactNode;
  /** "primary" teal, "soft" light teal (default), or "telegram" blue for sending to Telegram. */
  look?: keyof typeof LOOKS;
  onClick?: () => void;
  /** A link instead of a button (opens in a new tab when `external`). */
  href?: string;
  external?: boolean;
  /** Saves the link's file under this name (a QR code, an image). */
  download?: string;
  disabled?: boolean;
  /** Working on it: a spinner in place of the icon. */
  busy?: boolean;
}

const LOOKS = {
  primary: "bg-brand text-on-brand",
  soft: "bg-brand/10 text-brand group-hover:bg-brand/15",
  telegram: "bg-telegram text-telegram-on",
};

const VARIANTS = {
  /** Round icons with their names under them, on the page (the Share sheet). */
  plain: { tile: "min-h-touch text-xs", circle: "h-12 w-12" },
  /** Each in its own bordered card, 80px tall (the invoice's Print / Image / PDF). */
  boxed: {
    tile: "min-h-[80px] justify-center rounded-2xl border border-border bg-bg p-2 text-sm shadow-card transition-colors hover:border-brand/40 hover:bg-brand/5 active:scale-[0.98] motion-reduce:transition-none",
    circle: "h-10 w-10",
  },
};

/**
 * A row of round icon buttons with their name under each: the Share sheet's
 * QR code / Copy link / Telegram / Other apps, the invoice's Print / Image /
 * PDF. Give the tiles as data; each is 44px or taller.
 */
export function ActionTiles({ items, columns = 4, variant = "plain", className }: { items: ActionTile[]; columns?: 2 | 3 | 4 | 5; variant?: keyof typeof VARIANTS; className?: string }) {
  const style = VARIANTS[variant];
  const grid = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }[columns];
  return (
    <div className={cn("grid", variant === "boxed" ? "gap-2" : "gap-1", grid, className)}>
      {items.map((item) => {
        const look = item.look ?? "soft";
        const Icon = item.busy ? Loader2 : item.icon;
        const content = (
          <>
            <span className={cn("flex items-center justify-center rounded-full transition-colors", style.circle, LOOKS[look])}>
              <Icon className={cn("h-5 w-5", item.busy && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
            </span>
            <span className="leading-normal">{item.label}</span>
          </>
        );
        const tile = cn("group flex flex-col items-center gap-1.5 text-center font-medium disabled:opacity-60", style.tile);
        return item.href ? (
          <a
            key={item.key}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noreferrer" : undefined}
            download={item.download}
            onClick={item.onClick}
            className={tile}
          >
            {content}
          </a>
        ) : (
          <button key={item.key} type="button" onClick={item.onClick} disabled={item.disabled} aria-busy={item.busy || undefined} className={tile}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
