import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asOrderBuyer, createAppDb, createSystemDb, withContext, withPublicStore, type AppDb, type SystemDb } from "./index";

// The payments_foundation migration on the real database: a KHQR order holds
// its stock (nothing leaves the shelf, but nobody else can have it); payment
// turns the hold into a sale; expiry or a cancel lets it go. A payment attempt
// is added by the buyer as pending, read only by its shop and its buyer, and
// changed by nobody using the app — only the worker (the owner) marks one
// paid, and an order is paid once.

const appUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_OWNER_URL;

describe.skipIf(!appUrl || !ownerUrl)("payments", () => {
  let app: AppDb;
  let system: SystemDb;
  const run = randomUUID().slice(0, 8);
  const merchantA = randomUUID();
  const merchantB = randomUUID();
  const storeA = randomUUID();
  const storeB = randomUUID();
  const slugA = `pay-test-${run}-a`;
  const variant = randomUUID();
  const asA = { merchantId: merchantA, storeId: storeA };
  let main = "";
  const token = () => randomBytes(24).toString("base64url");

  /** A buyer's KHQR order for `quantity`, its stock held, and its first payment attempt; as the shop page does it. */
  async function placeKhqrOrder(quantity: number): Promise<{ orderId: string; buyerToken: string }> {
    const buyerToken = token();
    const placed = await withPublicStore(app, slugA, async (tx) => {
      await asOrderBuyer(tx, buyerToken);
      const [customer] = await tx.$queryRaw<{ id: string }[]>`SELECT app_save_customer('85512345678', 'Buyer', 'phnom_penh'::"DeliveryArea", NULL, NULL, '') AS id`;
      const [number] = await tx.$queryRaw<{ n: number }[]>`SELECT app_next_order_number() AS n`;
      const order = await tx.order.create({
        data: {
          storeId: storeA,
          customerId: customer?.id ?? null,
          orderNumber: number?.n ?? 0,
          publicToken: buyerToken,
          status: "awaiting_payment",
          paymentMethod: "khqr",
          currency: "USD",
          subtotalMinor: 100 * quantity,
          discountMinor: 0,
          deliveryFeeMinor: 0,
          vatPercent: 0,
          vatMinor: 0,
          totalMinor: 100 * quantity,
          exchangeRateUsed: 4100,
          fulfilment: "pickup",
          area: "phnom_penh",
          buyerName: "Buyer",
          buyerPhone: "85512345678",
          idempotencyKey: randomUUID(),
        },
        select: { id: true },
      });
      await tx.orderItem.create({ data: { storeId: storeA, orderId: order.id, variantId: variant, titleKm: "កាហ្វេ", titleEn: "Coffee", unitPriceMinor: 100, quantity, lineTotalMinor: 100 * quantity } });
      const [row] = await tx.$queryRaw<{ short: string | null }[]>`SELECT app_reserve_order_stock(${order.id}::uuid) AS short`;
      if (row?.short) throw new Error("sold out");
      await tx.paymentAttempt.create({
        data: { storeId: storeA, orderId: order.id, provider: "bakong_khqr", providerRef: `md5-${randomUUID()}`, amountMinor: 100 * quantity, currency: "USD", expiresAt: new Date(Date.now() + 600_000) },
      });
      return order.id;
    });
    if (!placed) throw new Error("no shop");
    return { orderId: placed, buyerToken };
  }

  const level = () => system.stockLevel.findFirstOrThrow({ where: { variantId: variant, locationId: main }, select: { onHand: true, reserved: true } });
  const setOnHand = (onHand: number) => system.stockLevel.updateMany({ where: { variantId: variant, locationId: main }, data: { onHand } });

  beforeAll(async () => {
    app = createAppDb(appUrl as string);
    system = createSystemDb(ownerUrl as string);
    for (const [merchantId, storeId, slug] of [
      [merchantA, storeA, slugA],
      [merchantB, storeB, `pay-test-${run}-b`],
    ] as const) {
      await system.merchant.create({ data: { id: merchantId, firstName: slug } });
      await system.store.create({ data: { id: storeId, slug, name: `Shop ${slug}`, businessType: "shop", members: { create: { merchantId, role: "owner" } } } });
    }
    const categoryId = randomUUID();
    await system.category.create({ data: { id: categoryId, storeId: storeA, nameKm: "ប្រភេទ", nameEn: "Category" } });
    await system.product.create({
      data: { storeId: storeA, categoryId, titleKm: "កាហ្វេ", titleEn: "Coffee", variants: { create: { id: variant, storeId: storeA, sku: `SKU-${run}`, isDefault: true, priceUsdCents: 100 } } },
    });
    main = (await system.stockLocation.findFirstOrThrow({ where: { storeId: storeA, isMain: true } })).id;
    await system.stockLevel.create({ data: { storeId: storeA, variantId: variant, locationId: main, onHand: 2 } });
  });

  afterAll(async () => {
    await system?.order.deleteMany({ where: { storeId: { in: [storeA, storeB] } } });
    await system?.store.deleteMany({ where: { id: { in: [storeA, storeB] } } });
    await system?.merchant.deleteMany({ where: { id: { in: [merchantA, merchantB] } } });
    await app?.$disconnect();
    await system?.$disconnect();
  });

  it("holds a KHQR order's stock: nothing leaves the shelf, but the seller can't take it away", async () => {
    await placeKhqrOrder(2);
    expect(await level()).toEqual({ onHand: 2, reserved: 2 });
    // The Stock page's "remove stock" only takes what isn't held.
    const removed = await withContext(app, asA, (tx) => tx.$executeRaw`UPDATE stock_levels SET on_hand = on_hand - 1 WHERE variant_id = ${variant}::uuid AND on_hand - reserved >= 1`);
    expect(removed).toBe(0);
  });

  it("refuses to hold more than is free", async () => {
    await expect(placeKhqrOrder(1)).rejects.toThrow("sold out");
  });

  it("lets go of held stock when the order is cancelled before it's paid", async () => {
    const [held] = await system.stockReservation.findMany({ where: { variantId: variant }, select: { orderId: true } });
    await withContext(app, asA, (tx) => tx.$executeRaw`SELECT app_return_order_stock(${held!.orderId}::uuid)`);
    expect(await level()).toEqual({ onHand: 2, reserved: 0 });
    expect(await system.stockReservation.count({ where: { orderId: held!.orderId } })).toBe(0);
    expect((await system.order.findUniqueOrThrow({ where: { id: held!.orderId } })).stockReserved).toBe(false);
  });

  it("gives the last one to only one of two buyers at the same moment", async () => {
    await setOnHand(1);
    const results = await Promise.allSettled([placeKhqrOrder(1), placeKhqrOrder(1)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await level()).toEqual({ onHand: 1, reserved: 1 });
  });

  it("turns held stock into a sale when the worker confirms payment", async () => {
    const [held] = await system.stockReservation.findMany({ where: { variantId: variant }, select: { orderId: true } });
    await system.$executeRaw`SELECT app_settle_reserved_stock(${held!.orderId}::uuid)`;
    expect(await level()).toEqual({ onHand: 0, reserved: 0 });
    const order = await system.order.findUniqueOrThrow({ where: { id: held!.orderId } });
    expect([order.stockReserved, order.stockTaken]).toEqual([false, true]);
    expect(await system.stockMovement.count({ where: { orderId: held!.orderId, type: "sale", quantity: 1 } })).toBe(1);
  });

  it("lets go of held stock when the worker expires the code", async () => {
    await setOnHand(1);
    const { orderId } = await placeKhqrOrder(1);
    await system.$executeRaw`SELECT app_release_reserved_stock(${orderId}::uuid)`;
    expect(await level()).toEqual({ onHand: 1, reserved: 0 });
  });

  it("never lets the app's own user settle or release stock", async () => {
    const { orderId } = await placeKhqrOrder(1);
    await expect(withContext(app, asA, (tx) => tx.$executeRaw`SELECT app_settle_reserved_stock(${orderId}::uuid)`)).rejects.toThrow();
    await expect(withContext(app, asA, (tx) => tx.$executeRaw`SELECT app_release_reserved_stock(${orderId}::uuid)`)).rejects.toThrow();
    await system.$executeRaw`SELECT app_release_reserved_stock(${orderId}::uuid)`;
  });

  it("tells the shop page the shop's Bakong account only while KHQR is turned on", async () => {
    const account = () => withPublicStore(app, slugA, async (tx) => (await tx.$queryRaw<{ account: string | null }[]>`SELECT app_public_store_khqr_account() AS account`)[0]?.account ?? null);
    expect(await account()).toBeNull();
    await withContext(app, asA, (tx) => tx.storePaymentConfig.create({ data: { storeId: storeA, provider: "bakong_khqr", bakongAccountId: "srey@aclb", enabled: false } }));
    expect(await account()).toBeNull();
    await withContext(app, asA, (tx) => tx.storePaymentConfig.updateMany({ data: { enabled: true } }));
    expect(await account()).toBe("srey@aclb");
    // The rest of the shop's payment settings stay the seller's own.
    expect(await withPublicStore(app, slugA, (tx) => tx.storePaymentConfig.count())).toBe(0);
  });

  it("shows payment attempts to their shop only", async () => {
    const mine = await withContext(app, asA, (tx) => tx.paymentAttempt.count());
    const seenByB = await withContext(app, { merchantId: merchantB, storeId: storeB }, (tx) => tx.paymentAttempt.count());
    expect(mine).toBeGreaterThan(0);
    expect(seenByB).toBe(0);
  });

  it("never lets the app mark an attempt paid: not the seller, not the buyer", async () => {
    await setOnHand(5);
    const { orderId, buyerToken } = await placeKhqrOrder(1);
    await expect(withContext(app, asA, (tx) => tx.paymentAttempt.updateMany({ where: { orderId }, data: { status: "paid", paidAt: new Date() } }))).rejects.toThrow();
    await expect(
      withPublicStore(app, slugA, async (tx) => {
        await asOrderBuyer(tx, buyerToken);
        return tx.paymentAttempt.create({ data: { storeId: storeA, orderId, provider: "bakong_khqr", providerRef: `md5-${randomUUID()}`, amountMinor: 100, currency: "USD", status: "paid", paidAt: new Date(), expiresAt: new Date() } });
      }),
    ).rejects.toThrow();
  });

  it("pays an order once, and never reuses a provider's reference", async () => {
    const { orderId } = await placeKhqrOrder(1);
    const attempt = await system.paymentAttempt.findFirstOrThrow({ where: { orderId } });
    await system.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "paid", paidAt: new Date() } });
    await expect(
      system.paymentAttempt.create({ data: { storeId: storeA, orderId, provider: "bakong_khqr", providerRef: `md5-${randomUUID()}`, amountMinor: 100, currency: "USD", status: "paid", paidAt: new Date(), expiresAt: new Date() } }),
    ).rejects.toThrow();
    await expect(
      system.paymentAttempt.create({ data: { storeId: storeA, orderId, provider: "bakong_khqr", providerRef: attempt.providerRef, amountMinor: 100, currency: "USD", expiresAt: new Date() } }),
    ).rejects.toThrow();
  });
});
