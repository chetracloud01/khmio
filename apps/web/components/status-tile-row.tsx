"use client";

import type { Tone } from "@khmio/ui";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ActionStatTile } from "@/components/action-stat-tile";

/** One tile of a page's status row: what it counts, and the list view it opens (null: the whole list). */
export interface StatusTile<V extends string> {
  key: string;
  icon: LucideIcon;
  tone: Tone;
  label: string;
  /** "$1,044.50" or "3 items". */
  amount: string;
  /** "2 bills", top right. */
  count?: string;
  /** A line under the amount (the other currency). */
  sub?: ReactNode;
  /** What to do there, shown when there's something to do. */
  action?: string;
  /** The list view the tile opens; null: the whole list. */
  view: V | null;
  /** Opens this page instead (a report) — the list stays as it is. */
  href?: string;
}

/** Tablet and desktop columns by how many tiles there are, so no row is left with one (the classes must be written out whole for Tailwind). */
const COLUMNS: Record<number, string> = {
  3: "sm:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 xl:grid-cols-6",
};

/**
 * A page's status tiles (design/design-standard.md "Status tiles"; Purchases,
 * Stock, Suppliers, Orders, Customers, Products and the reports): each a
 * count and amount that says what to do. Tapped, the list below follows the
 * tile's view; tapped again — or a tile with no view — the whole list; a
 * tile with a page (a report) opens it. Two across on a phone (an odd first
 * tile spans both), all in one row on a laptop.
 */
export function StatusTileRow<V extends string>({ label, tiles, active, onSelect }: { label: string; tiles: readonly StatusTile<V>[]; active: V | null; onSelect: (view: V | null) => void }) {
  const router = useRouter();
  const spanFirst = tiles.length % 2 === 1;
  return (
    <nav aria-label={label} className={`grid grid-cols-2 gap-3 ${COLUMNS[tiles.length] ?? "lg:grid-cols-4"}`}>
      {tiles.map((tile, index) => (
        <div key={tile.key} className={spanFirst && index === 0 ? "col-span-2 sm:col-span-1" : undefined}>
          <ActionStatTile
            icon={tile.icon}
            tone={tile.tone}
            label={tile.label}
            count={tile.count}
            amount={tile.amount}
            sub={tile.sub}
            action={tile.action}
            active={tile.view !== null && active === tile.view}
            onSelect={() => (tile.href ? router.push(tile.href) : onSelect(tile.view === null || active === tile.view ? null : tile.view))}
          />
        </div>
      ))}
    </nav>
  );
}
