import type { Prisma, Tx } from "@khmio/db";
import {
  LOW_STOCK_THRESHOLD,
  movingAverageCost,
  needsReorder,
  planHasFeature,
  stockValue,
  suggestedOrder,
  type Currency,
  type PlanId,
  type ReorderLevelsInput,
  type StockChangeInput,
  type StockTrackInput,
  type StockTrackManyInput,
  type SubscriptionStatus,
} from "@khmio/shared";
import { AppException, InvalidInputException } from "../errors";
import { planInForce } from "../merchant/plan";

// Stock at the shop's main branch (roadmap: Pro plan; docs/blueprint.md
// "Stock", design/screens.md S13), inside the seller's withContext. A product
// option is tracked once it has a level row; the movements are its history.
// Orders and counter sales take and return stock through the database
// functions app_take_order_stock / app_return_order_stock, so a sale can
// never take the last item twice.

/** Whether the plan in force follows stock (packages/shared plans.ts). On lower plans the data stays, locked. */
export const tracksStock = (plan: PlanId) => planHasFeature(plan, "stock");

/** How many movements the Stock page shows, newest first. */
export const RECENT_MOVEMENTS = 50;

export async function mainLocationId(tx: Tx, storeId: string): Promise<string> {
  const location = await tx.stockLocation.findFirst({ where: { storeId, isMain: true }, select: { id: true } });
  if (!location) throw new AppException(409, "action_not_allowed");
  return location.id;
}

/**
 * Takes an order's tracked items off the main branch. Throws "sold_out" under
 * the line that hasn't enough (the caller's transaction then rolls back, so
 * nothing is taken). `lineVariantIds` maps the error to the request's lines.
 */
export async function takeOrderStock(tx: Tx, orderId: string, lineVariantIds: string[]): Promise<void> {
  const [row] = await tx.$queryRaw<{ short: string | null }[]>`SELECT app_take_order_stock(${orderId}::uuid) AS short`;
  refuseShortLine(row?.short ?? null, lineVariantIds);
}

/**
 * Holds an order's tracked items while it waits to be paid by KHQR: nothing
 * leaves the shelf, but nobody else can have them. The worker turns the hold
 * into a sale once paid, or lets it go when the code expires. Throws
 * "sold_out" like takeOrderStock.
 */
export async function reserveOrderStock(tx: Tx, orderId: string, lineVariantIds: string[]): Promise<void> {
  const [row] = await tx.$queryRaw<{ short: string | null }[]>`SELECT app_reserve_order_stock(${orderId}::uuid) AS short`;
  refuseShortLine(row?.short ?? null, lineVariantIds);
}

/** "sold_out" under the request's line for the option without enough (the transaction then rolls back). */
function refuseShortLine(short: string | null, lineVariantIds: string[]): void {
  if (!short) return;
  const index = Math.max(0, lineVariantIds.indexOf(short));
  throw new InvalidInputException({ [`lines.${index}`]: "sold_out" });
}

/** Puts back what an order took, and lets go of what it only held (cancelled order, voided counter sale). Nothing happens if it had none. */
export async function returnOrderStock(tx: Tx, orderId: string): Promise<void> {
  await tx.$executeRaw`SELECT app_return_order_stock(${orderId}::uuid)`;
}

export const stockVariantSelect = {
  id: true,
  sku: true,
  labelKm: true,
  labelEn: true,
  isDefault: true,
  costMinor: true,
  costCurrency: true,
  product: { select: { id: true, titleKm: true, titleEn: true, categoryId: true, brandId: true } },
} satisfies Prisma.ProductVariantSelect;
type StockVariantRow = Prisma.ProductVariantGetPayload<{ select: typeof stockVariantSelect }>;

export const stockMovementSelect = {
  id: true,
  variantId: true,
  type: true,
  quantity: true,
  reason: true,
  note: true,
  unitCostMinor: true,
  costCurrency: true,
  supplier: true,
  createdAt: true,
  order: { select: { id: true, orderNumber: true, channel: true } },
  purchase: { select: { id: true, number: true, currency: true, exchangeRateUsed: true } },
} satisfies Prisma.StockMovementSelect;
type StockMovementRow = Prisma.StockMovementGetPayload<{ select: typeof stockMovementSelect }>;

/** The Stock page: every live product option with its count (null = not tracked) and cost, what the stock is worth, and the latest changes. */
/** An item's count row: on hand, held, and its reorder levels (empty = the shop's rule). */
export interface StockLevelRow {
  variantId: string;
  onHand: number;
  reserved: number;
  reorderMin: number | null;
  reorderMax: number | null;
}

