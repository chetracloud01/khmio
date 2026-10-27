import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createSystemDb, type SystemDb } from "@khmio/db";
import { stopButtonData } from "@khmio/shared";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { InlineButton, TelegramClient } from "../telegram/client";
import { deliverOutboxOnce } from "./outbox";
import { handleMembership, handleMessage, handleStopButton, startPayload } from "./telegram-links";

// Release 1's Telegram links on the real database: a one-time code links a
// staff group to its shop or a buyer's chat to their order — once, within 15
// minutes, never another shop's — and status updates reach the followers.

const ownerUrl = process.env.DATABASE_OWNER_URL;

class Recorder implements TelegramClient {
  readonly dryRun = false;
  sent: { chatId: string; text: string; buttons?: InlineButton[][] }[] = [];
  async sendMessage(chatId: string, text: string, buttons?: InlineButton[][]) {
    this.sent.push({ chatId, text, buttons });
  }
  async getUpdates(offset: number) {
    return { updates: [], nextOffset: offset };
  }
  async answerCallback() {}
  async editButtons() {}
}

describe("startPayload", () => {
  it("reads the code after /start, with or without the bot's name", () => {
    expect(startPayload("/start g_abc")).toBe("g_abc");
    expect(startPayload("/start@khmio_test_alerts_bot g_abc")).toBe("g_abc");
    expect(startPayload("/start")).toBe("");
    expect(startPayload("hello")).toBeNull();
  });
});

