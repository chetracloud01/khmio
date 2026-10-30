import type { Prisma, Tx } from "@khmio/db";
import { phnomPenhDay, purchaseTotals, returnableQuantities, type PurchaseInput, type PurchaseReturnInput } from "@khmio/shared";
import { nextDocumentNumber } from "../documents/next-number";
import { AppException, InvalidInputException } from "../errors";
import { mainLocationId, takeFreeStock } from "../stock/stock";
import { readBillBalances, type BillBalance } from "./bill-balances";
import { billItemCosts } from "./bill-costs";
import { addBillToStock } from "./receive";
import { dateOf, dayOf } from "./purchase-days";
import { purchaseListSelect, toListedPurchase } from "./purchase-list";

// Supplier bills (docs/blueprint.md "Cost price", level 2+; design/screens.md
// S13), inside the seller's withContext. A purchase is one supplier bill in
// one currency: every line adds stock at the main branch and moves its
// option's cost to the moving average, all in one transaction; an option not
// tracked yet starts tracking from the bill. A bill is paid now (a payment of
// its total) or bought on credit, with the day it's due. Bills are never
// edited (the database refuses UPDATE and DELETE): a mistake is sent back
// with a return, which takes the stock away, leaves the average as it is and
// lowers what's owed.

export type Context = { storeId: string; merchantId: string };

// ── One purchase ───────────────────────────────────────────────────────────

const purchaseLineSelect = {
  variantId: true,
  quantity: true,
  unitCostMinor: true,
  lineTotalMinor: true,
  itemCostMinor: true,
  itemCostCurrency: true,
  variant: { select: { sku: true, isDefault: true, labelKm: true, labelEn: true, product: { select: { id: true, titleKm: true, titleEn: true } } } },
} satisfies Prisma.PurchaseLineSelect;
type PurchaseLineRow = Prisma.PurchaseLineGetPayload<{ select: typeof purchaseLineSelect }>;

const purchaseSelect = {
  ...purchaseListSelect,
  // The phone too, for the printed bill and payment voucher.
  supplier: { select: { id: true, name: true, phone: true } },
  exchangeRateUsed: true,
  note: true,
  createdAt: true,
  // Row security shows a merchant only themself: someone else's name reads as null.
  receivedBy: { select: { firstName: true } },
  lines: { select: purchaseLineSelect, orderBy: { id: "asc" } },
  returnedBy: { select: { id: true, number: true, purchasedOn: true, totalMinor: true, lines: { select: { variantId: true, quantity: true } } }, orderBy: { number: "asc" } },
  payments: { select: { id: true, number: true, paidOn: true, amountMinor: true, method: true, note: true, createdAt: true, voidedAt: true }, orderBy: { number: "asc" } },
} satisfies Prisma.PurchaseSelect;
type PurchaseRow = Prisma.PurchaseGetPayload<{ select: typeof purchaseSelect }>;

const toPurchaseLine = ({ variant, ...line }: PurchaseLineRow) => ({
  ...line,
  productId: variant.product.id,
  titleKm: variant.product.titleKm,
  titleEn: variant.product.titleEn,
  optionKm: variant.isDefault ? "" : variant.labelKm,
  optionEn: variant.isDefault ? "" : variant.labelEn,
  sku: variant.sku,
});

/** One bill (or return) with its lines, its returns, how much of each line may still go back, and its payments (voided ones too, marked). */
export function toPurchase({ note, createdAt, receivedBy, lines, returnedBy, payments, ...listed }: PurchaseRow, balance: BillBalance | undefined) {
  const left = returnableQuantities(lines, returnedBy.flatMap((entry) => entry.lines));
  return {
    ...toListedPurchase(listed, balance),
    /** 855…, or empty. */
    supplierPhone: listed.supplier?.phone ?? "",
    note,
    createdAt: createdAt.toISOString(),
    /** Who pressed Received (or saved it as received); null: not received, or not someone this merchant may see. */
    receivedByName: receivedBy?.firstName ?? null,
    lines: lines.map((line) => ({ ...toPurchaseLine(line), returnable: listed.kind === "purchase" ? Math.max(0, left.get(line.variantId) ?? 0) : 0 })),
    returnedBy: returnedBy.map(({ purchasedOn, lines: _lines, ...entry }) => ({ ...entry, purchasedOn: dayOf(purchasedOn) })),
    payments: payments.map(({ paidOn, createdAt: at, voidedAt, ...payment }) => ({ ...payment, paidOn: dayOf(paidOn), createdAt: at.toISOString(), voided: voidedAt !== null })),
  };
}