/** Where an item was last bought: the supplier and the cost of one on that bill (in its currency, the product's). */
export interface LastBought {
  variantId: string;
  supplierId: string | null;
  supplierName: string | null;
  unitCostMinor: number;
}

export function toStockPage(variants: StockVariantRow[], levels: StockLevelRow[], movements: StockMovementRow[], plan: PlanId, lastBought: LastBought[] = []) {
  const boughtFrom = new Map(lastBought.map((entry) => [entry.variantId, entry]));
  const byVariant = new Map(levels.map((level) => [level.variantId, level]));
  const tracked = variants.flatMap((variant) => {
    const level = byVariant.get(variant.id);
    return level ? [{ onHand: level.onHand, costMinor: variant.costMinor, costCurrency: variant.costCurrency }] : [];
  });
  return {
    /** Writes need Pro or Advance; on a lower plan the counts are shown, locked. */
    tracksStock: tracksStock(plan),
    lowAt: LOW_STOCK_THRESHOLD,
    /** On hand × cost, dollars and riel apart ("Cost price", level 2). */
    value: stockValue(tracked),
    items: variants.map((variant) => {
      const level = byVariant.get(variant.id);
      const free = level ? level.onHand - level.reserved : null;
      const toReorder = level !== undefined && free !== null && needsReorder(free, level.reorderMin);
      const last = boughtFrom.get(variant.id);
      return {
        variantId: variant.id,
        productId: variant.product.id,
        titleKm: variant.product.titleKm,
        titleEn: variant.product.titleEn,
        /** For the list's category and brand filters. */
        categoryId: variant.product.categoryId,
        brandId: variant.product.brandId,
        optionKm: variant.isDefault ? "" : variant.labelKm,
        optionEn: variant.isDefault ? "" : variant.labelEn,
        sku: variant.sku,
        onHand: level ? level.onHand : null,
        /** Free stock at or below its reorder point (sold out included): the seller's "Low" and "To reorder". */
        low: toReorder,
        reorderMin: level?.reorderMin ?? null,
        reorderMax: level?.reorderMax ?? null,
        /** How many to order now; null when it doesn't need ordering. */
        suggested: level && toReorder && free !== null ? suggestedOrder(free, level.reorderMin, level.reorderMax) : null,
        lastSupplierId: last?.supplierId ?? null,
        lastSupplierName: last?.supplierName ?? null,
        lastCostMinor: last?.unitCostMinor ?? null,
        costMinor: variant.costMinor,
        costCurrency: variant.costCurrency,
      };
    }),
    movements: movements.map(({ createdAt, order, purchase, ...movement }) => ({
      ...movement,
      createdAt: createdAt.toISOString(),
      purchaseId: purchase?.id ?? null,
      purchaseNumber: purchase?.number ?? null,
      /** A purchase turned from its bill's other currency: the bill's currency and the rate used. */
      billCurrency: purchase?.currency ?? null,
      billRate: purchase?.exchangeRateUsed ?? null,
      orderId: order?.id ?? null,
      orderNumber: order?.orderNumber ?? null,
      inStore: order?.channel === "in_store",
    })),
  };
}

export async function readStockPage(tx: Tx, storeId: string, plan: PlanId) {
  const location = await mainLocationId(tx, storeId);
  const [variants, levels, movements, lastBought] = await Promise.all([
    tx.productVariant.findMany({
      // Services (labour, a car wash) have nothing on a shelf to count.
      where: { deletedAt: null, product: { deletedAt: null, kind: "item" } },
      select: stockVariantSelect,
      orderBy: [{ product: { titleEn: "asc" } }, { sortOrder: "asc" }],
    }),
    tx.stockLevel.findMany({ where: { locationId: location }, select: { variantId: true, onHand: true, reserved: true, reorderMin: true, reorderMax: true } }),
    tx.stockMovement.findMany({ where: { locationId: location }, select: stockMovementSelect, orderBy: { createdAt: "desc" }, take: RECENT_MOVEMENTS }),
    readLastBought(tx, storeId),
  ]);
  return toStockPage(variants, levels, movements, plan, lastBought);
}

/** Each item's newest bill line (not a return): who it came from and what one cost, for reordering. */
export async function readLastBought(tx: Tx, storeId: string): Promise<LastBought[]> {
  return tx.$queryRaw<LastBought[]>`
    SELECT DISTINCT ON (line.variant_id) line.variant_id AS "variantId", bill.supplier_id AS "supplierId", supplier.name AS "supplierName", line.unit_cost_minor AS "unitCostMinor"
      FROM purchase_lines line
      JOIN purchases bill ON bill.id = line.purchase_id AND bill.kind = 'purchase'
      LEFT JOIN suppliers supplier ON supplier.id = bill.supplier_id
     WHERE line.store_id = ${storeId}::uuid
     ORDER BY line.variant_id, bill.purchased_on DESC, bill.number DESC`;
}

