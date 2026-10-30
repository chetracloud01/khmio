import type { Currency } from "@khmio/shared";
import type { PayablesReport, Supplier } from "@/lib/api";
import { listAddress } from "../../lib/list-address";

// The Suppliers page's status tiles and chips (design/screens.md S13
// "Suppliers"): each supplier joined with what the payables report says of
// them — overdue, bills whose goods haven't arrived — and which group it's
// in. Pure, so the sums are tested without a page. Dollars and riel are
// never added together.

type Money = Record<Currency, number>;

/** Most urgent first; each is also the list's chip of the same name. */
export const SUPPLIER_TILES = ["overdue", "owed", "waiting", "settled", "archived"] as const;
export type SupplierTile = (typeof SUPPLIER_TILES)[number];

/** What the report adds about one supplier: overdue (each currency) and bills not received. */
export interface SupplierStanding {
  overdue: Money;
  notReceived: number;
}

const NONE: SupplierStanding = { overdue: { USD: 0, KHR: 0 }, notReceived: 0 };

/** Each supplier's standing from the report's rows (one per supplier and currency). */
export function supplierStandings(report: Pick<PayablesReport, "suppliers">): Map<string, SupplierStanding> {
  const standings = new Map<string, SupplierStanding>();
  for (const row of report.suppliers) {
    if (!row.supplierId) continue;
    const standing = standings.get(row.supplierId) ?? { overdue: { USD: 0, KHR: 0 }, notReceived: 0 };
    standing.overdue[row.currency] += row.overdue;
    standing.notReceived += row.notReceived.count;
    standings.set(row.supplierId, standing);
  }
  return standings;
}

export const standingOf = (standings: Map<string, SupplierStanding>, supplier: Pick<Supplier, "id">): SupplierStanding => standings.get(supplier.id) ?? NONE;

const any = (money: Money) => money.USD > 0 || money.KHR > 0;

/** Whether a supplier belongs to a tile (a supplier may be in several: overdue is also owed). */
export function inTile(tile: SupplierTile, supplier: Supplier, standing: SupplierStanding): boolean {
  if (tile === "overdue") return any(standing.overdue);
  if (tile === "owed") return any(supplier.owed);
  if (tile === "waiting") return standing.notReceived > 0;
  if (tile === "settled") return !supplier.archived && !any(supplier.owed);
  return supplier.archived;
}

/** Each tile's suppliers and its amount: overdue, owed, bills not received (a count), or bought from those settled. */
export function supplierTileFigures(suppliers: readonly Supplier[], standings: Map<string, SupplierStanding>): Record<SupplierTile, { count: number; amount: Money; bills: number }> {
  const empty = () => ({ count: 0, amount: { USD: 0, KHR: 0 }, bills: 0 });
  const figures: Record<SupplierTile, { count: number; amount: Money; bills: number }> = { overdue: empty(), owed: empty(), waiting: empty(), settled: empty(), archived: empty() };
  for (const supplier of suppliers) {
    const standing = standingOf(standings, supplier);
    for (const tile of SUPPLIER_TILES) {
      if (!inTile(tile, supplier, standing)) continue;
      const figure = figures[tile];
      figure.count += 1;
      const money = tile === "overdue" ? standing.overdue : tile === "owed" ? supplier.owed : tile === "settled" ? supplier.bought : null;
      if (money) for (const currency of ["USD", "KHR"] as const) figure.amount[currency] += money[currency];
      if (tile === "waiting") figure.bills += standing.notReceived;
    }
  }
  return figures;
}

const isSupplierTile = (chip: string): chip is SupplierTile => (SUPPLIER_TILES as readonly string[]).includes(chip);

/** The tile a list chip shows, if it's one. */
export const supplierTileOf = (chip: string): SupplierTile | null => (isSupplierTile(chip) ? chip : null);

/** The address a tile writes (lib/list-address.ts); none: every supplier. */
export const supplierTileSearch = (current: string, tile: SupplierTile | null): string => listAddress(current, tile ? { chip: tile } : null);
