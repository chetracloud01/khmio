import { randomBytes, randomUUID } from "node:crypto";
import { createSystemDb, type SystemDb } from "@khmio/db";
import type { PaymentProvider, PaymentStatusReport } from "@khmio/payments";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyPaymentDecision, checkPaymentsOnce } from "./payments";

// Step 5's payment checks on the real database, with a pretend bank: a code
// paid in full makes the order paid and its held stock a sale; one that runs
// out cancels the order and lets the stock go; a wrong amount or a bank that
// never answers is never paid and asks a person; the same answer twice
// changes nothing.

const ownerUrl = process.env.DATABASE_OWNER_URL;

/** A bank that answers what each test tells it to. */
class PretendBank implements PaymentProvider {
  readonly code = "bakong_khqr" as const;
  answers = new Map<string, PaymentStatusReport["reported"]>();
  async createPayment(): Promise<never> {
    throw new Error("not used by the worker");
  }
  async checkPayment(providerRef: string): Promise<PaymentStatusReport> {
    return { reported: this.answers.has(providerRef) ? (this.answers.get(providerRef) ?? null) : null, raw: { test: true } };
  }
}

describe.skipIf(!ownerUrl)("payment checks", () => {
  let db: SystemDb;
  const run = randomUUID().slice(0, 8);
  const merchantId = randomUUID();
  const storeId = randomUUID();
  const variant = randomUUID();
  let location = "";
  let orderNumber = 0;
  const logger = pino({ level: "silent" });
  const bank = new PretendBank();
  const madeAt = new Date("2026-10-27T03:00:00Z");
  const expiresAt = new Date(madeAt.getTime() + 10 * 60_000);

  /** A KHQR order for 1 item at 10,800៛, holding that item, with its pending code. */
  async function khqrOrder() {
    orderNumber += 1;
    const customer = await db.customer.create({ data: { storeId, phone: `8551${String(orderNumber).padStart(7, "0")}`, name: "Buyer" } });
    const order = await db.order.create({
      data: {
        storeId,
        customerId: customer.id,
        orderNumber,
        publicToken: randomBytes(24).toString("base64url"),
        status: "awaiting_payment",
        paymentMethod: "khqr",
        currency: "KHR",
        subtotalMinor: 10_800,
        discountMinor: 0,
        deliveryFeeMinor: 0,
        vatPercent: 0,
        vatMinor: 0,
        totalMinor: 10_800,
        exchangeRateUsed: 4100,
        fulfilment: "pickup",
        area: "phnom_penh",
        buyerName: "Buyer",
        buyerPhone: "85512345678",
        idempotencyKey: randomUUID(),
        stockReserved: true,
      },
    });
    await db.orderItem.create({ data: { storeId, orderId: order.id, variantId: variant, titleKm: "កាហ្វេ", titleEn: "Coffee", unitPriceMinor: 10_800, quantity: 1, lineTotalMinor: 10_800 } });
    await db.stockReservation.create({ data: { storeId, orderId: order.id, variantId: variant, locationId: location, quantity: 1 } });
    await db.stockLevel.updateMany({ where: { variantId: variant, locationId: location }, data: { reserved: { increment: 1 } } });
    const ref = randomBytes(16).toString("hex");
    await db.paymentAttempt.create({ data: { storeId, orderId: order.id, provider: "bakong_khqr", providerRef: ref, amountMinor: 10_800, currency: "KHR", createdAt: madeAt, expiresAt } });
    return { orderId: order.id, ref };
  }
  const attemptOf = (orderId: string) => db.paymentAttempt.findFirstOrThrow({ where: { orderId } });
  const orderOf = (orderId: string) => db.order.findUniqueOrThrow({ where: { id: orderId } });
  const level = () => db.stockLevel.findFirstOrThrow({ where: { variantId: variant, locationId: location }, select: { onHand: true, reserved: true } });
  const at = (seconds: number) => new Date(madeAt.getTime() + seconds * 1000);
  /** One round as the worker runs it, at that many seconds after the codes were made. */
  const check =(seconds: number) => checkPaymentsOnce({ db, provider: bank, logger, now: at(seconds) });

  beforeAll(async () => {
    db = createSystemDb(ownerUrl as string);
    await db.merchant.create({ data: { id: merchantId, firstName: `pay-${run}` } });
    await db.store.create({ data: { id: storeId, slug: `pay-check-${run}`, name: "Pay check", businessType: "shop", members: { create: { merchantId, role: "owner" } } } });
    const categoryId = randomUUID();
    await db.category.create({ data: { id: categoryId, storeId, nameKm: "ប្រភេទ", nameEn: "Category" } });
    await db.product.create({ data: { storeId, categoryId, titleKm: "កាហ្វេ", titleEn: "Coffee", variants: { create: { id: variant, storeId, sku: `SKU-${run}`, isDefault: true, priceKhr: 10_800 } } } });
    location = (await db.stockLocation.findFirstOrThrow({ where: { storeId, isMain: true } })).id;
    await db.stockLevel.create({ data: { storeId, variantId: variant, locationId: location, onHand: 5 } });
  });

  afterAll(async () => {
    await db?.outboxEvent.deleteMany({ where: { storeId } });
    await db?.order.deleteMany({ where: { storeId } });
    await db?.store.deleteMany({ where: { id: storeId } });
    await db?.merchant.deleteMany({ where: { id: merchantId } });
    await db?.$disconnect();
  });

  it("waits while nothing is paid, and doesn't ask again until it's due", async () => {
    const { orderId, ref } = await khqrOrder();
    await check(1);
    await check(2);
    const attempt = await attemptOf(orderId);
    expect([attempt.status, attempt.checkCount]).toEqual(["pending", 1]);
    expect((await orderOf(orderId)).status).toBe("awaiting_payment");
    bank.answers.set(ref, { currency: "KHR", amountMinor: 10_800 });
    await check(10);
  });

  it("makes an order paid in full paid, its held stock a sale, and alerts the seller", async () => {
    const [paid] = await db.paymentAttempt.findMany({ where: { storeId, status: "paid" } });
    expect(paid?.paidAt).not.toBeNull();
    const order = await orderOf(paid!.orderId);
    expect([order.status, order.stockReserved, order.stockTaken]).toEqual(["paid", false, true]);
    expect(await level()).toEqual({ onHand: 4, reserved: 0 });
    expect(await db.outboxEvent.count({ where: { storeId, kind: "order_placed" } })).toBe(1);
  });

  it("changes nothing when the same answer comes twice", async () => {
    const [paid] = await db.paymentAttempt.findMany({ where: { storeId, status: "paid" }, include: { order: { select: { status: true, orderNumber: true, store: { select: { slug: true } } } } } });
    await applyPaymentDecision(db, paid!, { kind: "paid" }, {}, at(20));
    expect(await db.orderStatusEvent.count({ where: { orderId: paid!.orderId, status: "paid" } })).toBe(1);
    expect(await level()).toEqual({ onHand: 4, reserved: 0 });
  });

  it("cancels an order whose code ran out unpaid, and lets its stock go", async () => {
    const { orderId } = await khqrOrder();
    expect(await level()).toEqual({ onHand: 4, reserved: 1 });
    await check(10 * 60);
    expect((await attemptOf(orderId)).status).toBe("expired");
    const order = await orderOf(orderId);
    expect([order.status, order.cancelReason, order.stockReserved]).toEqual(["cancelled", "payment_timeout", false]);
    expect(await level()).toEqual({ onHand: 4, reserved: 0 });
    expect(await db.outboxEvent.count({ where: { storeId, kind: "order_status_changed" } })).toBe(1);
  });

  it("never pays a wrong amount: a person is asked, and the order is cancelled", async () => {
    const { orderId, ref } = await khqrOrder();
    bank.answers.set(ref, { currency: "KHR", amountMinor: 10_000 });
    await check(30);
    const attempt = await attemptOf(orderId);
    expect([attempt.status, attempt.issue, attempt.issueStatus]).toEqual(["failed", "amount_mismatch", "open"]);
    expect((await orderOf(orderId)).status).toBe("cancelled");
    expect(await level()).toEqual({ onHand: 4, reserved: 0 });
    const alert = await db.outboxEvent.findFirst({ where: { kind: "admin_alert", payload: { path: ["orderNumber"], equals: orderNumber } }, orderBy: { createdAt: "desc" } });
    expect(alert?.payload).toMatchObject({ reason: "payment_issue", issue: "amount_mismatch" });
    await db.outboxEvent.deleteMany({ where: { id: alert!.id } });
  });

  it("retries a bank that doesn't answer, and asks a person once the code has run out", async () => {
    const { orderId, ref } = await khqrOrder();
    bank.answers.set(ref, "unreachable");
    await check(30);
    expect((await attemptOf(orderId)).status).toBe("pending");
    await check(10 * 60);
    const attempt = await attemptOf(orderId);
    expect([attempt.status, attempt.issue]).toEqual(["failed", "provider_unreachable"]);
    expect((await orderOf(orderId)).status).toBe("cancelled");
    await db.outboxEvent.deleteMany({ where: { kind: "admin_alert", payload: { path: ["orderNumber"], equals: orderNumber } } });
  });

  it("never pays an order that was cancelled while its code was still open", async () => {
    const { orderId, ref } = await khqrOrder();
    await db.order.update({ where: { id: orderId }, data: { status: "cancelled", cancelReason: "buyer_cancelled" } });
    bank.answers.set(ref, { currency: "KHR", amountMinor: 10_800 });
    await check(30);
    const attempt = await attemptOf(orderId);
    expect([attempt.status, attempt.issue]).toEqual(["failed", "paid_after_expiry"]);
    expect((await orderOf(orderId)).status).toBe("cancelled");
    await db.outboxEvent.deleteMany({ where: { kind: "admin_alert", payload: { path: ["orderNumber"], equals: orderNumber } } });
  });
});