/** Sets reorder levels for tracked items (one, or many from the list's selection), all or nothing. */
export async function setReorderLevels(tx: Tx, storeId: string, input: ReorderLevelsInput): Promise<void> {
  const locationId = await mainLocationId(tx, storeId);
  for (const [index, item] of input.items.entries()) {
    const { count } = await tx.stockLevel.updateMany({ where: { variantId: item.variantId, locationId }, data: { reorderMin: item.min, reorderMax: item.max } });
    // Not tracked (or not this shop's): there's no count to reorder from.
    if (count === 0) throw new InvalidInputException({ [`items.${index}.variantId`]: "product_unavailable" });
  }
}

/** This shop's live option, or a 404-like refusal (another shop's id finds nothing under row-level security). */
async function ownVariant(tx: Tx, variantId: string): Promise<void> {
  const found = await tx.productVariant.findFirst({ where: { id: variantId, deletedAt: null, product: { deletedAt: null } }, select: { id: true, product: { select: { kind: true } } } });
  if (!found) throw new InvalidInputException({ variantId: "product_unavailable" });
  // A service has nothing on a shelf to count.
  if (found.product.kind === "service") throw new AppException(409, "action_not_allowed");
}

/**
 * Starts following many options at once (the Stock list's "Start tracking"),
 * all or nothing. One that's already tracked is skipped, not an error: two
 * people starting the same list never fail each other.
 */
export async function trackVariants(tx: Tx, context: { storeId: string; merchantId: string }, input: StockTrackManyInput): Promise<void> {
  const locationId = await mainLocationId(tx, context.storeId);
  const tracked = new Set(
    (await tx.stockLevel.findMany({ where: { locationId, variantId: { in: input.items.map((item) => item.variantId) } }, select: { variantId: true } })).map((level) => level.variantId),
  );
  for (const [index, item] of input.items.entries()) if (!tracked.has(item.variantId)) await trackVariant(tx, context, item, `items.${index}.unitCost`);
}

/**
 * Opening stock: starts following one option's stock from what's on the
 * shelf, written as an "opening stock" movement (no bill). With what one
 * cost, that cost starts the item's average — in the product's one cost
 * currency (another is refused under `costField`).
 */
export async function trackVariant(tx: Tx, context: { storeId: string; merchantId: string }, input: StockTrackInput, costField = "unitCost"): Promise<void> {
  await ownVariant(tx, input.variantId);
  const locationId = await mainLocationId(tx, context.storeId);
  const existing = await tx.stockLevel.findFirst({ where: { variantId: input.variantId, locationId }, select: { id: true } });
  if (existing) throw new AppException(409, "action_not_allowed");
  // Nothing on hand yet: the opening cost becomes the cost.
  const cost = input.unitCost !== undefined && input.costCurrency ? { minor: input.unitCost, currency: input.costCurrency } : null;
  if (cost) await applyPurchaseCost(tx, input.variantId, locationId, input.onHand, cost.minor, cost.currency, costField);
  await tx.stockLevel.create({ data: { storeId: context.storeId, variantId: input.variantId, locationId, onHand: input.onHand } });
  if (input.onHand > 0) {
    await tx.stockMovement.create({
      data: {
        storeId: context.storeId,
        variantId: input.variantId,
        locationId,
        type: "adjust_in",
        reason: "opening_stock",
        quantity: input.onHand,
        unitCostMinor: cost?.minor ?? null,
        costCurrency: cost?.currency ?? null,
        actorMerchantId: context.merchantId,
      },
    });
  }
}

/** Stops following one option's stock: it sells without a limit again. Its history stays. */
export async function untrackVariant(tx: Tx, storeId: string, variantId: string): Promise<void> {
  const locationId = await mainLocationId(tx, storeId);
  const { count } = await tx.stockLevel.deleteMany({ where: { variantId, locationId } });
  if (count === 0) throw new AppException(409, "action_not_allowed");
}

/** Takes stock away only while that much is free (one statement, like a sale), so a count never goes below zero. 0 = not taken. */
export async function takeFreeStock(tx: Tx, variantId: string, locationId: string, quantity: number): Promise<number> {
  return tx.$executeRaw`UPDATE stock_levels SET on_hand = on_hand - ${quantity}, updated_at = now()
    WHERE variant_id = ${variantId}::uuid AND location_id = ${locationId}::uuid AND on_hand - reserved >= ${quantity}`;
}

