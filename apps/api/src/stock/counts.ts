import type { Prisma, Tx } from "@khmio/db";
import { countValue, inCountRange, type StockCountLinesInput, type StockCountStartInput } from "@khmio/shared";
import { nextDocumentNumber } from "../documents/next-number";
import { AppException, InvalidInputException } from "../errors";
import { mainLocationId, trackVariant } from "./stock";

// Stock counts (design/screens.md S13 "Count stock"; docs/blueprint.md, the
// ERP physical inventory), inside the seller's withContext. A count is a
// numbered draft (CNT-…) of the main branch, over every item or chosen
// categories; each item typed is a line keeping what the app had for it at
// that moment. Applied once: each correction is counted − expected then, put
// onto today's stock (a sale made while counting is never taken for a loss),
// as a count_correction linked to the count; each line's cost is fixed;
// an item not tracked starts from its count. Cancelled, nothing moves. The
// database holds the rules too (migration stock_counts): one draft per shop,
// lines change only in a draft, a count is applied or cancelled once.

type Context = { storeId: string; merchantId: string };

const countSelect = {
  id: true,
  number: true,
  status: true,
  categoryIds: true,
  note: true,
  startedAt: true,
  appliedAt: true,
  cancelledAt: true,
  lines: {
    select: { variantId: true, counted: true, expectedOnHand: true, countedAt: true, costMinor: true, costCurrency: true, variant: { select: { costMinor: true, costCurrency: true } } },
    orderBy: { countedAt: "asc" },
  },
} satisfies Prisma.StockCountSelect;
type CountRow = Prisma.StockCountGetPayload<{ select: typeof countSelect }>;

/** A count with its lines and what its differences are worth: an applied count at its fixed costs, a draft at today's. */
export function toStockCount({ startedAt, appliedAt, cancelledAt, lines, ...count }: CountRow) {
  const valued = lines.map(({ variant, countedAt, ...line }) => {
    const fixed = count.status === "applied";
    return { ...line, countedAt: countedAt.toISOString(), costMinor: fixed ? line.costMinor : variant.costMinor, costCurrency: fixed ? line.costCurrency : variant.costCurrency };
  });
  return {
    ...count,
    startedAt: startedAt.toISOString(),
    appliedAt: appliedAt?.toISOString() ?? null,
    cancelledAt: cancelledAt?.toISOString() ?? null,
    lines: valued,
    value: countValue(valued),
  };
}

async function readCountRow(tx: Tx, storeId: string, id: string) {
  return tx.stockCount.findFirst({ where: { id, storeId }, select: countSelect });
}

export async function readStockCount(tx: Tx, storeId: string, id: string) {
  const count = await readCountRow(tx, storeId, id);
  return count ? toStockCount(count) : null;
}

/** The shop's counts, newest first: the open draft (if any) leads. */
export async function readStockCounts(tx: Tx, storeId: string) {
  const counts = await tx.stockCount.findMany({ where: { storeId }, select: countSelect, orderBy: { number: "desc" } });
  return { counts: counts.map(toStockCount) };
}

/** Starts a count, or answers with the shop's open draft (one at a time). Returns its id. */
export async function startStockCount(tx: Tx, context: Context, input: StockCountStartInput): Promise<string> {
  const open = () => tx.stockCount.findFirst({ where: { storeId: context.storeId, status: "draft" }, select: { id: true } });
  const existing = await open();
  if (existing) return existing.id;
  // Taking the number holds the shop's count counter until this transaction ends: a second start waits, then finds this draft.
  const number = await nextDocumentNumber(tx, context.storeId, "count");
  const started = await open();
  if (started) return started.id;
  const categories = input.categoryIds.length > 0 ? await tx.category.findMany({ where: { id: { in: input.categoryIds } }, select: { id: true } }) : [];
  if (categories.length !== input.categoryIds.length) throw new InvalidInputException({ categoryIds: "required" });
  const created = await tx.stockCount.create({
    data: { storeId: context.storeId, number, locationId: await mainLocationId(tx, context.storeId), categoryIds: input.categoryIds, note: input.note, startedById: context.merchantId },
    select: { id: true },
  });
  return created.id;
}

/** The draft, or why not: another shop's or a missing count is not found; an applied or cancelled one can't change. */
async function draftOf(tx: Tx, storeId: string, id: string) {
  const count = await tx.stockCount.findFirst({ where: { id, storeId }, select: { id: true, status: true, categoryIds: true, locationId: true } });
  if (!count) throw new AppException(404, "action_not_allowed");
  if (count.status !== "draft") throw new AppException(409, "action_not_allowed");
  return count;
}

/**
 * Saves counts as they're typed: each item in the count's range once, with
 * what the app has for it now (the "expected" its correction is worked out
 * from); a blank takes the item's line away.
 */
