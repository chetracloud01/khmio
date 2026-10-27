import { queueAdminAlert, type SystemDb } from "@khmio/db";
import { adminAlertSchema, adminAlertText, ALERT_BUTTONS, buyerCancelledAlert, buyerUpdateText, confirmButtonData, formatTrackingCode, newOrderAlert, STOP_BUTTON_LABEL, stopButtonData, type AdminAlert } from "@khmio/shared";
import type { Logger } from "pino";
import { TelegramError, type InlineButton, type TelegramClient } from "../telegram/client";

// Sends the messages the API wrote to outbox_events, in the same transaction
// as the change they report (docs/blueprint.md "Database schema", Platform).
// A message is leased before sending, so two workers never send it twice; a
// failed send is tried again later, waiting longer each time.

/** Messages handled per round. */
const BATCH = 20;
/** After this many failed tries a message is left alone (and stays visible in the table for the admin). */
export const MAX_ATTEMPTS = 8;
/** How long a leased message waits before another worker may try it, if this one stops mid-send. */
const LEASE_MS = 2 * 60_000;

/** 10 s, 20 s, 40 s … up to an hour. */
export function retryDelayMs(attempts: number): number {
  return Math.min(60 * 60_000, 10_000 * 2 ** Math.max(0, attempts - 1));
}

export interface OutboxDeps {
  db: SystemDb;
  telegram: TelegramClient;
  logger: Logger;
  /** The web app's address, for the "Open" button. */
  webOrigin: string;
}

interface Message {
  text: string;
  buttons?: InlineButton[][];
}

/** One round: takes the waiting messages, sends each to every member of its shop who logs in with Telegram. Returns how many were handled. */
export async function deliverOutboxOnce(deps: OutboxDeps): Promise<number> {
  const { db, logger } = deps;
  // Lease: mark the batch as taken for a while, in one short statement, before any network call.
  const leased = await db.$queryRaw<{ id: string; store_id: string | null; kind: string; payload: Record<string, unknown>; attempts: number }[]>`
    UPDATE outbox_events SET available_at = now() + ${`${LEASE_MS} milliseconds`}::interval
    WHERE id IN (
      SELECT id FROM outbox_events
      WHERE sent_at IS NULL AND available_at <= now() AND attempts < ${MAX_ATTEMPTS}
      ORDER BY created_at
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, store_id, kind, payload, attempts`;

  for (const event of leased) {
    try {
      const message = await buildMessage(deps, event.kind, event.payload);
      // Admin alerts → the platform's alert chat; a status change → the buyers following that order; the rest → the shop's people and groups.
      const chats = !message
        ? []
        : event.kind === "admin_alert"
          ? await alertChats(db)
          : event.kind === "order_status_changed"
            ? await followerChatsOf(db, String(event.payload.orderId ?? ""))
            : event.store_id
              ? await telegramChatsOf(db, event.store_id)
              : [];
      // Each person separately: one chat that can't be reached must not hold back — or repeat — everyone else's message.
      let delivered = 0;
      let lastFailure: unknown = null;
      let retryable = false;
      for (const chat of chats) {
        try {
          await deps.telegram.sendMessage(chat, message!.text, message!.buttons);
          delivered += 1;
        } catch (error) {
          lastFailure = error;
          if (!isPermanentRefusal(error)) retryable = true;
        }
      }
      // Try again later only if nobody got it and the reason may pass (Telegram down, rate limit).
      if (delivered === 0 && retryable) throw lastFailure;
      const note = !message ? "" : chats.length === 0 ? (event.kind === "admin_alert" ? "no alert chat set" : event.kind === "order_status_changed" ? "" : "no Telegram chat for this shop") : lastFailure instanceof Error ? `not delivered to every chat: ${lastFailure.message.slice(0, 200)}` : "";
      await db.outboxEvent.update({ where: { id: event.id }, data: { sentAt: new Date(), lastError: note } });
    } catch (error) {
      const attempts = event.attempts + 1;
      const reason = error instanceof Error ? error.message.slice(0, 300) : "unknown error";
      await db.outboxEvent.update({ where: { id: event.id }, data: { attempts, lastError: reason, availableAt: new Date(Date.now() + retryDelayMs(attempts)) } });
      logger.warn({ eventId: event.id, kind: event.kind, attempts, reason }, "outbox message not sent, will retry");
      // Given up for good: a person has to look (but an alert about an alert would loop).
      if (attempts >= MAX_ATTEMPTS && event.kind !== "admin_alert") {
        const orderId = typeof event.payload.orderId === "string" ? event.payload.orderId : null;
        const order = orderId ? await db.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } }) : null;
        const alert: AdminAlert = { reason: "message_gave_up", kind: event.kind, orderNumber: order?.orderNumber ?? null, attempts };
        await queueAdminAlert(db, alert);
      }
    }
  }
  return leased.length;
}

