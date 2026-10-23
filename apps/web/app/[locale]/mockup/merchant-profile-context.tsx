"use client";

import {
  businessTypeSchema,
  deliveryAreaSchema,
  invoiceDetailsSchema,
  shopMapUrlSchema,
  type BusinessType,
  type DeliveryArea,
  type InvoiceDetails,
} from "@khmio/shared";
import { createContext, useContext, useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

export type ShopArea = DeliveryArea;

interface MerchantProfileContextValue {
  /** False until saved data has been read — forms must wait for this before copying values into their own state. */
  hydrated: boolean;
  businessType: BusinessType;
  setBusinessType: Dispatch<SetStateAction<BusinessType>>;
  shopName: string;
  setShopName: Dispatch<SetStateAction<string>>;
  slug: string;
  setSlug: Dispatch<SetStateAction<string>>;
  logoDataUrl: string | null;
  setLogoDataUrl: Dispatch<SetStateAction<string | null>>;
  bakongId: string;
  setBakongId: Dispatch<SetStateAction<string>>;
  telegramConnected: boolean;
  setTelegramConnected: Dispatch<SetStateAction<boolean>>;
  phone: string;
  setPhone: Dispatch<SetStateAction<string>>;
  area: ShopArea;
  setArea: Dispatch<SetStateAction<ShopArea>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  /** Copied from Google Maps; the buyer's Map button opens it (design/screens.md S10). */
  mapUrl: string;
  setMapUrl: Dispatch<SetStateAction<string>>;
  /** "On your invoices": VAT TIN, Telegram, Facebook, note. */
  invoiceDetails: InvoiceDetails;
  setInvoiceDetails: Dispatch<SetStateAction<InvoiceDetails>>;
  /** True once the seller has copied or shared the shop link (the setup checklist's last step). */
  linkShared: boolean;
  setLinkShared: Dispatch<SetStateAction<boolean>>;
  /** False until onboarding has saved a profile at least once in this browser. */
  hasProfile: boolean;
}

const MerchantProfileContext = createContext<MerchantProfileContextValue | null>(null);

// Switching locale changes the [locale] URL segment, which remounts this
// provider — localStorage is what survives that (and a page refresh).
const STORAGE_KEY = "khmio:mockup-merchant-profile";

interface PersistedProfile {
  businessType: BusinessType;
  shopName: string;
  slug: string;
  logoDataUrl: string | null;
  bakongId: string;
  telegramConnected: boolean;
  phone: string;
  area: ShopArea;
  description: string;
  mapUrl: string;
  invoiceDetails: InvoiceDetails;
  linkShared: boolean;
}

const EMPTY_INVOICE_DETAILS: InvoiceDetails = { taxNumber: "", invoiceNote: "", telegramLink: "", facebookLink: "" };

export function MerchantProfileProvider({ children }: { children: ReactNode }) {
  const [businessType, setBusinessType] = useState<BusinessType>("other");
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [bakongId, setBakongId] = useState("");
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState<ShopArea>("phnom_penh");
  const [description, setDescription] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails>(EMPTY_INVOICE_DETAILS);
  const [linkShared, setLinkShared] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Read persisted profile client-side only, after the initial (empty) render
  // matches the server-rendered HTML — avoids a hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedProfile>;
        const storedType = businessTypeSchema.safeParse(parsed.businessType);
        if (storedType.success) setBusinessType(storedType.data);
        if (parsed.shopName) setShopName(parsed.shopName);
        if (parsed.slug) setSlug(parsed.slug);
        if (parsed.logoDataUrl) setLogoDataUrl(parsed.logoDataUrl);
        if (parsed.bakongId) setBakongId(parsed.bakongId);
        if (parsed.telegramConnected) setTelegramConnected(parsed.telegramConnected);
        if (parsed.phone) setPhone(parsed.phone);
        const storedArea = deliveryAreaSchema.safeParse(parsed.area);
        if (storedArea.success) setArea(storedArea.data);
        if (parsed.description) setDescription(parsed.description);
        const storedMapUrl = shopMapUrlSchema.safeParse(parsed.mapUrl);
        if (storedMapUrl.success) setMapUrl(storedMapUrl.data);
        const storedInvoice = invoiceDetailsSchema.safeParse(parsed.invoiceDetails);
        if (storedInvoice.success) setInvoiceDetails(storedInvoice.data);
        if (parsed.linkShared) setLinkShared(true);
        if (parsed.shopName) setHasProfile(true);
      }
    } catch {
      // Corrupt or inaccessible storage (e.g. private browsing) — start empty.
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist on every change, but only once the read above has run, so we
  // don't immediately clobber saved data with the pre-hydration empty state.
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedProfile = {
        businessType,
        shopName,
        slug,
        logoDataUrl,
        bakongId,
        telegramConnected,
        phone,
        area,
        description,
        mapUrl,
        invoiceDetails,
        linkShared,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage full or unavailable — profile just won't persist this time.
    }
  }, [businessType, shopName, slug, logoDataUrl, bakongId, telegramConnected, phone, area, description, mapUrl, invoiceDetails, linkShared, hydrated]);

  return (
    <MerchantProfileContext.Provider
      value={{
        hydrated,
        businessType,
        setBusinessType,
        shopName,
        setShopName: (value) => {
          setShopName(value);
          setHasProfile(true);
        },
        slug,
        setSlug,
        logoDataUrl,
        setLogoDataUrl,
        bakongId,
        setBakongId,
        telegramConnected,
        setTelegramConnected,
        phone,
        setPhone,
        area,
        setArea,
        description,
        setDescription,
        mapUrl,
        setMapUrl,
        invoiceDetails,
        setInvoiceDetails,
        linkShared,
        setLinkShared,
        hasProfile,
      }}
    >
      {children}
    </MerchantProfileContext.Provider>
  );
}

export function useMerchantProfile(): MerchantProfileContextValue {
  const ctx = useContext(MerchantProfileContext);
  if (!ctx) throw new Error("useMerchantProfile must be used within a MerchantProfileProvider");
  return ctx;
}