export async function readPurchase(tx: Tx, storeId: string, id: string, now = new Date()) {
  const purchase = await tx.purchase.findFirst({ where: { id, storeId }, select: purchaseSelect });
  if (!purchase) return null;
  const [balance] = purchase.kind === "purchase" ? await readBillBalances(tx, storeId, phnomPenhDay(now), purchase.id) : [];
  return toPurchase(purchase, balance);
}

// ── Saving a bill ──────────────────────────────────────────────────────────

/** The bill's options, each this shop's live item (a service has nothing to count), or the line's error. */
async function ownItems(tx: Tx, lines: readonly { variantId: string }[]): Promise<void> {
  const found = await tx.productVariant.findMany({
    where: { id: { in: lines.map((line) => line.variantId) }, deletedAt: null, product: { deletedAt: null, kind: "item" } },
    select: { id: true },
  });
  const live = new Set(found.map((variant) => variant.id));
  const missing = lines.findIndex((line) => !live.has(line.variantId));
  if (missing >= 0) throw new InvalidInputException({ [`lines.${missing}.variantId`]: "product_unavailable" });
}

/** A live supplier of this shop for a new bill, or the field's error. */
async function liveSupplier(tx: Tx, storeId: string, id: string | undefined): Promise<{ id: string; name: string } | null> {
  if (!id) return null;
  const supplier = await tx.supplier.findFirst({ where: { id, storeId, archivedAt: null }, select: { id: true, name: true } });
  if (!supplier) throw new InvalidInputException({ supplierId: "choice_invalid" });
  return supplier;
}

/**
 * Saves one supplier bill: numbers it and keeps each line with its cost in
 * its item's currency. Received (the goods are here), its lines go into
 * stock now and each item's average moves (receive.ts); not received yet,
 * that waits for "Received". Paid now, its total is paid on the bill's day;
 * bought on credit, it keeps the day it's due. The total is worked out here,
 * never taken from the screen. Returns the id.
 */
export async function createPurchase(tx: Tx, context: Context, input: PurchaseInput): Promise<string> {
  const { storeId } = context;
  const [supplier] = await Promise.all([liveSupplier(tx, storeId, input.supplierId), ownItems(tx, input.lines)]);
  const totals = purchaseTotals(input.lines);
  // Before anything is written: each line's cost in its item's currency (turned at the bill's rate where needed).
  const { costs, rateUsed } = await billItemCosts(tx, input);
  const number = await nextDocumentNumber(tx, storeId, "bill");
  const purchase = await tx.purchase.create({
    data: {
      storeId,
      number,
      supplierId: supplier?.id ?? null,
      billRef: input.billRef,
      purchasedOn: dateOf(input.purchasedOn),
      dueOn: !input.payment && input.dueOn ? dateOf(input.dueOn) : null,
      currency: input.currency,
      exchangeRateUsed: rateUsed,
      totalMinor: totals.total,
      note: input.note,
      createdById: context.merchantId,
      ...(input.received ? { receivedAt: new Date(), receivedById: context.merchantId } : {}),
      lines: {
        create: totals.lines.map((line, index) => ({
          storeId,
          variantId: line.variantId,
          quantity: line.quantity,
          unitCostMinor: line.unitCost,
          lineTotalMinor: line.lineTotal,
          itemCostMinor: costs[index]?.minor ?? line.unitCost,
          itemCostCurrency: costs[index]?.currency ?? input.currency,
        })),
      },
    },
    select: { id: true },
  });
  if (input.received) {
    await addBillToStock(tx, context, {
      id: purchase.id,
      note: input.note,
      supplierName: supplier?.name ?? "",
      lines: input.lines.map((line, index) => {
        const cost = costs[index] ?? { minor: line.unitCost, currency: input.currency };
        return { variantId: line.variantId, quantity: line.quantity, itemCostMinor: cost.minor, itemCostCurrency: cost.currency };
      }),
    });
  }
  // Paid on the spot: a payment of the whole bill (a free bill has nothing to pay).
  if (input.payment && totals.total > 0) {
    await tx.purchasePayment.create({
      data: {
        storeId,
        purchaseId: purchase.id,
        number: await nextDocumentNumber(tx, storeId, "payment"),
        paidOn: dateOf(input.purchasedOn),
        amountMinor: totals.total,
        method: input.payment.method,
        createdById: context.merchantId,
      },
    });
  }
  return purchase.id;
}