describe.skipIf(!ownerUrl)("Telegram links", () => {
  let db: SystemDb;
  const logger = pino({ level: "silent" });
  const run = randomUUID().slice(0, 8);
  const merchantId = randomUUID();
  const storeId = randomUUID();
  const otherStoreId = randomUUID();
  const groupChat = `-100${Date.now()}`;
  const buyerChat = `3${Date.now()}`.slice(0, 12);
  let orderId = "";

  /** A code as the API makes it: the plain code for the link, its hash in the table. */
  async function code(kind: "group_link" | "order_follow", extra: { storeId?: string; orderId?: string; expiresAt?: Date } = {}) {
    const plain = `${kind === "group_link" ? "g" : "f"}_${randomBytes(18).toString("base64url")}`;
    await db.telegramLinkCode.create({
      data: {
        kind,
        codeHash: createHash("sha256").update(plain).digest("hex"),
        storeId: extra.storeId ?? storeId,
        orderId: kind === "order_follow" ? (extra.orderId ?? orderId) : null,
        createdBy: merchantId,
        expiresAt: extra.expiresAt ?? new Date(Date.now() + 15 * 60_000),
      },
    });
    return plain;
  }
  const group = (text: string) => ({ chatId: groupChat, chatType: "supergroup" as const, chatTitle: "Shop staff", fromUserId: "1", text });
  const privateChat = (text: string) => ({ chatId: buyerChat, chatType: "private" as const, chatTitle: "", fromUserId: buyerChat, text });

  beforeAll(async () => {
    db = createSystemDb(ownerUrl as string);
    await db.merchant.create({ data: { id: merchantId, firstName: "Link test" } });
    await db.store.create({ data: { id: storeId, slug: `tl-test-${run}`, name: "Link shop", businessType: "shop", members: { create: { merchantId, role: "owner" } } } });
    await db.store.create({ data: { id: otherStoreId, slug: `tl-test-${run}-b`, name: "Other shop", businessType: "shop" } });
    const customer = await db.customer.create({ data: { storeId, phone: "855971234567", name: "Sokha" } });
    const order = await db.order.create({
      data: {
        storeId,
        customerId: customer.id,
        orderNumber: 1,
        publicToken: randomBytes(24).toString("base64url"),
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
        fulfilment: "delivery",
        area: "phnom_penh",
        buyerName: "Sokha",
        buyerPhone: "855971234567",
        idempotencyKey: randomUUID(),
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await db?.telegramLinkCode.deleteMany({ where: { storeId: { in: [storeId, otherStoreId] } } });
    await db?.outboxEvent.deleteMany({ where: { storeId } });
    await db?.order.deleteMany({ where: { storeId } });
    await db?.store.deleteMany({ where: { id: { in: [storeId, otherStoreId] } } });
    await db?.merchant.deleteMany({ where: { id: merchantId } });
    await db?.$disconnect();
  });

  it("links a staff group with its shop's code — once", async () => {
    const plain = await code("group_link");
    const first = await handleMessage(db, group(`/start@khmio_test_alerts_bot ${plain}`));
    expect(first.result).toBe("group_linked");
    expect(first.reply).toContain("Link shop");
    expect(await db.storeAlertChat.count({ where: { storeId, chatId: groupChat } })).toBe(1);
    expect((await handleMessage(db, group(`/start ${plain}`))).result).toBe("bad_code");
  });

  it("refuses an expired code, a made-up one, and a follow code used in a group", async () => {
    const expired = await code("group_link", { expiresAt: new Date(Date.now() - 1000) });
    expect((await handleMessage(db, group(`/start ${expired}`))).result).toBe("bad_code");
    expect((await handleMessage(db, group(`/start g_${"x".repeat(24)}`))).result).toBe("bad_code");
    const follow = await code("order_follow");
    expect((await handleMessage(db, group(`/start ${follow}`))).result).toBe("bad_code");
    expect(await db.storeAlertChat.count({ where: { chatId: groupChat } })).toBe(1);
  });

  it("sends new-order alerts to the linked group too", async () => {
    const event = await db.outboxEvent.create({ data: { storeId, kind: "order_placed", payload: { orderId } } });
    const telegram = new Recorder();
    await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
    expect(telegram.sent.some((message) => message.chatId === groupChat && message.text.includes("#1"))).toBe(true);
    expect((await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).sentAt).not.toBeNull();
  });

  it("lets a buyer follow their order, then sends status updates with a Stop button — never a phone number", async () => {
    const plain = await code("order_follow");
    const outcome = await handleMessage(db, privateChat(`/start ${plain}`));
    expect(outcome.result).toBe("following");
    expect(outcome.reply).toContain("#1");
    await db.outboxEvent.create({ data: { storeId, kind: "order_status_changed", payload: { orderId, status: "confirmed" } } });
    const telegram = new Recorder();
    await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
    const update = telegram.sent.find((message) => message.chatId === buyerChat);
    expect(update?.text).toContain("The shop accepted your order");
    expect(update?.text).not.toContain("971234567");
    expect(update?.buttons?.flat().some((button) => "callbackData" in button && button.callbackData === stopButtonData(orderId))).toBe(true);
  });

  it("says nothing for a status buyers don't hear about (waiting for a driver)", async () => {
    const event = await db.outboxEvent.create({ data: { storeId, kind: "order_status_changed", payload: { orderId, status: "waiting_for_driver" } } });
    const telegram = new Recorder();
    await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
    expect(telegram.sent.filter((message) => message.chatId === buyerChat)).toHaveLength(0);
    expect((await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).sentAt).not.toBeNull();
  });

  it("stops with the Stop button — only for that chat and order", async () => {
    expect(await handleStopButton(db, stopButtonData(orderId), "999")).toBe(false);
    expect(await handleStopButton(db, stopButtonData(orderId), buyerChat)).toBe(true);
    await db.outboxEvent.create({ data: { storeId, kind: "order_status_changed", payload: { orderId, status: "packing" } } });
    const telegram = new Recorder();
    await deliverOutboxOnce({ db, telegram, logger, webOrigin: "https://shop.example" });
    expect(telegram.sent.filter((message) => message.chatId === buyerChat)).toHaveLength(0);
  });

  it("answers /stop and a bare /start in a private chat", async () => {
    expect((await handleMessage(db, privateChat("/stop"))).result).toBe("stopped");
    expect((await handleMessage(db, privateChat("/start"))).result).toBe("hello");
    expect((await handleMessage(db, privateChat("what is this?"))).result).toBe("ignored");
  });

  it("unlinks a group when the bot is removed from it", async () => {
    expect(await handleMembership(db, { chatId: groupChat, status: "member" })).toBe(0);
    expect(await handleMembership(db, { chatId: groupChat, status: "kicked" })).toBe(1);
    expect(await db.storeAlertChat.count({ where: { chatId: groupChat } })).toBe(0);
  });
});
