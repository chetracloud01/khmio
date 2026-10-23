import type { Logger } from "pino";
import { z } from "zod";

// Talking to Telegram (Bot API over HTTPS). Without a bot token the worker
// runs in dry run: every message it would send is recorded in the log
// instead — the texts never hold a phone number (packages/shared
// notifications.ts) — so alerts can be built and tested before a bot exists.

export type InlineButton = { text: string; callbackData: string } | { text: string; url: string };

export interface CallbackQuery {
  id: string;
  /** The Telegram user who pressed the button. */
  fromUserId: string;
  data: string;
  chatId: string | null;
  messageId: number | null;
}

/** A text message to the bot: /start with a code, /stop… */
export interface IncomingMessage {
  chatId: string;
  chatType: "private" | "group" | "supergroup" | "channel";
  chatTitle: string;
  fromUserId: string;
  text: string;
}

/** The bot was added to, or removed from, a chat. */
export interface MembershipChange {
  chatId: string;
  status: "member" | "administrator" | "left" | "kicked" | "restricted" | "creator";
}

export type TelegramUpdate = { type: "callback"; query: CallbackQuery } | { type: "message"; message: IncomingMessage } | { type: "membership"; change: MembershipChange };

export interface TelegramClient {
  readonly dryRun: boolean;
  sendMessage(chatId: string, text: string, buttons?: InlineButton[][]): Promise<void>;
  /** Long polling: waits up to `timeoutSeconds` for button presses, messages and membership changes after `offset`. */
  getUpdates(offset: number, timeoutSeconds: number): Promise<{ updates: TelegramUpdate[]; nextOffset: number }>;
  answerCallback(queryId: string, text: string): Promise<void>;
  /** Replaces a message's buttons (e.g. "Confirm" becomes "Confirmed"). */
  editButtons(chatId: string, messageId: number, buttons: InlineButton[][]): Promise<void>;
}

const toMarkup = (buttons: InlineButton[][]) => ({
  inline_keyboard: buttons.map((row) => row.map((button) => ("url" in button ? { text: button.text, url: button.url } : { text: button.text, callback_data: button.callbackData }))),
});

export class TelegramError extends Error {
  constructor(
    public readonly method: string,
    public readonly status: number,
    description: string,
  ) {
    // Telegram's description names the problem ("chat not found"); the token is never part of it.
    super(`telegram ${method} failed (${status}): ${description}`);
    this.name = "TelegramError";
  }
}

/** Every Bot API answer: ok, and the result or why not. */
const answerSchema = z.object({ ok: z.boolean().optional(), result: z.unknown(), description: z.string().optional() });

const chatSchema = z.object({ id: z.number(), type: z.enum(["private", "group", "supergroup", "channel"]), title: z.string().optional() });

/** The parts of an update the bot reads (allowed_updates in getUpdates). */
const updateSchema = z.object({
  update_id: z.number(),
  callback_query: z
    .object({ id: z.string(), from: z.object({ id: z.number() }), data: z.string().optional(), message: z.object({ message_id: z.number(), chat: z.object({ id: z.number() }) }).optional() })
    .optional(),
  message: z.object({ chat: chatSchema, from: z.object({ id: z.number() }).optional(), text: z.string().optional() }).optional(),
  my_chat_member: z
    .object({ chat: chatSchema, new_chat_member: z.object({ status: z.enum(["member", "administrator", "left", "kicked", "restricted", "creator"]) }) })
    .optional(),
});

class HttpTelegramClient implements TelegramClient {
  readonly dryRun = false;
  constructor(
    private readonly token: string,
    private readonly apiUrl: string,
  ) {}

  private async call(method: string, body: object, timeoutMs = 15_000): Promise<unknown> {
    const response = await fetch(`${this.apiUrl}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const answer = answerSchema.safeParse(await response.json().catch(() => ({})));
    const data = answer.success ? answer.data : {};
    if (!response.ok || !data.ok) throw new TelegramError(method, response.status, data.description ?? "no description");
    return data.result;
  }

  async sendMessage(chatId: string, text: string, buttons?: InlineButton[][]) {
    await this.call("sendMessage", { chat_id: chatId, text, ...(buttons ? { reply_markup: toMarkup(buttons) } : {}) });
  }

  async getUpdates(offset: number, timeoutSeconds: number) {
    const result = await this.call("getUpdates", { offset, timeout: timeoutSeconds, allowed_updates: ["callback_query", "message", "my_chat_member"] }, (timeoutSeconds + 10) * 1000);
    // Each update is read on its own: one of a shape the bot doesn't know is skipped, never retried forever.
    const raw = z.array(z.object({ update_id: z.number() }).passthrough()).parse(result);
    const updates = raw.flatMap((entry): TelegramUpdate[] => {
      const parsed = updateSchema.safeParse(entry);
      if (!parsed.success) return [];
      const update = parsed.data;
      const q = update.callback_query;
      if (q?.data) {
        return [{ type: "callback", query: { id: q.id, fromUserId: String(q.from.id), data: q.data, chatId: q.message ? String(q.message.chat.id) : null, messageId: q.message?.message_id ?? null } }];
      }
      const m = update.message;
      if (m?.text && m.from) {
        return [{ type: "message", message: { chatId: String(m.chat.id), chatType: m.chat.type, chatTitle: m.chat.title ?? "", fromUserId: String(m.from.id), text: m.text } }];
      }
      const c = update.my_chat_member;
      if (c) return [{ type: "membership", change: { chatId: String(c.chat.id), status: c.new_chat_member.status } }];
      return [];
    });
    const last = raw[raw.length - 1];
    return { updates, nextOffset: last ? last.update_id + 1 : offset };
  }

  async answerCallback(queryId: string, text: string) {
    await this.call("answerCallbackQuery", { callback_query_id: queryId, text });
  }

  async editButtons(chatId: string, messageId: number, buttons: InlineButton[][]) {
    await this.call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: toMarkup(buttons) });
  }
}

class DryRunTelegramClient implements TelegramClient {
  readonly dryRun = true;
  constructor(private readonly logger: Logger) {}

  async sendMessage(chatId: string, text: string, buttons?: InlineButton[][]) {
    // The chat id is a Telegram user id, not a phone number; only its last digits are shown all the same.
    this.logger.info({ chat: `…${chatId.slice(-3)}`, text, buttons: buttons?.flat().map((button) => button.text) }, "telegram dry run: would send");
  }

  async getUpdates(offset: number, timeoutSeconds: number) {
    // No bot, so nothing comes in: wait as long as a real poll would, then report nothing.
    await new Promise((resolve) => setTimeout(resolve, timeoutSeconds * 1000));
    return { updates: [], nextOffset: offset };
  }

  async answerCallback() {}
  async editButtons() {}
}

/** apiUrl: Telegram's Bot API (TELEGRAM_API_URL); only the end-to-end tests point it elsewhere. */
export function createTelegramClient(token: string | undefined, logger: Logger, apiUrl = "https://api.telegram.org"): TelegramClient {
  return token ? new HttpTelegramClient(token, apiUrl) : new DryRunTelegramClient(logger);
}
