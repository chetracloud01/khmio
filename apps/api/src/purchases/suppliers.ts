import { Prisma, type Tx } from "@khmio/db";
import { phnomPenhDay, type Currency, type SupplierInput } from "@khmio/shared";
import { AppException, InvalidInputException } from "../errors";
import { owedTotals, readBillBalances } from "./bill-balances";
import { dayOf } from "./purchase-days";

// The shop's suppliers (design/screens.md S13 "Suppliers"), inside the
// seller's withContext: kept, renamed, archived, never deleted — old bills
// keep who they came from.

const supplierSelect = {
  id: true,
  name: true,
  phone: true,
  note: true,
  archivedAt: true,
  _count: { select: { purchases: true } },
} satisfies Prisma.SupplierSelect;
type SupplierRow = Prisma.SupplierGetPayload<{ select: typeof supplierSelect }>;

/** What was bought from a supplier (bills less returns) and what the shop still owes them, dollars and riel apart, and the day of the last bill. */
export interface SupplierStats {
  bought: Record<Currency, number>;
  owed: Record<Currency, number>;
  lastBillOn: string | null;
}
const NO_STATS: SupplierStats = { bought: { USD: 0, KHR: 0 }, owed: { USD: 0, KHR: 0 }, lastBillOn: null };

export function toSupplier({ archivedAt, _count, ...supplier }: SupplierRow, stats: SupplierStats = NO_STATS) {
  return { ...supplier, archived: archivedAt !== null, purchaseCount: _count.purchases, ...stats };
}

/** Each supplier's numbers, added up by the database from their bills and returns. */
export function toSupplierStats(sums: { supplierId: string | null; kind: "purchase" | "return"; currency: Currency; _sum: { totalMinor: number | null }; _max: { purchasedOn: Date | null } }[]): Map<string, SupplierStats> {
  const stats = new Map<string, SupplierStats>();
  for (const sum of sums) {
    if (!sum.supplierId) continue;
    const entry = stats.get(sum.supplierId) ?? { bought: { USD: 0, KHR: 0 }, owed: { USD: 0, KHR: 0 }, lastBillOn: null };
    entry.bought[sum.currency] += (sum.kind === "return" ? -1 : 1) * (sum._sum.totalMinor ?? 0);
    const last = sum.kind === "purchase" && sum._max.purchasedOn ? dayOf(sum._max.purchasedOn) : null;
    if (last && (!entry.lastBillOn || last > entry.lastBillOn)) entry.lastBillOn = last;
    stats.set(sum.supplierId, entry);
  }
  return stats;
}

/** Every supplier with what was bought from them, live ones first (A to Z), archived ones after: old bills still show who they came from. */
export async function readSuppliers(tx: Tx, storeId: string, now = new Date()) {
  const [suppliers, sums, balances] = await Promise.all([
    tx.supplier.findMany({ where: { storeId }, select: supplierSelect, orderBy: [{ archivedAt: { sort: "desc", nulls: "first" } }, { name: "asc" }] }),
    tx.purchase.groupBy({ by: ["supplierId", "kind", "currency"], where: { storeId, supplierId: { not: null } }, _sum: { totalMinor: true }, _max: { purchasedOn: true } }),
    readBillBalances(tx, storeId, phnomPenhDay(now)),
  ]);
  const stats = toSupplierStats(sums);
  for (const entry of stats.entries()) entry[1].owed = owedTotals(balances.filter((balance) => balance.supplierId === entry[0]));
  return { suppliers: suppliers.map((supplier) => toSupplier(supplier, stats.get(supplier.id))) };
}

/** One supplier with their numbers (the suppliers' page), or null: another shop's supplier isn't found under row-level security. */
export async function readSupplier(tx: Tx, storeId: string, id: string) {
  return (await readSuppliers(tx, storeId)).suppliers.find((supplier) => supplier.id === id) ?? null;
}

/** Two suppliers in one shop never share a name, whatever the case (the database's index on lower(name) is the last word). */
async function refuseTakenName(tx: Tx, storeId: string, name: string, exceptId?: string): Promise<void> {
  const taken = await tx.supplier.findFirst({ where: { storeId, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
  if (taken) throw new InvalidInputException({ name: "name_duplicate" });
}

/** A name taken between the check and the save still comes back as the field's error, not a crash. */
async function savingName<T>(save: () => Promise<T>): Promise<T> {
  try {
    return await save();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new InvalidInputException({ name: "name_duplicate" });
    throw error;
  }
}

export async function createSupplier(tx: Tx, storeId: string, input: SupplierInput) {
  await refuseTakenName(tx, storeId, input.name);
  return toSupplier(await savingName(() => tx.supplier.create({ data: { storeId, ...input }, select: supplierSelect })));
}

export async function updateSupplier(tx: Tx, storeId: string, id: string, input: SupplierInput) {
  await ownSupplier(tx, storeId, id);
  await refuseTakenName(tx, storeId, input.name, id);
  return toSupplier(await savingName(() => tx.supplier.update({ where: { id }, data: input, select: supplierSelect })));
}

/** Archive (out of the bill's picker) or bring back; never deleted, so old bills keep their supplier. */
export async function archiveSupplier(tx: Tx, storeId: string, id: string, archived: boolean) {
  await ownSupplier(tx, storeId, id);
  return toSupplier(await tx.supplier.update({ where: { id }, data: { archivedAt: archived ? new Date() : null }, select: supplierSelect }));
}

/** This shop's supplier (another shop's id finds nothing under row-level security). */
async function ownSupplier(tx: Tx, storeId: string, id: string) {
  const supplier = await tx.supplier.findFirst({ where: { id, storeId }, select: { id: true, name: true, archivedAt: true } });
  if (!supplier) throw new AppException(404, "action_not_allowed");
  return supplier;
}

