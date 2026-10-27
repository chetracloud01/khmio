import pino from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTelegramClient, TelegramError } from "./client";

const telegramAnswers = (body: unknown, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

const client = () => createTelegramClient("123:test-token", pino({ enabled: false }), "https://telegram.test");

describe("the Telegram client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the updates it knows and skips one of an unknown shape, still moving past it", async () => {
    vi.stubGlobal(
      "fetch",
      telegramAnswers({
        ok: true,
        result: [
          { update_id: 10, message: { chat: { id: 55, type: "private" }, from: { id: 7 }, text: "/start abc" } },
          // A member status Telegram may add one day: not one the bot knows.
          { update_id: 11, my_chat_member: { chat: { id: -100, type: "supergroup", title: "Staff" }, new_chat_member: { status: "promoted_somehow" } } },
          { update_id: 12, my_chat_member: { chat: { id: -100, type: "supergroup", title: "Staff" }, new_chat_member: { status: "left" } } },
        ],
      }),
    );
    const { updates, nextOffset } = await client().getUpdates(10, 0);
    expect(updates).toEqual([
      { type: "message", message: { chatId: "55", chatType: "private", chatTitle: "", fromUserId: "7", text: "/start abc" } },
      { type: "membership", change: { chatId: "-100", status: "left" } },
    ]);
    expect(nextOffset).toBe(13);
  });

  it("keeps the offset when there's nothing new", async () => {
    vi.stubGlobal("fetch", telegramAnswers({ ok: true, result: [] }));
    await expect(client().getUpdates(40, 0)).resolves.toEqual({ updates: [], nextOffset: 40 });
  });

  it("fails with Telegram's own description when it refuses", async () => {
    vi.stubGlobal("fetch", telegramAnswers({ ok: false, description: "Bad Request: chat not found" }, 400));
    const failure = await client().sendMessage("1", "hi").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TelegramError);
    expect(failure).toMatchObject({ message: "telegram sendMessage failed (400): Bad Request: chat not found" });
  });
});