/**
 * Sends goods from one bill back to its supplier: never more of an option
 * than the bill brought in less earlier returns, and never more than is free
 * on the shelf. Stock goes down, valued at the bill's cost on the return's
 * lines; the average cost stays as it is; what the bill owes goes down. The
 * return is its own numbered record (RET-…). Returns its id.
 */
export async function createPurchaseReturn(tx: Tx, context: Context, purchaseId: string, input: PurchaseReturnInput): Promise<string> {
  const { storeId } = context;
  // First: taking the number holds the shop's return counter until this
  // transaction ends, so two returns at once can't both read the old
  // "still returnable" and send back more than the bill brought in.
  const number = await nextDocumentNumber(tx, storeId, "return");
  const bill = await tx.purchase.findFirst({
    where: { id: purchaseId, storeId, kind: "purchase" },
    select: {
      id: true,
      supplierId: true,
      billRef: true,
      currency: true,
      receivedAt: true,
      supplier: { select: { name: true } },
      lines: { select: { variantId: true, quantity: true, unitCostMinor: true, itemCostMinor: true, itemCostCurrency: true } },
      returnedBy: { select: { lines: { select: { variantId: true, quantity: true } } } },
    },
  });
  if (!bill) throw new AppException(404, "action_not_allowed");
  // Nothing on the shelf from it yet: goods go back only after they arrived.
  if (!bill.receivedAt) throw new AppException(409, "action_not_allowed");
  const left = returnableQuantities(bill.lines, bill.returnedBy.flatMap((entry) => entry.lines));
  const billLineOf = new Map(bill.lines.map((line) => [line.variantId, line]));
  const lines = input.lines.map((line, index) => {
    const billLine = billLineOf.get(line.variantId);
    if (!billLine) throw new InvalidInputException({ [`lines.${index}.variantId`]: "product_unavailable" });
    if (line.quantity > (left.get(line.variantId) ?? 0)) throw new InvalidInputException({ [`lines.${index}.quantity`]: "return_above_bought" });
    // Valued as bought: the bill's price, and the same cost in the item's currency.
    return { ...line, unitCost: billLine.unitCostMinor, itemCostMinor: billLine.itemCostMinor, itemCostCurrency: billLine.itemCostCurrency };
  });
  const locationId = await mainLocationId(tx, storeId);
  const totals = purchaseTotals(lines);
  const sent = await tx.purchase.create({
    data: {
      storeId,
      number,
      kind: "return",
      returnsId: bill.id,
      supplierId: bill.supplierId,
      billRef: bill.billRef,
      purchasedOn: dateOf(phnomPenhDay(new Date())),
      currency: bill.currency,
      totalMinor: totals.total,
      note: input.note,
      createdById: context.merchantId,
      // A return takes its stock off as it's saved: always received.
      receivedAt: new Date(),
      receivedById: context.merchantId,
      lines: {
        create: totals.lines.map((line) => ({
          storeId,
          variantId: line.variantId,
          quantity: line.quantity,
          unitCostMinor: line.unitCost,
          lineTotalMinor: line.lineTotal,
          itemCostMinor: line.itemCostMinor,
          itemCostCurrency: line.itemCostCurrency,
        })),
      },
    },
    select: { id: true },
  });
  for (const [index, line] of lines.entries()) {
    if ((await takeFreeStock(tx, line.variantId, locationId, line.quantity)) === 0) throw new InvalidInputException({ [`lines.${index}.quantity`]: "not_enough_stock" });
    await tx.stockMovement.create({
      data: {
        storeId,
        variantId: line.variantId,
        locationId,
        type: "adjust_out",
        reason: "supplier_return",
        quantity: line.quantity,
        // The cost stays on the return's line: a movement carries one only for stock bought in.
        supplier: bill.supplier?.name ?? "",
        purchaseId: sent.id,
        note: input.note,
        actorMerchantId: context.merchantId,
      },
    });
  }
  return sent.id;
}
