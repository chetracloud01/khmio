"use client";

import { deliverySettingsSchema, type DeliverySettings } from "@khmio/shared";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { mockDeliverySettings } from "@/mock/mock-data";

interface DeliverySettingsContextValue {
  /** False until saved data has been read — forms must wait for this before copying values into their own state. */
  hydrated: boolean;
  settings: DeliverySettings;
  /** Callers validate with deliverySettingsSchema first; saved values are always valid. */
  saveSettings: (settings: DeliverySettings) => void;
  /** Pickup is set on Shop details; saving it there doesn't count as setting up delivery. */
  savePickup: (pickup: DeliverySettings["pickup"]) => void;
  /** True once the seller has saved delivery settings themselves (the setup checklist's "Set delivery"). */
  configured: boolean;
  /**
   * A new shop keeps the suggested Phnom Penh zones and province fee to review,
   * but none of the sample shop's own details: no pickup address, no drivers.
   */
  startNewShop: () => void;
}

const DeliverySettingsContext = createContext<DeliverySettingsContextValue | null>(null);

// Switching locale changes the [locale] URL segment, which remounts this
// provider — localStorage is what survives that (and a page refresh).
const STORAGE_KEY = "khmio:mockup-delivery-settings";
const CONFIGURED_KEY = "khmio:mockup-delivery-configured";

/** Zones, pickup, provinces and drivers — stands in for the store's delivery tables. */
export function DeliverySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DeliverySettings>(mockDeliverySettings);
  const [configured, setConfigured] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setConfigured(window.localStorage.getItem(CONFIGURED_KEY) === "1");
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = deliverySettingsSchema.safeParse(JSON.parse(raw));
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
      if (configured) window.localStorage.setItem(CONFIGURED_KEY, "1");
    } catch {
      // Storage full or unavailable — changes just won't persist this time.
    }
  }, [settings, configured, hydrated]);

  function saveSettings(next: DeliverySettings) {
    setSettings(next);
    setConfigured(true);
  }

  function savePickup(pickup: DeliverySettings["pickup"]) {
    setSettings((current) => ({ ...current, pickup }));
  }

  function startNewShop() {
    setSettings({ ...mockDeliverySettings, pickup: { enabled: false, address: "", hours: "" }, drivers: [] });
    setConfigured(false);
    try {
      window.localStorage.removeItem(CONFIGURED_KEY);
    } catch {
      // Storage unavailable — nothing was saved to clear.
    }
  }

  return (
    <DeliverySettingsContext.Provider value={{ hydrated, settings, saveSettings, savePickup, configured, startNewShop }}>
      {children}
    </DeliverySettingsContext.Provider>
  );
}

export function useDeliverySettings(): DeliverySettingsContextValue {
  const ctx = useContext(DeliverySettingsContext);
  if (!ctx) throw new Error("useDeliverySettings must be used within a DeliverySettingsProvider");
  return ctx;
}