/** A public https address Telegram will open from a button — not localhost or a private network address. */
export function linksFromTelegram(webOrigin: string): boolean {
  try {
    const { protocol, hostname } = new URL(webOrigin);
    if (protocol !== "https:") return false;
    return !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/.test(hostname);
  } catch {
    return false;
  }
}

/**
 * Telegram said no for good: the chat doesn't exist, or the person blocked
 * the bot or never pressed Start (400/403). Trying again won't change that.
 */
export function isPermanentRefusal(error: unknown): boolean {
  return error instanceof TelegramError && (error.status === 400 || error.status === 403);
}

/** The Telegram chats of a shop: each member who logs in with Telegram (their chat with the bot), and the shop's staff groups. */
export async function telegramChatsOf(db: SystemDb, storeId: string): Promise<string[]> {
  const [identities, groups] = await Promise.all([
    db.merchantIdentity.findMany({ where: { method: "telegram", merchant: { memberships: { some: { storeId } } } }, select: { providerUserId: true } }),
    db.storeAlertChat.findMany({ where: { storeId }, select: { chatId: true } }),
  ]);
  return [...new Set([...identities.map((identity) => identity.providerUserId), ...groups.map((group) => group.chatId)])];
}

/** The buyers following an order on Telegram, who haven't pressed Stop. */
export async function followerChatsOf(db: SystemDb, orderId: string): Promise<string[]> {
  if (!/^[0-9a-f-]{36}$/.test(orderId)) return [];
  const followers = await db.orderFollower.findMany({ where: { orderId, stoppedAt: null }, select: { chatId: true } });
  return followers.map((follower) => follower.chatId);
}

/** The platform's alert chat (admin Settings), if one is set. */
export async function alertChats(db: SystemDb): Promise<string[]> {
  const settings = await db.platformSettings.findUnique({ where: { id: 1 }, select: { alertChatId: true } });
  return settings?.alertChatId ? [settings.alertChatId] : [];
}

/** The message for an outbox event, or null when there's nothing worth sending (a status buyers don't hear about). */
async function buildMessage(deps: OutboxDeps, kind: string, payload: Record<string, unknown>): Promise<Message | null> {
  if (kind === "admin_alert") return { text: adminAlertText(adminAlertSchema.parse(payload)) };
  if (kind === "order_status_changed") return buyerUpdate(deps, payload);
  const order = typeof payload.orderId === "string"
    ? await deps.db.order.findUnique({
        where: { id: payload.orderId },
        select: {
          id: true,
          orderNumber: true,
          trackingCode: true,
          status: true,
          totalMinor: true,
          currency: true,
          paymentMethod: true,
          fulfilment: true,
          districtId: true,
          provinceId: true,
          items: { select: { quantity: true } },
          store: { select: { slug: true } },
        },
      })
    : null;
  if (!order) throw new Error(`order for ${kind} not found`);
  // Telegram refuses a button that links to a private address (localhost on a developer's PC): leave "Open" out there.
  const open = linksFromTelegram(deps.webOrigin) ? [{ text: ALERT_BUTTONS.open, url: `${deps.webOrigin}/km/m/orders/${order.id}` }] : [];
  if (kind === "order_placed") {
    const text = newOrderAlert({
      ...order,
      trackingCode: formatTrackingCode(order.store.slug, order.trackingCode),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    });
    // "Confirm" only while the order still waits for it (it may have been confirmed in the dashboard meanwhile).
    const canConfirm = order.status === "cod_pending" || order.status === "paid";
    return {
      text,
      buttons: [[...(canConfirm ? [{ text: ALERT_BUTTONS.confirm, callbackData: confirmButtonData(order.id) }] : []), ...open]],
    };
  }
  if (kind === "order_cancelled_by_buyer") return { text: buyerCancelledAlert(order), buttons: open.length ? [open] : undefined };
  throw new Error(`unknown message kind ${kind}`);
}

/** A buyer's status message: the status the event recorded, with the driver or bus ticket once sent; a Stop button under it. */
async function buyerUpdate(deps: OutboxDeps, payload: Record<string, unknown>): Promise<Message | null> {
  const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
  const status = typeof payload.status === "string" ? payload.status : null;
  if (!orderId || !status) return null;
  const order = await deps.db.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      trackingCode: true,
      fulfilment: true,
      store: { select: { name: true, slug: true } },
      dispatches: { orderBy: { dispatchedAt: "desc" }, take: 1, select: { route: true, driverName: true, busCompany: true, ticketNumber: true } },
    },
  });
  if (!order) return null;
  const text = buyerUpdateText({
    orderNumber: order.orderNumber,
    shopName: order.store.name,
    status,
    fulfilment: order.fulfilment,
    dispatch: order.dispatches[0] ?? null,
    trackingCode: formatTrackingCode(order.store.slug, order.trackingCode),
  });
  return text ? { text, buttons: [[{ text: STOP_BUTTON_LABEL, callbackData: stopButtonData(orderId) }]] } : null;
}
