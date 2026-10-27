import { type Prisma, type Tx } from "@khmio/db";
import { startOfPhnomPenhDay, type DineTablesSave } from "@khmio/shared";
import { InvalidInputException } from "../errors";
import { orderItemSelect, toOrderItem } from "../orders/order-lines";

// Tables and kitchen (Features › tables), inside the seller's withContext:
// the shop's tables, the table a counter sale is for, and the Kitchen
// screen's list of what's still to make.

export async function readTables(tx: Tx) {
  return tx.dineTable.findMany({ select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

/** Saves the list as the page sent it: known ids keep their table (renamed in place), new ones added, the rest removed. */
export async function saveTables(tx: Tx, storeId: string, input: DineTablesSave) {
  const existing = new Set((await tx.dineTable.findMany({ select: { id: true } })).map((table) => table.id));
  const kept: string[] = [];
  for (const [sortOrder, table] of input.tables.entries()) {
    const data = { name: table.name, sortOrder };
    const id = existing.has(table.id)
      ? (await tx.dineTable.update({ where: { id: table.id }, data, select: { id: true } })).id
      : (await tx.dineTable.create({ data: { storeId, ...data }, select: { id: true } })).id;
    kept.push(id);
  }
  await tx.dineTable.deleteMany({ where: { id: { notIn: kept } } });
  return readTables(tx);
}

/** The name a counter sale copies for its table; a table that isn't this shop's is refused under `tableId`. */
export async function tableNameFor(tx: Tx, tableId: string): Promise<string> {
  const table = await tx.dineTable.findFirst({ where: { id: tableId }, select: { name: true } });
  if (!table) throw new InvalidInputException({ tableId: "required" });
  return table.name;
}

const kitchenOrderSelect = {
  id: true,
  orderNumber: true,
  channel: true,
  fulfilment: true,
  tableName: true,
  createdAt: true,
  items: { select: orderItemSelect, orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderSelect;

/**
 * The Kitchen screen: today's orders (Phnom Penh day) still to make, oldest
 * first — at the counter or online, not cancelled, and for an online order
 * only once the shop has it (confirmed or paid, never one still waiting for
 * payment or the seller's OK).
 */
export async function readKitchen(tx: Tx, now = new Date()) {
  const orders = await tx.order.findMany({
    where: {
      kitchenDoneAt: null,
      createdAt: { gte: startOfPhnomPenhDay(now) },
      status: { notIn: ["cancelled", "awaiting_payment", "cod_pending"] },
    },
    select: kitchenOrderSelect,
    orderBy: { createdAt: "asc" },
  });
  return orders.map(({ createdAt, items, ...order }) => ({
    ...order,
    createdAt: createdAt.toISOString(),
    // The kitchen needs what to make, never prices or the shop's own fields.
    items: items.map(toOrderItem).map(({ titleKm, titleEn, variantLabelKm, variantLabelEn, quantity, choices, note }) => ({ titleKm, titleEn, variantLabelKm, variantLabelEn, quantity, choices, note })),
  }));
}

/** "Done": the order leaves the Kitchen screen. False when it isn't this shop's or was already done. */
export async function markKitchenDone(tx: Tx, orderId: string, now = new Date()): Promise<boolean> {
  const { count } = await tx.order.updateMany({ where: { id: orderId, kitchenDoneAt: null }, data: { kitchenDoneAt: now } });
  return count > 0;
}
