import { merchantActor, type SystemDb, writeAudit } from "@khmio/db";
import { LINK_REPLIES, parseStopButton, TELEGRAM_LINK_CODE_PATTERN } from "@khmio/shared";
import { createHash } from "node:crypto";
import type { IncomingMessage, MembershipChange } from "../telegram/client";

// What the bot does with what people send it:
// - "/start g_…" in a group (Telegram sends it when the bot is added through
//   the shop's "Add to your staff group" link): links that group to that shop;
// - "/start f_…" in a private chat ("Get updates on Telegram"): the chat
//   follows that order;
// - "/stop" or the Stop button: no more order updates for that chat;
// - the bot removed from a group: the group stops getting alerts.
// Each code is checked by its hash, works once, and only for 15 minutes.

export type MessageOutcome =
  | { reply: string; result: "group_linked" | "following" | "stopped" | "bad_code" | "hello" }
  | { reply: null; result: "ignored" };

/** "/start CODE", "/start@bot_name CODE" → CODE (or "" for a bare /start); null for anything else. */
export function startPayload(text: string): string | null {
  const match = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/.exec(text.trim());
  return match ? (match[1] ?? "") : null;
}

async function takeCode(db: SystemDb, code: string, kind: "group_link" | "order_follow", now: Date) {
  if (!TELEGRAM_LINK_CODE_PATTERN.test(code)) return null;
  const codeHash = createHash("sha256").update(code).digest("hex");
  // Used once: only the update that marks it used gets it.
  const { count } = await db.telegramLinkCode.updateMany({ where: { codeHash, kind, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
  if (count === 0) return null;
  return db.telegramLinkCode.findUnique({ where: { codeHash } });
}

export async function handleMessage(db: SystemDb, message: IncomingMessage, now = new Date()): Promise<MessageOutcome> {
  const text = message.text.trim();
  const isGroup = message.chatType === "group" || message.chatType === "supergroup";

  if (message.chatType === "private" && /^\/stop(?:@\w+)?$/.test(text)) {
    await db.orderFollower.updateMany({ where: { chatId: message.chatId, stoppedAt: null }, data: { stoppedAt: now } });
    return { reply: LINK_REPLIES.stopped, result: "stopped" };
  }

  const code = startPayload(text);
  if (code === null) return { reply: null, result: "ignored" };
  if (code === "") return isGroup ? { reply: null, result: "ignored" } : { reply: LINK_REPLIES.hello, result: "hello" };

  if (isGroup) {
    const link = await takeCode(db, code, "group_link", now);
    if (!link) return { reply: LINK_REPLIES.badCode, result: "bad_code" };
    const store = await db.store.findUniqueOrThrow({ where: { id: link.storeId }, select: { name: true } });
    await db.storeAlertChat.upsert({
      where: { storeId_chatId: { storeId: link.storeId, chatId: message.chatId } },
      create: { storeId: link.storeId, chatId: message.chatId, title: message.chatTitle.slice(0, 120), linkedBy: link.createdBy },
      update: { title: message.chatTitle.slice(0, 120) },
    });
    // A staff-group code is always made by a merchant (only a buyer's follow link has no maker).
    const actor = link.createdBy ? merchantActor({ merchantId: link.createdBy, storeId: link.storeId }) : ({ actorType: "system", storeId: link.storeId } as const);
    await writeAudit(db, actor, {
      action: "store.telegram_group_linked",
      entity: "store",
      entityId: link.storeId,
      after: { title: message.chatTitle.slice(0, 120) },
    });
    return { reply: LINK_REPLIES.groupLinked(store.name), result: "group_linked" };
  }

  if (message.chatType !== "private") return { reply: null, result: "ignored" };
  const link = await takeCode(db, code, "order_follow", now);
  if (!link?.orderId) return { reply: LINK_REPLIES.badCode, result: "bad_code" };
  const order = await db.order.findUniqueOrThrow({ where: { id: link.orderId }, select: { orderNumber: true, store: { select: { name: true } } } });
  await db.orderFollower.upsert({
    where: { orderId_chatId: { orderId: link.orderId, chatId: message.chatId } },
    create: { storeId: link.storeId, orderId: link.orderId, chatId: message.chatId },
    update: { stoppedAt: null },
  });
  return { reply: LINK_REPLIES.following(order.store.name, order.orderNumber), result: "following" };
}

/** The Stop button under a buyer update: only that chat stops following that order. */
export async function handleStopButton(db: SystemDb, data: string, chatId: string | null, now = new Date()): Promise<boolean> {
  const orderId = parseStopButton(data);
  if (!orderId || !chatId) return false;
  const { count } = await db.orderFollower.updateMany({ where: { orderId, chatId, stoppedAt: null }, data: { stoppedAt: now } });
  return count > 0;
}

/** The bot was removed from a group (or the group blocked it): that group gets no more alerts. */
export async function handleMembership(db: SystemDb, change: MembershipChange): Promise<number> {
  if (change.status !== "left" && change.status !== "kicked") return 0;
  const { count } = await db.storeAlertChat.deleteMany({ where: { chatId: change.chatId } });
  return count;
}