export async function saveStockCountLines(tx: Tx, context: Context, id: string, input: StockCountLinesInput): Promise<void> {
  const count = await draftOf(tx, context.storeId, id);
  const variantIds = input.lines.map((line) => line.variantId);
  const variants = await tx.productVariant.findMany({ where: { id: { in: variantIds }, deletedAt: null, product: { storeId: context.storeId, deletedAt: null } }, select: { id: true, product: { select: { categoryId: true } } } });
  const categoryOf = new Map(variants.map((variant) => [variant.id, variant.product.categoryId]));
  const levels = await tx.stockLevel.findMany({ where: { variantId: { in: variantIds }, locationId: count.locationId }, select: { variantId: true, onHand: true } });
  const onHandOf = new Map(levels.map((level) => [level.variantId, level.onHand]));
  for (const [index, line] of input.lines.entries()) {
    const categoryId = categoryOf.get(line.variantId);
    // Another shop's item, a deleted one, or one outside the categories being counted.
    if (categoryId === undefined || !inCountRange(count.categoryIds, categoryId)) throw new InvalidInputException({ [`lines.${index}.variantId`]: "product_unavailable" });
    const key = { countId_variantId: { countId: id, variantId: line.variantId } };
    if (line.counted === null) {
      await tx.stockCountLine.deleteMany({ where: { countId: id, variantId: line.variantId } });
      continue;
    }
    const typed = { counted: line.counted, expectedOnHand: onHandOf.get(line.variantId) ?? null, countedAt: new Date() };
    await tx.stockCountLine.upsert({ where: key, create: { countId: id, storeId: context.storeId, variantId: line.variantId, ...typed }, update: typed });
  }
}

/**
 * Applies a draft, once: each line's correction onto today's stock (never
 * below what's held for unpaid KHQR orders), an untracked item starting from
 * its count, each line's cost fixed, then the count applied — all or nothing.
 */
export async function applyStockCount(tx: Tx, context: Context, id: string): Promise<void> {
  // Held until the transaction ends: two people pressing Apply at once apply it once.
  const [locked] = await tx.$queryRaw<{ status: string }[]>`SELECT status::text FROM stock_counts WHERE id = ${id}::uuid AND store_id = ${context.storeId}::uuid FOR UPDATE`;
  if (!locked) throw new AppException(404, "action_not_allowed");
  if (locked.status !== "draft") throw new AppException(409, "action_not_allowed");
  const count = await draftOf(tx, context.storeId, id);
  const lines = await tx.stockCountLine.findMany({ where: { countId: id }, select: { variantId: true, counted: true, expectedOnHand: true, variant: { select: { costMinor: true, costCurrency: true } } } });
  for (const [index, line] of lines.entries()) {
    const [level] = await tx.$queryRaw<{ onHand: number; reserved: number }[]>`
      SELECT on_hand AS "onHand", reserved FROM stock_levels WHERE variant_id = ${line.variantId}::uuid AND location_id = ${count.locationId}::uuid FOR UPDATE`;
    if (!level) {
      // Not tracked (when typed, or since): it starts from its count.
      await trackVariant(tx, context, { variantId: line.variantId, onHand: line.counted });
    } else {
      // Tracked since it was typed: what it has now is what the count corrects.
      const onHand = level.onHand + line.counted - (line.expectedOnHand ?? level.onHand);
      if (onHand < level.reserved) throw new InvalidInputException({ [`lines.${index}.counted`]: "not_enough_stock" });
      const difference = onHand - level.onHand;
      if (difference !== 0) {
        await tx.stockLevel.updateMany({ where: { variantId: line.variantId, locationId: count.locationId }, data: { onHand } });
        await tx.stockMovement.create({
          data: {
            storeId: context.storeId,
            variantId: line.variantId,
            locationId: count.locationId,
            type: difference > 0 ? "adjust_in" : "adjust_out",
            reason: "count_correction",
            quantity: Math.abs(difference),
            stockCountId: id,
            actorMerchantId: context.merchantId,
          },
        });
      }
    }
    // The cost it's worth at, fixed now: the count's value never changes after.
    await tx.stockCountLine.updateMany({ where: { countId: id, variantId: line.variantId }, data: { costMinor: line.variant.costMinor, costCurrency: line.variant.costMinor === null ? null : line.variant.costCurrency } });
  }
  await tx.stockCount.updateMany({ where: { id, status: "draft" }, data: { status: "applied", appliedAt: new Date(), appliedById: context.merchantId } });
}

/** Cancels a draft: nothing moves, and it stays in the list as cancelled. */
export async function cancelStockCount(tx: Tx, context: Context, id: string): Promise<void> {
  await draftOf(tx, context.storeId, id);
  const { count } = await tx.stockCount.updateMany({ where: { id, storeId: context.storeId, status: "draft" }, data: { status: "cancelled", cancelledAt: new Date(), cancelledById: context.merchantId } });
  if (count === 0) throw new AppException(409, "action_not_allowed");
}
