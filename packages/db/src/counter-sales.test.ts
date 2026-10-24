import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asOrderBuyer, createAppDb, createSystemDb, withContext, withPublicStore, type AppDb, type SystemDb } from "./index";

// The counter_sales migration's rules on the real database: a seller can save
// a sale at the counter in their own shop; the checks refuse a counter sale
// with a delivery fee, cash with the wrong change, or counter payments on an
// online order; a buyer on the shop page can never write one; and another
// shop never sees it.

const appUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_OWNER_URL;

describe.skipIf(!appUrl || !ownerUrl)("sales at the counter", () => {
  let app: AppDb;
  let system: SystemDb;
  const run = randomUUID().slice(0, 8);
  const merchantA = randomUUID();
  const merchantB = randomUUID();
  const storeA = randomUUID();
  const storeB = randomUUID();
  const slugA = `ctr-test-${run}-a`;
  const token = () => randomBytes(24).toString("base64url");

  async function seedStore(merchantId: string, storeId: string, slug: string) {
    await system.merchant.create({ data: { id: merchantId, firstName: slug } });
    await system.store.create({ data: { id: storeId, slug, name: `Shop ${slug}`, businessType: "shop", members: { create: { merchantId, role: "owner" } } } });
  }

  /** A cash sale of $5.23 with $10 given, as the counter API saves it; `overrides` breaks one rule. */
  const sale = (storeId: string, overrides: Record<string, unknown> = {}) => ({
    storeId,
    orderNumber: 1,
    channel: "in_store" as const,
    publicToken: token(),
    status: "completed" as const,
    paymentMethod: "cash" as const,
    currency: "USD" as const,
    subtotalMinor: 475,
    discountMinor: 0,
    deliveryFeeMinor: 0,
    vatPercent: 10,
    vatMinor: 48,
    totalMinor: 523,
    exchangeRateUsed: 4100,
    fulfilment: "in_store" as const,
    area: "phnom_penh" as const,
    buyerName: "",
    buyerPhone: "",
    cashReceivedMinor: 1000,
    changeMinor: 477,
    idempotencyKey: randomUUID(),
    ...overrides,
  });

  beforeAll(async () => {
    app = createAppDb(appUrl as string);
    system = createSystemDb(ownerUrl as string);
    await seedStore(merchantA, storeA, slugA);
    await seedStore(merchantB, storeB, `ctr-test-${run}-b`);
  });

  afterAll(async () => {
    await system?.order.deleteMany({ where: { storeId: { in: [storeA, storeB] } } });
    await system?.store.deleteMany({ where: { id: { in: [storeA, storeB] } } });
    await system?.merchant.deleteMany({ where: { id: { in: [merchantA, merchantB] } } });
    await app?.$disconnect();
    await system?.$disconnect();
  });

  it("lets the seller save a sale with no customer in their own shop, which another shop can't see", async () => {
    const order = await withContext(app, { merchantId: merchantA, storeId: storeA }, (tx) => tx.order.create({ data: { ...sale(storeA), soldByMerchantId: merchantA } }));
    expect(order.customerId).toBeNull();
    const seenByB = await withContext(app, { merchantId: merchantB, storeId: storeB }, (tx) => tx.order.count({ where: { id: order.id } }));
    expect(seenByB).toBe(0);
  });

  it("refuses a counter sale that breaks the rules, whatever writes it", async () => {
    const write = (overrides: Record<string, unknown>) =>
      withContext(app, { merchantId: merchantA, storeId: storeA }, (tx) => tx.order.create({ data: sale(storeA, { orderNumber: 99, ...overrides }) }));
    await expect(write({ deliveryFeeMinor: 100, totalMinor: 623, changeMinor: 377 })).rejects.toThrow();
    await expect(write({ changeMinor: 400 })).rejects.toThrow();
    await expect(write({ cashReceivedMinor: 500, changeMinor: -23 })).rejects.toThrow();
    await expect(write({ fulfilment: "pickup" })).rejects.toThrow();
    await expect(write({ paymentMethod: "cod", cashReceivedMinor: null, changeMinor: null })).rejects.toThrow();
  });

  it("refuses counter payments on an online order, and an online order with no customer", async () => {
    await expect(
      withContext(app, { merchantId: merchantA, storeId: storeA }, (tx) =>
        tx.order.create({ data: sale(storeA, { orderNumber: 98, channel: "online", fulfilment: "pickup", paymentMethod: "cash" }) }),
      ),
    ).rejects.toThrow();
  });

  it("never lets a buyer on the shop page write a counter sale", async () => {
    const buyerToken = token();
    await expect(
      withPublicStore(app, slugA, async (tx, storeId) => {
        await asOrderBuyer(tx, buyerToken);
        return tx.order.create({ data: sale(storeId, { orderNumber: 97, publicToken: buyerToken }) });
      }),
    ).rejects.toThrow();
  });
});
