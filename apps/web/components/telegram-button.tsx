"use client";

import type { TelegramLoginPayload } from "@khmio/shared";
import { useEffect, useRef } from "react";
import { telegramLoginFromQuery, withoutTelegramLogin } from "@/lib/telegram-login";

export const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
/** The API refuses the development login in production too; this only hides the buttons. */
export const SHOW_DEV_LOGIN = process.env.NODE_ENV !== "production";

/**
 * Telegram's own "Log in with Telegram" button. It only works on the web
 * address set for the bot in @BotFather (/setdomain) — not on localhost.
 *
 * Redirect mode (data-auth-url): after the person agrees, Telegram brings
 * them back to this same page with the signed login in the address; we read
 * it, take it out of the address and hand it to onLogin. (The callback mode,
 * data-onauth, makes Telegram's script run code from a string — eval — which
 * the site's Content-Security-Policy rightly blocks.)
 */
export function TelegramButton({ onLogin }: { onLogin: (user: TelegramLoginPayload) => void }) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const login = telegramLoginFromQuery(url.searchParams);
    if (!login) return;
    window.history.replaceState(window.history.state, "", withoutTelegramLogin(url));
    onLogin(login);
  }, [onLogin]);

  useEffect(() => {
    if (!BOT_USERNAME || !holder.current) return;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-auth-url", withoutTelegramLogin(new URL(window.location.href)));
    holder.current.appendChild(script);
    const current = holder.current;
    return () => {
      current.innerHTML = "";
    };
  }, []);

  return <div ref={holder} className="flex min-h-[48px] justify-center" />;
}
