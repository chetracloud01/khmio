import { randomBytes, randomUUID } from "node:crypto";
import { createSystemDb, type SystemDb } from "@khmio/db";
import { confirmButtonData } from "@khmio/shared";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TelegramError, type InlineButton, type TelegramClient } from "../telegram/client";
import { deliverOutboxOnce, linksFromTelegram, MAX_ATTEMPTS, retryDelayMs } from "./outbox";
import { handleButton } from "./telegram-buttons";

// Step 6's Telegram alerts on the real database, with a pretend Telegram:
// a new order reaches the shop's people, a failed send is retried later, and
// only a member of the order's shop can confirm it from a button.

const ownerUrl = process.env.DATABASE_OWNER_URL;

export class FakeTelegram implements TelegramClient {
  readonly dryRun = false;
  sent: { chatId: string; text: string; buttons?: InlineButton[][] }[] = [];
  failing = false;
  /** Chats Telegram refuses for good ("chat not found"). */
  deadChats = new Set<string>();
  async sendMessage(chatId: string, text: string, buttons?: InlineButton[][]) {
    if (this.failing) throw new Error("telegram down");
    if (this.deadChats.has(chatId)) throw new TelegramError("sendMessage", 400, "Bad Request: chat not found");
    this.sent.push({ chatId, text, buttons });
  }
  async getUpdates(offset: number) {
    return { updates: [], nextOffset: offset };
  }
  async answerCallback() {}
  async editButtons() {}
}

describe("retryDelayMs", () => {
  it("waits longer after each failure, never more than an hour", () => {
    expect(retryDelayMs(1)).toBe(10_000);
    expect(retryDelayMs(3)).toBe(40_000);
    expect(retryDelayMs(30)).toBe(60 * 60_000);
  });
});

describe("linksFromTelegram", () => {
  it("allows only a public https address in a button", () => {
    expect(linksFromTelegram("https://shop.example")).toBe(true);
    expect(linksFromTelegram("http://localhost:3000")).toBe(false);
    expect(linksFromTelegram("https://localhost:3000")).toBe(false);
    expect(linksFromTelegram("http://shop.example")).toBe(false);
    expect(linksFromTelegram("https://192.168.40.39:3000")).toBe(false);
    expect(linksFromTelegram("not a url")).toBe(false);
  });
});

