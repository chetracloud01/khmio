import type { Prisma, Tx } from "@khmio/db";
import { getBuyerStockState, LOW_STOCK_THRESHOLD, planHasFeature, type PlanId, type StockChangeInput, type StockTrackInput, type SubscriptionStatus } from "@khmio/shared";
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
  if (!row?.short) return;
  const index = Math.max(0, lineVariantIds.indexOf(row.short));
  throw new InvalidInputException({ [`lines.${index}`]: "sold_out" });
}

/** Puts back what an order took (cancelled order, voided counter sale). Nothing happens if it took nothing. */
export async function returnOrderStock(tx: Tx, orderId: string): Promise<void> {
  await tx.$executeRaw`SELECT app_return_order_stock(${orderId}::uuid)`;
}

const stockVariantSelect = {
  id: true,
  sku: true,
  labelKm: true,
  labelEn: true,
  isDefault: true,
  product: { select: { id: true, titleKm: true, titleEn: true } },
} satisfies Prisma.ProductVariantSelect;
type StockVariantRow = Prisma.ProductVariantGetPayload<{ select: typeof stockVariantSelect }>;

const stockMovementSelect = {
  id: true,
  variantId: true,
  type: true,
  quantity: true,
  reason: true,
  note: true,
  createdAt: true,
  order: { select: { id: true, orderNumber: true, channel: true } },
} satisfies Prisma.StockMovementSelect;
type StockMovementRow = Prisma.StockMovementGetPayload<{ select: typeof stockMovementSelect }>;

/** The Stock page: every live product option with its count (null = not tracked), and the latest changes. */
export function toStockPage(
  variants: StockVariantRow[],
  levels: { variantId: string; onHand: number; reserved: number }[],
  movements: StockMovementRow[],
  plan: PlanId,
) {
  const byVariant = new Map(levels.map((level) => [level.variantId, level]));
  return {
    /** Writes need Pro or Advance; on a lower plan the counts are shown, locked. */
    tracksStock: tracksStock(plan),
    lowAt: LOW_STOCK_THRESHOLD,
    items: variants.map((variant) => {
      const level = byVariant.get(variant.id);
      const state = level ? getBuyerStockState(true, level.onHand - level.reserved) : null;
      return {
        variantId: variant.id,
        productId: variant.product.id,
        titleKm: variant.product.titleKm,
        titleEn: variant.product.titleEn,
        optionKm: variant.isDefault ? "" : variant.labelKm,
        optionEn: variant.isDefault ? "" : variant.labelEn,
        sku: variant.sku,
        onHand: level ? level.onHand : null,
        low: state !== null && state.kind !== "in_stock",
      };
    }),
    movements: movements.map(({ createdAt, order, ...movement }) => ({
      ...movement,
      createdAt: createdAt.toISOString(),
      orderId: order?.id ?? null,
      orderNumber: order?.orderNumber ?? null,
      inStore: order?.channel === "in_store",
    })),
  };
}

export async function readStockPage(tx: Tx, storeId: string, plan: PlanId) {
  const location = await mainLocationId(tx, storeId);
  const [variants, levels, movements] = await Promise.all([
    tx.productVariant.findMany({
      where: { deletedAt: null, product: { deletedAt: null } },
      select: stockVariantSelect,
      orderBy: [{ product: { titleEn: "asc" } }, { sortOrder: "asc" }],
    }),
    tx.stockLevel.findMany({ where: { locationId: location }, select: { variantId: true, onHand: true, reserved: true } }),
    tx.stockMovement.findMany({ where: { locationId: location }, select: stockMovementSelect, orderBy: { createdAt: "desc" }, take: RECENT_MOVEMENTS }),
  ]);
  return toStockPage(variants, levels, movements, plan);
}

/** This shop's live option, or a 404-like refusal (another shop's id finds nothing under row-level security). */
async function ownVariant(tx: Tx, variantId: string): Promise<void> {
  const found = await tx.productVariant.findFirst({ where: { id: variantId, deletedAt: null, product: { deletedAt: null } }, select: { id: true } });
  if (!found) throw new InvalidInputException({ variantId: "product_unavailable" });
}

/** Starts following one option's stock from a count; the count is written as the first correction. */
export async function trackVariant(tx: Tx, context: { storeId: string; merchantId: string }, input: StockTrackInput): Promise<void> {
  await ownVariant(tx, input.variantId);
  const locationId = await mainLocationId(tx, context.storeId);
  const existing = await tx.stockLevel.findFirst({ where: { variantId: input.variantId, locationId }, select: { id: true } });
  if (existing) throw new AppException(409, "action_not_allowed");
  await tx.stockLevel.create({ data: { storeId: context.storeId, variantId: input.variantId, locationId, onHand: input.onHand } });
  if (input.onHand > 0) {
    await tx.stockMovement.create({
      data: { storeId: context.storeId, variantId: input.variantId, locationId, type: "adjust_in", reason: "count_correction", quantity: input.onHand, actorMerchantId: context.merchantId },
    });
  }
}

/** Stops following one option's stock: it sells without a limit again. Its history stays. */
export async function untrackVariant(tx: Tx, storeId: string, variantId: string): Promise<void> {
  const locationId = await mainLocationId(tx, storeId);
  const { count } = await tx.stockLevel.deleteMany({ where: { variantId, locationId } });
  if (count === 0) throw new AppException(409, "action_not_allowed");
}

/**
 * Stock arriving, or a correction. Taking away only succeeds while enough is
 * free (one statement, like a sale), so a count can never go below zero.
 */
export async function recordStockChange(tx: Tx, context: { storeId: string; merchantId: string }, input: StockChangeInput): Promise<void> {
  const locationId = await mainLocationId(tx, context.storeId);
  const count =
    input.type === "adjust_out"
      ? await tx.$executeRaw`UPDATE stock_levels SET on_hand = on_hand - ${input.quantity}, updated_at = now()
          WHERE variant_id = ${input.variantId}::uuid AND location_id = ${locationId}::uuid AND on_hand - reserved >= ${input.quantity}`
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
      reason: input.type === "purchase" ? null : (input.reason ?? null),
      note: input.note ?? "",
      actorMerchantId: context.merchantId,
    },
  });
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
