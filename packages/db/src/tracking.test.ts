import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppDb, createSystemDb, type AppDb, type SystemDb } from "./index";

// "Track my order" on the real database (design/screens.md B8): every order
// gets a tracking code by itself, and the app finds an order's link only with
// its code AND the phone it was placed with — never with the code alone.

const appUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_OWNER_URL;

describe.skipIf(!appUrl || !ownerUrl)("tracking codes", () => {
  let app: AppDb;
  let system: SystemDb;
  const run = randomUUID().slice(0, 8);
  const merchantId = randomUUID();
  const storeId = randomUUID();
  const phone = "85512345678";
  const token = randomBytes(24).toString("base64url");
  let code = "";

  async function addOrder(orderNumber: number, publicToken: string, buyerPhone: string) {
    const customer = await system.customer.upsert({
      where: { storeId_phone: { storeId, phone: buyerPhone } },
      create: { storeId, phone: buyerPhone, name: "Sokha" },
      update: {},
    });
    return system.order.create({
      data: {
        storeId,
        customerId: customer.id,
        orderNumber,
        publicToken,
        status: "cod_pending",
        paymentMethod: "cod",
        currency: "USD",
        subtotalMinor: 100,
        discountMinor: 0,
        deliveryFeeMinor: 0,
        vatPercent: 0,
        vatMinor: 0,
        totalMinor: 100,
        exchangeRateUsed: 4100,
        fulfilment: "pickup",
        area: "phnom_penh",
        buyerName: "Sokha",
        buyerPhone,
        idempotencyKey: randomUUID(),
      },
      select: { trackingCode: true },
    });
  }

  const lookup = async (trackingCode: string, buyerPhone: string) => {
    const [row] = await app.$queryRaw<{ token: string | null }[]>`SELECT app_order_token_by_tracking(${trackingCode}, ${buyerPhone}) AS token`;
    return row?.token ?? null;
  };

  beforeAll(async () => {
    app = createAppDb(appUrl as string);
    system = createSystemDb(ownerUrl as string);
    await system.merchant.create({ data: { id: merchantId, firstName: "Tracking" } });
    await system.store.create({
      data: { id: storeId, slug: `track-test-${run}`, name: "Track test", businessType: "shop", members: { create: { merchantId, role: "owner" } } },
    });
    code = (await addOrder(1, token, phone)).trackingCode;
  });

  afterAll(async () => {
    await system?.order.deleteMany({ where: { storeId } });
    await system?.store.deleteMany({ where: { id: storeId } });
    await system?.merchant.deleteMany({ where: { id: merchantId } });
    await app?.$disconnect();
    await system?.$disconnect();
  });

  it("gives every new order an 8-character code without look-alikes, different each time", async () => {
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    const others = await Promise.all([2, 3, 4].map((n) => addOrder(n, randomBytes(24).toString("base64url"), "85597123456")));
    expect(new Set([code, ...others.map((order) => order.trackingCode)]).size).toBe(4);
  });

  it("finds the order's link with the code and the phone it was placed with", async () => {
    expect(await lookup(code, phone)).toBe(token);
  });

  it("finds nothing with the right code and another phone, or a made-up code", async () => {
    expect(await lookup(code, "85597123456")).toBeNull();
    expect(await lookup("ZZZZZZZZ", phone)).toBeNull();
  });

  it("never lets the app read orders by code directly — only through the lookup", async () => {
    // No store or order context: row-level security shows the app no orders at all.
    expect(await app.order.findMany({ where: { trackingCode: code } })).toHaveLength(0);
  });
});