describe.skipIf(!ownerUrl)("Telegram alerts and buttons", () => {
  let db: SystemDb;
  const logger = pino({ level: "silent" });
  const run = randomUUID().slice(0, 8);
  const owner = randomUUID();
  const stranger = randomUUID();
  const storeId = randomUUID();
  const ownerTelegramId = `9${Date.now()}`.slice(0, 12);
  const strangerTelegramId = `8${Date.now()}`.slice(0, 12);
  let orderId = "";

  async function newOrder(status: "cod_pending" | "confirmed" = "cod_pending") {
    const customer = await db.customer.upsert({
      where: { storeId_phone: { storeId, phone: "855971234567" } },
      create: { storeId, phone: "855971234567", name: "Sokha" },
      update: {},
    });
    const count = await db.order.count({ where: { storeId } });
    const order = await db.order.create({
      data: {
        storeId,
        customerId: customer.id,
        orderNumber: count + 1,
        publicToken: randomBytes(24).toString("base64url"),
        status,
        paymentMethod: "cod",
        currency: "KHR",
        subtotalMinor: 46800,
        discountMinor: 0,
        deliveryFeeMinor: 4000,
        vatPercent: 0,
        vatMinor: 0,
        totalMinor: 50800,
        exchangeRateUsed: 4100,
        fulfilment: "delivery",
        area: "phnom_penh",
        districtId: "daun-penh",
        buyerName: "Sokha",
        buyerPhone: "855971234567",
        idempotencyKey: randomUUID(),
        items: { create: [{ storeId, variantId: randomUUID(), titleKm: "x", titleEn: "x", unitPriceMinor: 23400, quantity: 2, lineTotalMinor: 46800 }] },
      },
    });
    return order.id;
  }

  beforeAll(async () => {
    db = createSystemDb(ownerUrl as string);
    await db.merchant.create({ data: { id: owner, firstName: "Owner", identities: { create: { method: "telegram", providerUserId: ownerTelegramId } } } });
    await db.merchant.create({ data: { id: stranger, firstName: "Stranger", identities: { create: { method: "telegram", providerUserId: strangerTelegramId } } } });
    await db.store.create({ data: { id: storeId, slug: `tg-test-${run}`, name: "TG test", businessType: "shop", members: { create: { merchantId: owner, role: "owner" } } } });
    orderId = await newOrder();
  });

  afterAll(async () => {
    await db?.outboxEvent.deleteMany({ where: { storeId } });
    await db?.order.deleteMany({ where: { storeId } });
    await db?.store.deleteMany({ where: { id: storeId } });
    await db?.merchant.deleteMany({ where: { id: { in: [owner, stranger] } } });
    await db?.$disconnect();
  });

  it("sends a new-order alert to the shop's member, with Confirm and Open buttons, and marks it sent", async () => {
    const event = await db.outboxEvent.create({ data: { storeId, kind: "order_placed", payload: { orderId } } });
    const telegram = new FakeTelegram();
    await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
    const mine = telegram.sent.filter((message) => message.text.includes("50,800៛"));
    expect(mine).toHaveLength(1);
    expect(mine[0]?.chatId).toBe(ownerTelegramId);
    expect(mine[0]?.text).not.toContain("971234567");
    const buttons = mine[0]?.buttons?.flat() ?? [];
    expect(buttons.some((button) => "callbackData" in button && button.callbackData === confirmButtonData(orderId))).toBe(true);
    expect(buttons.some((button) => "url" in button && button.url === `https://shop.example/km/m/orders/${orderId}`)).toBe(true);
    expect((await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).sentAt).not.toBeNull();
  });

  it("keeps a message when Telegram fails, and tries again later", async () => {
    const event = await db.outboxEvent.create({ data: { storeId, kind: "order_placed", payload: { orderId } } });
    const telegram = new FakeTelegram();
    telegram.failing = true;
    await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
    const after = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(after.sentAt).toBeNull();
    expect(after.attempts).toBe(1);
    expect(after.lastError).toContain("telegram down");
    expect(after.availableAt.getTime()).toBeGreaterThan(Date.now());
    // Not picked up again before its time.
    telegram.failing = false;
    await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
    expect((await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).sentAt).toBeNull();
    expect(MAX_ATTEMPTS).toBeGreaterThan(1);
  });

  it("delivers to the chats that work, once, when another chat is gone for good", async () => {
    const deadChat = `7${Date.now()}`.slice(0, 12);
    await db.merchantIdentity.create({ data: { merchantId: owner, method: "telegram", providerUserId: deadChat } });
    const event = await db.outboxEvent.create({ data: { storeId, kind: "order_placed", payload: { orderId } } });
    const telegram = new FakeTelegram();
    telegram.deadChats.add(deadChat);
    await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
    await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
    expect(telegram.sent.filter((message) => message.chatId === ownerTelegramId && message.text.includes("50,800៛"))).toHaveLength(1);
    const after = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(after.sentAt).not.toBeNull();
    expect(after.lastError).toContain("chat not found");
    await db.merchantIdentity.deleteMany({ where: { providerUserId: deadChat } });
  });

  it("doesn't retry a message nobody can ever receive", async () => {
    const event = await db.outboxEvent.create({ data: { storeId, kind: "order_placed", payload: { orderId } } });
    const telegram = new FakeTelegram();
    telegram.deadChats.add(ownerTelegramId);
    await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
    const after = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(after.sentAt).not.toBeNull();
    expect(after.attempts).toBe(0);
  });

  it("sends admin alerts to the platform's alert chat, and raises one when a message gives up", async () => {
    const before = await db.platformSettings.findUniqueOrThrow({ where: { id: 1 }, select: { alertChatId: true } });
    const alertChat = `6${Date.now()}`.slice(0, 12);
    await db.platformSettings.update({ where: { id: 1 }, data: { alertChatId: alertChat } });
    try {
      // A message on its last try, failing for good reasons that may pass: it gives up and tells the admin.
      const doomed = await db.outboxEvent.create({ data: { storeId, kind: "order_placed", payload: { orderId }, attempts: MAX_ATTEMPTS - 1 } });
      const telegram = new FakeTelegram();
      telegram.failing = true;
      await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
      expect((await db.outboxEvent.findUniqueOrThrow({ where: { id: doomed.id } })).attempts).toBe(MAX_ATTEMPTS);
      const alert = await db.outboxEvent.findFirst({ where: { kind: "admin_alert", sentAt: null }, orderBy: { createdAt: "desc" } });
      expect(alert?.payload).toMatchObject({ reason: "message_gave_up", kind: "order_placed", attempts: MAX_ATTEMPTS });

      // The alert itself goes to the alert chat — not to the shop's people.
      telegram.failing = false;
      await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
      const toAdmin = telegram.sent.filter((message) => message.chatId === alertChat);
      expect(toAdmin.some((message) => message.text.includes("could not be sent"))).toBe(true);
      expect(telegram.sent.some((message) => message.chatId === ownerTelegramId && message.text.includes("could not be sent"))).toBe(false);
      await db.outboxEvent.deleteMany({ where: { kind: "admin_alert", payload: { path: ["kind"], equals: "order_placed" } } });
    } finally {
      await db.platformSettings.update({ where: { id: 1 }, data: { alertChatId: before.alertChatId } });
    }
  });

  it("keeps the give-up limit the admin overview counts with", () => {
    expect(MAX_ATTEMPTS).toBe(8);
  });

  it("lets only a member of the order's shop confirm it from Telegram", async () => {
    expect(await handleButton(db, { fromUserId: strangerTelegramId, data: confirmButtonData(orderId) })).toBe("not_member");
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("cod_pending");
    expect(await handleButton(db, { fromUserId: "123", data: confirmButtonData(orderId) })).toBe("not_member");
    expect(await handleButton(db, { fromUserId: ownerTelegramId, data: "delete:everything" })).toBe("unknown_button");

    expect(await handleButton(db, { fromUserId: ownerTelegramId, data: confirmButtonData(orderId) })).toBe("confirmed");
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { events: true } });
    expect(order.status).toBe("confirmed");
    expect(order.events.find((event) => event.status === "confirmed")?.actorMerchantId).toBe(owner);
    // A second press, or one after the dashboard moved it on, changes nothing.
    expect(await handleButton(db, { fromUserId: ownerTelegramId, data: confirmButtonData(orderId) })).toBe("already_moved");
  });

  it("refuses a button in a paused shop", async () => {
    const another = await newOrder();
    await db.subscription.create({ data: { storeId, plan: "free", status: "paused" } });
    expect(await handleButton(db, { fromUserId: ownerTelegramId, data: confirmButtonData(another) })).toBe("store_paused");
    expect((await db.order.findUniqueOrThrow({ where: { id: another } })).status).toBe("cod_pending");
    await db.subscription.delete({ where: { storeId } });
  });
});
