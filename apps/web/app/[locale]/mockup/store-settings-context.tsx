"use client";

import {
  bakongAccountIdSchema,
  clampExchangeRate,
  storeSettingsSchema,
  type ExchangeRateBand,
  type StoreSettings,
} from "@khmio/shared";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { mockStoreSettings } from "@/mock/mock-data";
import { useAdmin } from "./admin-context";
import { useMerchantProfile } from "./merchant-profile-context";

interface StoreSettingsContextValue {
  /** False until saved data has been read — forms must wait for this before copying values into their own state. */
  hydrated: boolean;
  settings: StoreSettings;
  /** Callers validate with storeSettingsSchema(band) first; saved values are always valid. */
  saveSettings: (settings: StoreSettings) => void;
  /** A new shop: the sample shop's currency and rate, cash on delivery on, and no VAT until the seller sets it. */
  startNewShop: () => void;
}

const StoreSettingsContext = createContext<StoreSettingsContextValue | null>(null);

// Switching locale changes the [locale] URL segment, which remounts this
// provider — localStorage is what survives that (and a page refresh).
const STORAGE_KEY = "khmio:mockup-store-settings";

/** Wide enough for any real rate; the admin's own band is applied on save and at checkout. */
const STORED_RATE_BAND: ExchangeRateBand = { min: 1000, max: 10000 };

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(mockStoreSettings);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = storeSettingsSchema(STORED_RATE_BAND).safeParse(JSON.parse(raw));
        if (stored.success) setSettings(stored.data);
      }
    } catch {
      // Corrupt or inaccessible storage (e.g. private browsing) — keep the defaults.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage full or unavailable — changes just won't persist this time.
    }
  }, [settings, hydrated]);

  return (
    <StoreSettingsContext.Provider
      value={{ hydrated, settings, saveSettings: setSettings, startNewShop: () => setSettings({ ...mockStoreSettings, vatPercent: 0 }) }}
    >
      {children}
    </StoreSettingsContext.Provider>
  );
}

/**
 * The store's selling settings plus the platform's allowed rate band (from
 * admin Settings) and the rate every total actually uses — the store's rate,
 * clamped to that band in case the admin narrowed it after the store saved.
 */
export function useStoreSettings() {
  const ctx = useContext(StoreSettingsContext);
  if (!ctx) throw new Error("useStoreSettings must be used within a StoreSettingsProvider");
  const { settings: adminSettings, hydrated: adminReady } = useAdmin();
  const band: ExchangeRateBand = { min: adminSettings.usdToKhrMin, max: adminSettings.usdToKhrMax };
  return {
    ...ctx,
    hydrated: ctx.hydrated && adminReady,
    band,
    rate: clampExchangeRate(ctx.settings.usdToKhrRate, band),
  };
}

/**
 * Which online payments this shop can take. KHQR needs the merchant's
 * Bakong account; ABA PayWay needs their own PayWay keys (added in Settings
 * once they have them — no screen for that yet). The built-in sample shop,
 * shown before anyone finishes onboarding, counts as fully set up.
 */
export function useStorePayments() {
  const { hasProfile, bakongId, hydrated } = useMerchantProfile();
  const isSample = !hasProfile;
  return {
    hydrated,
    khqrReady: isSample || bakongAccountIdSchema.safeParse(bakongId).success,
    payWayReady: isSample,
  };
}