/**
 * A correction: stock found, or taken away (never below zero). Stock bought
 * in is a purchase (apps/api purchases), which also moves the average cost.
 */
export async function recordStockChange(tx: Tx, context: { storeId: string; merchantId: string }, input: StockChangeInput): Promise<void> {
  const locationId = await mainLocationId(tx, context.storeId);
  const count =
    input.type === "adjust_out"
      ? await takeFreeStock(tx, input.variantId, locationId, input.quantity)
      : (await tx.stockLevel.updateMany({ where: { variantId: input.variantId, locationId }, data: { onHand: { increment: input.quantity } } })).count;
  if (count === 0) {
    const tracked = await tx.stockLevel.findFirst({ where: { variantId: input.variantId, locationId }, select: { id: true } });
    // Not tracked: switch it on first. Tracked: there isn't that much to take away.
    if (!tracked) throw new AppException(409, "action_not_allowed");
    throw new InvalidInputException({ quantity: "not_enough_stock" });
  }
  await tx.stockMovement.create({
    data: {
      storeId: context.storeId,
      variantId: input.variantId,
      locationId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason ?? null,
      note: input.note ?? "",
      actorMerchantId: context.merchantId,
    },
  });
}

/**
 * A purchase's cost moves the option's cost to the moving average
 * (docs/blueprint.md "Cost price", level 2). Call it before the count goes
 * up: the average weighs what was on hand before. The option's row and its
 * count are locked first, so two purchases at once can't both average from
 * the same old numbers. The cost is in the product's one cost currency: a
 * purchase in the other one is refused under `field`.
 */
export async function applyPurchaseCost(tx: Tx, variantId: string, locationId: string, bought: number, unitCost: number, currency: Currency, field: string): Promise<void> {
  const [option] = await tx.$queryRaw<{ productId: string; costMinor: number | null; costCurrency: Currency | null }[]>`
    SELECT product_id AS "productId", cost_minor AS "costMinor", cost_currency AS "costCurrency"
      FROM product_variants WHERE id = ${variantId}::uuid FOR UPDATE`;
  if (!option) throw new InvalidInputException({ [field]: "product_unavailable" });
  const [level] = await tx.$queryRaw<{ onHand: number }[]>`
    SELECT on_hand AS "onHand" FROM stock_levels WHERE variant_id = ${variantId}::uuid AND location_id = ${locationId}::uuid FOR UPDATE`;
  const sibling = await tx.productVariant.findFirst({ where: { productId: option.productId, deletedAt: null, costCurrency: { not: null } }, select: { costCurrency: true } });
  const productCurrency = option.costCurrency ?? sibling?.costCurrency ?? null;
  if (productCurrency && productCurrency !== currency) throw new InvalidInputException({ [field]: "cost_currency_mismatch" });
  const average = movingAverageCost(level?.onHand ?? 0, option.costMinor, bought, unitCost);
  await tx.productVariant.update({ where: { id: variantId }, data: { costMinor: average, costCurrency: currency } });
}

/** The plan of the shop page's store, read through app_public_store_plan (buyers can't read subscriptions). */
export async function publicStorePlan(tx: Tx): Promise<PlanId> {
  const [row] = await tx.$queryRaw<{ plan: PlanId | null; status: SubscriptionStatus | null; beta_all_basic: boolean | null }[]>`SELECT * FROM app_public_store_plan()`;
  const subscription = row?.plan && row.status ? { plan: row.plan, status: row.status } : null;
  return planInForce(subscription, { betaAllBasic: row?.beta_all_basic ?? false }).plan;
}

/**
 * What the shop page's buyers may order of each tracked option: free stock at
 * the main branch, keyed by option. Options not in it aren't tracked. Empty
 * when the shop's plan doesn't follow stock.
 */
export async function readPublicStock(tx: Tx, storeId: string, plan: PlanId): Promise<Record<string, number>> {
  if (!tracksStock(plan)) return {};
  const location = await tx.stockLocation.findFirst({ where: { storeId, isMain: true }, select: { id: true } });
  if (!location) return {};
  const levels = await tx.stockLevel.findMany({ where: { locationId: location.id }, select: { variantId: true, onHand: true, reserved: true } });
  return Object.fromEntries(levels.map((level) => [level.variantId, Math.max(0, level.onHand - level.reserved)]));
}
