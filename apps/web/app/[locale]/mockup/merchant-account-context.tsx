"use client";

import { loginMethodSchema, type LoginMethod } from "@khmio/shared";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

/**
 * One way into the merchant account. Stands in for the merchant_identities
 * table: method, the account on that method (Telegram @username, verified
 * phone 855…), and when it was linked.
 */
export interface LinkedLogin {
  method: LoginMethod;
  /** @username for Telegram, 855XXXXXXXX(X) for phone. */
  account: string;
  linkedAtIso: string;
}

interface MerchantAccountContextValue {
  hydrated: boolean;
  logins: LinkedLogin[];
  /** Sign-in and sign-up are the same: a verified login is added if it's new. */
  signIn: (login: Omit<LinkedLogin, "linkedAtIso">) => void;
  /** Callers check canUnlinkLoginMethod first — the last method can't be removed. */
  unlink: (method: LoginMethod) => void;
  telegramLogin: LinkedLogin | undefined;
}

const MerchantAccountContext = createContext<MerchantAccountContextValue | null>(null);

const STORAGE_KEY = "khmio:mockup-merchant-account";

function isLinkedLogin(value: unknown): value is LinkedLogin {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    loginMethodSchema.safeParse(record.method).success &&
    typeof record.account === "string" &&
    typeof record.linkedAtIso === "string"
  );
}

export function MerchantAccountProvider({ children }: { children: ReactNode }) {
  const [logins, setLogins] = useState<LinkedLogin[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setLogins(parsed.filter(isLinkedLogin));
    } catch {
      // Corrupt or inaccessible storage — start signed out.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logins));
    } catch {
      // Storage unavailable — logins just won't persist this time.
    }
  }, [logins, hydrated]);

  function signIn(login: Omit<LinkedLogin, "linkedAtIso">) {
    setLogins((prev) =>
      prev.some((existing) => existing.method === login.method)
        ? prev.map((existing) => (existing.method === login.method ? { ...existing, account: login.account } : existing))
        : [...prev, { ...login, linkedAtIso: new Date().toISOString() }],
    );
  }

  function unlink(method: LoginMethod) {
    setLogins((prev) => (prev.length > 1 ? prev.filter((login) => login.method !== method) : prev));
  }

  return (
    <MerchantAccountContext.Provider
      value={{ hydrated, logins, signIn, unlink, telegramLogin: logins.find((login) => login.method === "telegram") }}
    >
      {children}
    </MerchantAccountContext.Provider>
  );
}

export function useMerchantAccount(): MerchantAccountContextValue {
  const ctx = useContext(MerchantAccountContext);
  if (!ctx) throw new Error("useMerchantAccount must be used within a MerchantAccountProvider");
  return ctx;
}
