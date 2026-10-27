"use client";

import { useEffect, useRef } from "react";

interface Turnstile {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

let loading: Promise<Turnstile> | null = null;
function loadTurnstile(): Promise<Turnstile> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile missing")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Cloudflare Turnstile: checks the buyer is a person, usually without them
 * seeing anything (it shows a box only when unsure). Each token works once,
 * so the checkout bumps `resetKey` after every attempt to get a fresh one.
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set (local).
 */
export function BotCheck({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const tokenHandler = useRef(onToken);
  tokenHandler.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    let cancelled = false;
    const element = box.current;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widget.current = turnstile.render(element, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: "interaction-only",
          size: "flexible",
          callback: (token: string) => tokenHandler.current(token),
          "expired-callback": () => tokenHandler.current(null),
          "error-callback": () => tokenHandler.current(null),
        });
      })
      .catch(() => tokenHandler.current(null));
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey === 0 || !widget.current) return;
    tokenHandler.current(null);
    window.turnstile?.reset(widget.current);
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} />;
}
