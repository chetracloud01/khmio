import type { SystemDb, Tx } from "@khmio/db";
import { phnomPenhDay, purchaseInputSchema, purchasePaymentInputSchema, purchaseReturnInputSchema, supplierInputSchema, type Currency, type PurchasePaymentMethod } from "@khmio/shared";
import { recordPurchasePayment } from "../purchases/payments";
import { createPurchase, createPurchaseReturn } from "../purchases/purchases";
import { archiveSupplier, createSupplier } from "../purchases/suppliers";
import { applyStockCount, saveStockCountLines, startStockCount } from "../stock/counts";
import { setReorderLevels } from "../stock/stock";

// The Demo Garage's stock (pnpm demo:garage; docs/blueprint.md "Garage
// first"): suppliers, about twenty parts tracked through real supplier bills
// over the last two months — paid now, part paid, unpaid, overdue, one in
// riel — a return, reorder levels and a stock count, so every Stock screen
// has something to show. Everything goes through the app's own functions
// (apps/api purchases and stock), so the data keeps every rule a seller's
// would. Stock needs Pro: the demo garage is put on it.

const DAY_MS = 86_400_000;
const day = (daysAgo: number) => phnomPenhDay(new Date(Date.now() - daysAgo * DAY_MS));

const SUPPLIERS = [
  { key: "chhay", name: "Chhay Auto Parts", phone: "012 345 678", note: "Brake pads, filters, wipers. Delivers Monday and Thursday." },
  { key: "angkor", name: "Angkor Tyres & Batteries", phone: "097 123 4567", note: "Tyres and batteries; 30 days credit." },
  { key: "lubes", name: "Phnom Penh Lubricants", phone: "015 222 333", note: "" },
  { key: "old", name: "Old Market Spares", phone: "", note: "Closed, kept for old bills." },
] as const;
type SupplierKey = (typeof SUPPLIERS)[number]["key"];

/** An item on a bill: the product's English title as it starts, which option (0 = the first or only), how many, and the cost of one. */
type DemoLine = { title: string; option?: number; quantity: number; cost: number };
type DemoBill = {
  supplier: SupplierKey;
  daysAgo: number;
  billRef: string;
  currency?: Currency;
  lines: DemoLine[];
  /** How it was paid on the day; left out: bought on credit. */
  paid?: PurchasePaymentMethod;
  /** On credit: due this many days after the bill. */
  dueAfter?: number;
  /** Paid later: this much, this many days ago. */
  laterPayment?: { amount: number; daysAgo: number; method: PurchasePaymentMethod };
};

const BILLS: DemoBill[] = [
  {
    supplier: "lubes",
    daysAgo: 55,
    billRef: "PPL-1182",
    paid: "cash",
    lines: [
      { title: "Castrol EDGE", option: 0, quantity: 12, cost: 2_900 },
      { title: "Castrol EDGE", option: 1, quantity: 6, cost: 10_500 },
      { title: "Shell Helix", quantity: 10, cost: 2_400 },
    ],
  },
  {
    supplier: "angkor",
    daysAgo: 48,
    billRef: "AT-2026-0931",
    paid: "bank",
    lines: [
      { title: "Michelin Primacy", option: 0, quantity: 8, cost: 7_800 },
      { title: "Michelin Primacy", option: 1, quantity: 4, cost: 9_200 },
      { title: "Bridgestone Dueler", quantity: 4, cost: 11_500 },
    ],
  },
  {
    supplier: "chhay",
    daysAgo: 40,
    billRef: "CAP-5521",
    paid: "khqr",
    lines: [
      { title: "Bosch front brake pads", option: 0, quantity: 6, cost: 2_400 },
      { title: "Bosch front brake pads", option: 1, quantity: 4, cost: 2_900 },
      { title: "Bosch wiper", option: 0, quantity: 10, cost: 650 },
      { title: "Toyota genuine oil filter", quantity: 15, cost: 450 },
      { title: "Engine air filter", quantity: 8, cost: 700 },
      { title: "NGK Iridium", quantity: 16, cost: 550 },
    ],
  },
  {
    supplier: "angkor",
    daysAgo: 30,
    billRef: "AT-2026-1044",
    dueAfter: 30,
    laterPayment: { amount: 20_000, daysAgo: 15, method: "bank" },
    lines: [
      { title: "Amaron Hi Life", option: 0, quantity: 4, cost: 6_200 },
      { title: "Amaron Hi Life", option: 1, quantity: 3, cost: 8_400 },
      { title: "GS", option: 0, quantity: 3, cost: 6_900 },
    ],
  },
  {
    // On credit, past its due day: shows as Overdue.
    supplier: "chhay",
    daysAgo: 25,
    billRef: "CAP-5602",
    dueAfter: 14,
    lines: [
      { title: "Bosch front brake pads", option: 2, quantity: 3, cost: 3_800 },
      { title: "Bosch front brake pads", option: 0, quantity: 4, cost: 2_500 },
    ],
  },
  {
    supplier: "chhay",
    daysAgo: 20,
    billRef: "CAP-5640",
    dueAfter: 30,
    lines: [
      { title: "5D car floor mats", option: 0, quantity: 3, cost: 3_200 },
      { title: "5D car floor mats", option: 1, quantity: 3, cost: 3_400 },
      { title: "Car perfume", quantity: 12, cost: 250 },
      { title: "70mai", quantity: 2, cost: 4_100 },
    ],
  },
  {
    // In riel: the engine oil sold by the litre is costed in riel.
    supplier: "lubes",
    daysAgo: 12,
    billRef: "PPL-1240",
    currency: "KHR",
    paid: "cash",
    lines: [{ title: "Engine oil from the", quantity: 40, cost: 13_500 }],
  },
  {
    supplier: "angkor",
    daysAgo: 5,
    billRef: "AT-2026-1102",
    paid: "khqr",
    lines: [{ title: "Michelin Primacy", option: 0, quantity: 4, cost: 8_200 }],
  },
];

