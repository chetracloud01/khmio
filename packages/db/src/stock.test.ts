import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asOrderBuyer, createAppDb, createSystemDb, withContext, withPublicStore, type AppDb, type SystemDb } from "./index";

// The stock migration on the real database: every shop gets a main branch;
// each shop's stock is its own; buyers read levels but never write them; the
// history can't be edited; an order takes stock only while enough is left —
// two at once can't both get the last one — and cancelling puts it back.

const appUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_OWNER_URL;

describe.skipIf(!appUrl || !ownerUrl)("stock", () => {
  let app: AppDb;
  let system: SystemDb;
  const run = randomUUID().slice(0, 8);
  const merchantA = randomUUID();
  const merchantB = randomUUID();
  const storeA = randomUUID();
  const storeB = randomUUID();
  const slugA = `stk-test-${run}-a`;
  const variant = randomUUID();
  let main = "";
  const token = () => randomBytes(24).toString("base64url");
  const asA = { merchantId: merchantA, storeId: storeA };

  /** A completed counter sale of `quantity`, as the seller (no customer, cash), then its stock taken. */
  async function sell(quantity: number) {
    return withContext(app, asA, async (tx) => {
      const { lastOrderNumber } = await tx.store.update({ where: { id: storeA }, data: { lastOrderNumber: { increment: 1 } }, select: { lastOrderNumber: true } });
      const order = await tx.order.create({
        data: {
          storeId: storeA,
          orderNumber: lastOrderNumber,
          channel: "in_store",
          publicToken: token(),
          status: "completed",
          paymentMethod: "cash",
          currency: "USD",
          subtotalMinor: 100 * quantity,
          discountMinor: 0,
          deliveryFeeMinor: 0,
          vatPercent: 0,
          vatMinor: 0,
          totalMinor: 100 * quantity,
          exchangeRateUsed: 4100,
          fulfilment: "in_store",
          area: "phnom_penh",
          buyerName: "",
          buyerPhone: "",
          cashReceivedMinor: 100 * quantity,
          changeMinor: 0,
          idempotencyKey: randomUUID(),
        },
      });
      await tx.orderItem.create({ data: { storeId: storeA, orderId: order.id, variantId: variant, titleKm: "កាហ្វេ", titleEn: "Coffee", unitPriceMinor: 100, quantity, lineTotalMinor: 100 * quantity } });
      const [row] = await tx.$queryRaw<{ short: string | null }[]>`SELECT app_take_order_stock(${order.id}::uuid) AS short`;
      if (row?.short) throw new Error("sold out");
      return order.id;
    });
  }
  const onHand = async () => (await system.stockLevel.findFirstOrThrow({ where: { variantId: variant, locationId: main } })).onHand;

  beforeAll(async () => {
    app = createAppDb(appUrl as string);
    system = createSystemDb(ownerUrl as string);
    for (const [merchantId, storeId, slug] of [
      [merchantA, storeA, slugA],
      [merchantB, storeB, `stk-test-${run}-b`],
    ] as const) {
      await system.merchant.create({ data: { id: merchantId, firstName: slug } });
      await system.store.create({ data: { id: storeId, slug, name: `Shop ${slug}`, businessType: "shop", members: { create: { merchantId, role: "owner" } } } });
    }
    const categoryId = randomUUID();
    await system.category.create({ data: { id: categoryId, storeId: storeA, nameKm: "ប្រភេទ", nameEn: "Category" } });
    await system.product.create({
      data: { storeId: storeA, categoryId, titleKm: "កាហ្វេ", titleEn: "Coffee", variants: { create: { id: variant, storeId: storeA, sku: `SKU-${run}`, isDefault: true, priceUsdCents: 100 } } },
    });
  });

  afterAll(async () => {
    await system?.order.deleteMany({ where: { storeId: { in: [storeA, storeB] } } });
    await system?.store.deleteMany({ where: { id: { in: [storeA, storeB] } } });
    await system?.merchant.deleteMany({ where: { id: { in: [merchantA, merchantB] } } });
    await app?.$disconnect();
    await system?.$disconnect();
  });

  it("gives every new shop one main branch", async () => {
    const locations = await withContext(app, asA, (tx) => tx.stockLocation.findMany({ where: { isMain: true } }));
    expect(locations).toHaveLength(1);
    main = locations[0]!.id;
  });

  it("lets the seller count stock, which another shop can't see", async () => {
    await withContext(app, asA, (tx) => tx.stockLevel.create({ data: { storeId: storeA, variantId: variant, locationId: main, onHand: 3 } }));
    const seenByB = await withContext(app, { merchantId: merchantB, storeId: storeB }, (tx) => tx.stockLevel.count({ where: { variantId: variant } }));
    expect(seenByB).toBe(0);
  });

  it("refuses a count below zero, whatever writes it", async () => {
    await expect(withContext(app, asA, (tx) => tx.stockLevel.updateMany({ where: { variantId: variant }, data: { onHand: -1 } }))).rejects.toThrow();
  });

  it("lets a buyer on the shop page read the count, never change it", async () => {
    const seen = await withPublicStore(app, slugA, (tx) => tx.stockLevel.findFirst({ where: { variantId: variant }, select: { onHand: true } }));
    expect(seen?.onHand).toBe(3);
    const changed = await withPublicStore(app, slugA, async (tx) => {
      await asOrderBuyer(tx, token());
      return tx.stockLevel.updateMany({ where: { variantId: variant }, data: { onHand: 99 } });
    });
    expect(changed?.count).toBe(0);
  });

  it("takes stock for a sale, and refuses one that needs more than is left", async () => {
    await sell(2);
    expect(await onHand()).toBe(1);
    await expect(sell(2)).rejects.toThrow("sold out");
    expect(await onHand()).toBe(1);
  });

  it("gives the last one to only one of two sales at the same moment", async () => {
    const results = await Promise.allSettled([sell(1), sell(1)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await onHand()).toBe(0);
  });

  it("puts stock back when a sale is undone, and keeps the history uneditable", async () => {
    await withContext(app, asA, (tx) => tx.stockLevel.updateMany({ where: { variantId: variant }, data: { onHand: { increment: 2 } } }));
    const sale = await sell(2);
    expect(await onHand()).toBe(0);
    await withContext(app, asA, (tx) => tx.$executeRaw`SELECT app_return_order_stock(${sale}::uuid)`);
    expect(await onHand()).toBe(2);
    const returned = await system.stockMovement.findFirst({ where: { orderId: sale, type: "adjust_in", reason: "returned" } });
    expect(returned?.quantity).toBe(2);
    await expect(withContext(app, asA, (tx) => tx.stockMovement.updateMany({ where: { orderId: sale }, data: { quantity: 9 } }))).rejects.toThrow();
  });
});
