import type { Prisma, Tx } from "@khmio/db";
import { readCustomValues } from "../custom-fields/custom-fields";
import {
  cartLineKey,
  extraPriceIn,
  isServiceOnly,
  orderLineChoicesSchema,
  parseCartLineKey,
  pickChoices,
  unitCostIn,
  type ChoiceGroupFacts,
  type Currency,
  type FormErrorCode,
  type OrderLineChoice,
  type OrderLineInput,
  type OrderLineRequest,
  type OrderTotal,
} from "@khmio/shared";

// The lines of an online order or a counter sale, priced from the catalog —
// never from the browser: each product option, the choices picked for it
// (checked against its choice groups) and the buyer's note. Shared by
// place-order.ts and counter-sale.ts.

const orderVariantInclude = {
  product: {
    select: {
      titleKm: true,
      titleEn: true,
      discountPercent: true,
      kind: true,
      optionGroups: { where: { kind: "choice" }, orderBy: { sortOrder: "asc" }, include: { values: { orderBy: { sortOrder: "asc" } } } },
    },
  },
} satisfies Prisma.ProductVariantInclude;
type OrderVariant = Prisma.ProductVariantGetPayload<{ include: typeof orderVariantInclude }>;

export interface OrderLines {
  byId: Map<string, OrderVariant>;
  /** Each line's checked choices, by its key (cartLineKey). */
  picks: Map<string, ChoicePick[]>;
  /** Each line's note, by its key. */
  notes: Map<string, string>;
  /** Problems under each line: "product_unavailable", "choice_required", "choice_invalid". */
  errors: Record<string, FormErrorCode>;
  /** Every line is a service (services.ts): the order is a booking. */
  serviceOnly: boolean;
}
type ChoicePick = { group: ChoiceGroupFacts; value: ChoiceGroupFacts["values"][number] };

/**
 * Reads the product options the lines name, with whatever the caller's
 * database role may see (a buyer: visible products only; the seller: their
 * own, not deleted), and checks each line's choices. choicesOn = false (the
 * shop switched the module off): no choices are taken, and none are required.
 */
export async function readOrderLines(tx: Tx, lines: OrderLineRequest[], choicesOn: boolean): Promise<OrderLines> {
  const variants = await tx.productVariant.findMany({
    where: { id: { in: lines.map((line) => line.variantId) }, deletedAt: null, product: { deletedAt: null } },
    include: orderVariantInclude,
  });
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const picks = new Map<string, ChoicePick[]>();
  const notes = new Map<string, string>();
  const errors: Record<string, FormErrorCode> = {};
  lines.forEach((line, index) => {
    const variant = byId.get(line.variantId);
    if (!variant) {
      errors[`lines.${index}`] = "product_unavailable";
      return;
    }
    const key = cartLineKey(line.variantId, line.choiceIds);
    notes.set(key, line.note);
    if (!choicesOn) {
      if (line.choiceIds.length) errors[`lines.${index}`] = "choice_invalid";
      picks.set(key, []);
      return;
    }
    const picked = pickChoices(variant.product.optionGroups, line.choiceIds);
    if (picked.ok) picks.set(key, picked.picked);
    else errors[`lines.${index}`] = picked.problem;
  });
  // Every line's own product (one service may sit on two lines with different choices); a missing one isn't a service.
  const serviceOnly = isServiceOnly(lines.map((line) => byId.get(line.variantId)?.product.kind ?? "item"));
  return { byId, picks, notes, errors, serviceOnly };
}

/** The lines for computeOrderTotal: the option's prices and its choices' extras. Every line must be in `byId`. */
export function orderTotalLines(lines: OrderLineRequest[], read: OrderLines): OrderLineInput[] {
  return lines.flatMap((line) => {
    const variant = read.byId.get(line.variantId);
    const key = cartLineKey(line.variantId, line.choiceIds);
    if (!variant) return [];
    const extras = (read.picks.get(key) ?? []).map(({ value }) => ({ priceUsdCents: value.extraUsdCents, priceKhr: value.extraKhr }));
    return [{ key, quantity: line.quantity, priceUsdCents: variant.priceUsdCents, priceKhr: variant.priceKhr, discountPercent: variant.product.discountPercent, extras }];
  });
}

/** A saved order line as every page reads it (seller detail, order page, invoices). */
export const orderItemSelect = {
  id: true,
  variantId: true,
  titleKm: true,
  titleEn: true,
  variantLabelKm: true,
  variantLabelEn: true,
  unitPriceMinor: true,
  quantity: true,
  lineTotalMinor: true,
  choices: true,
  note: true,
  customValues: true,
} satisfies Prisma.OrderItemSelect;
type OrderItemRow = Prisma.OrderItemGetPayload<{ select: typeof orderItemSelect }>;

/** A saved line with its frozen choices and the shop's own fields read back through their schemas (written by this API). */
export function toOrderItem(item: OrderItemRow) {
  const choices = orderLineChoicesSchema.safeParse(item.choices);
  return { ...item, choices: choices.success ? choices.data : [], customValues: readCustomValues(item.customValues) };
}

/** A line as the buyer sees it: the shop's own fields (an IMEI, a plate number) stay with the shop. */
export function toBuyerOrderItem(item: OrderItemRow) {
  const { customValues: _private, ...line } = toOrderItem(item);
  return line;
}

/** The order's lines as saved: names, prices and choices copied, so the order never changes when the product does. */
export function orderItemRows(
  storeId: string,
  orderId: string,
  total: OrderTotal,
  read: OrderLines,
  money: { currency: Currency; usdToKhrRate: number },
): Prisma.OrderItemCreateManyInput[] {
  return total.lines.flatMap((line) => {
    const variant = read.byId.get(parseCartLineKey(line.key).variantId);
    if (!variant) return [];
    const choices: OrderLineChoice[] = (read.picks.get(line.key) ?? []).map(({ group, value }) => ({
      groupKm: group.nameKm,
      groupEn: group.nameEn || group.nameKm,
      labelKm: value.labelKm || value.labelEn,
      labelEn: value.labelEn || value.labelKm,
      extraMinor: extraPriceIn({ priceUsdCents: value.extraUsdCents, priceKhr: value.extraKhr }, money.currency, money.usdToKhrRate),
    }));
    return [
      {
        storeId,
        orderId,
        variantId: variant.id,
        titleKm: variant.product.titleKm,
        titleEn: variant.product.titleEn,
        variantLabelKm: variant.isDefault ? "" : variant.labelKm,
        variantLabelEn: variant.isDefault ? "" : variant.labelEn,
        unitPriceMinor: line.unitPrice,
        quantity: line.quantity,
        lineTotalMinor: line.lineTotal,
        // The cost frozen like the price, in the order's currency at its rate; no cost known = null ("cost missing").
        unitCostMinor: unitCostIn(variant, money.currency, money.usdToKhrRate) ?? null,
        choices,
        note: read.notes.get(line.key) ?? "",
      },
    ];
  });
}