/** Reorder levels: to reorder at the minimum, up to the maximum. */
const REORDER: (Pick<DemoLine, "title" | "option"> & { min: number; max: number })[] = [
  { title: "Bosch front brake pads", option: 0, min: 6, max: 16 },
  { title: "Bosch front brake pads", option: 1, min: 4, max: 10 },
  { title: "Amaron Hi Life", option: 0, min: 2, max: 6 },
  { title: "Michelin Primacy", option: 0, min: 8, max: 16 },
  { title: "Castrol EDGE", option: 0, min: 6, max: 18 },
  { title: "70mai", min: 1, max: 3 },
  { title: "Bosch wiper", option: 0, min: 4, max: 12 },
];

/** A stock count with differences: some went to jobs without a sale, one dash cam is gone, a wiper box turned up. */
const COUNT: (Pick<DemoLine, "title" | "option"> & { counted: number })[] = [
  { title: "Bosch front brake pads", option: 0, counted: 5 },
  { title: "Bosch wiper", option: 0, counted: 11 },
  { title: "70mai", counted: 0 },
  { title: "Castrol EDGE", option: 0, counted: 5 },
  { title: "Michelin Primacy", option: 0, counted: 7 },
];

/** A product option by the product's English title (as it starts) and its place among the options. */
async function findVariant(tx: Tx, storeId: string, title: string, option = 0): Promise<string> {
  const variants = await tx.productVariant.findMany({
    where: { deletedAt: null, product: { storeId, deletedAt: null, titleEn: { startsWith: title, mode: "insensitive" } } },
    orderBy: [{ product: { titleEn: "asc" } }, { sortOrder: "asc" }],
    select: { id: true },
  });
  const variant = variants[option];
  if (!variant) throw new Error(`demo stock: no product "${title}" option ${option}`);
  return variant.id;
}

/**
 * Fills the Demo Garage's stock, once: does nothing if the shop already has
 * suppliers (so running it again never doubles anything). Returns whether it
 * filled.
 */
export async function fillGarageStock(db: SystemDb, storeId: string): Promise<boolean> {
  if ((await db.supplier.count({ where: { storeId } })) > 0) return false;
  const owner = await db.storeMember.findFirst({ where: { storeId }, select: { merchantId: true }, orderBy: { createdAt: "asc" } });
  if (!owner) throw new Error("demo stock: the shop has no owner");
  const context = { storeId, merchantId: owner.merchantId };
  await db.subscription.update({ where: { storeId }, data: { plan: "pro", status: "active" } });

  await db.$transaction(
    async (tx) => {
      const supplierIds = new Map<SupplierKey, string>();
      for (const supplier of SUPPLIERS) supplierIds.set(supplier.key, (await createSupplier(tx, storeId, supplierInputSchema.parse(supplier))).id);
      const lineOf = async (line: DemoLine) => ({ variantId: await findVariant(tx, storeId, line.title, line.option), quantity: line.quantity, unitCost: line.cost });

      const billIds: string[] = [];
      for (const bill of BILLS) {
        const lines = [];
        for (const line of bill.lines) lines.push(await lineOf(line));
        const input = purchaseInputSchema.parse({
          supplierId: supplierIds.get(bill.supplier),
          billRef: bill.billRef,
          purchasedOn: day(bill.daysAgo),
          currency: bill.currency ?? "USD",
          lines,
          ...(bill.paid ? { payment: { method: bill.paid } } : bill.dueAfter !== undefined ? { dueOn: day(bill.daysAgo - bill.dueAfter) } : {}),
        });
        const id = await createPurchase(tx, context, input);
        billIds.push(id);
        if (bill.laterPayment) {
          const payment = purchasePaymentInputSchema.parse({ amount: bill.laterPayment.amount, paidOn: day(bill.laterPayment.daysAgo), method: bill.laterPayment.method, note: "First half" });
          await recordPurchasePayment(tx, context, id, payment);
        }
      }

      // One tyre went back: the wrong size.
      const tyresBill = billIds[1];
      if (tyresBill) {
        const back = purchaseReturnInputSchema.parse({ lines: [{ variantId: await findVariant(tx, storeId, "Michelin Primacy", 1), quantity: 1 }], note: "Wrong size" });
        await createPurchaseReturn(tx, context, tyresBill, back);
      }

      const levels = [];
      for (const level of REORDER) levels.push({ variantId: await findVariant(tx, storeId, level.title, level.option), min: level.min, max: level.max });
      await setReorderLevels(tx, storeId, { items: levels });

      // A shelf count, applied: CNT-0001 in the Count tab's list, its corrections in the history.
      const lines = [];
      for (const entry of COUNT) lines.push({ variantId: await findVariant(tx, storeId, entry.title, entry.option), counted: entry.counted });
      const countId = await startStockCount(tx, context, { categoryIds: [], note: "" });
      await saveStockCountLines(tx, context, countId, { lines });
      await applyStockCount(tx, context, countId);

      // The closed supplier: archived, kept for old bills.
      const old = supplierIds.get("old");
      if (old) await archiveSupplier(tx, storeId, old, true);
    },
    { timeout: 60_000 },
  );
  return true;
}
