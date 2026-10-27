"use client";

import {
  deliveryAreaSchema,
  fulfilmentSchema,
  type Currency,
  type DeliveryArea,
  type Fulfilment,
} from "@khmio/shared";
import { createContext, useContext, useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { MockPromoCode } from "@/mock/mock-data";
import { useStoreSettings } from "./store-settings-context";

export type Area = DeliveryArea;

interface CartContextValue {
  /** False until the saved cart has been read — screens that redirect on an empty cart must wait for this. */
  hydrated: boolean;
  quantities: Record<string, number>;
  setQuantities: Dispatch<SetStateAction<Record<string, number>>>;
  appliedPromo: MockPromoCode | null;
  setAppliedPromo: Dispatch<SetStateAction<MockPromoCode | null>>;
  /** The currency chosen at checkout; carried through to the KHQR payment screen so both agree on the same amount. */
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  phone: string;
  setPhone: Dispatch<SetStateAction<string>>;
  /** Delivery to the buyer, or the buyer collects from the shop. */
  fulfilment: Fulfilment;
  setFulfilment: Dispatch<SetStateAction<Fulfilment>>;
  area: Area;
  setArea: Dispatch<SetStateAction<Area>>;
  /** Phnom Penh delivery: the district, which sets the fee. "" = not chosen yet. */
  districtId: string;
  setDistrictId: Dispatch<SetStateAction<string>>;
  /** Province delivery. "" = not chosen yet. */
  provinceId: string;
  setProvinceId: Dispatch<SetStateAction<string>>;
  landmark: string;
  setLandmark: Dispatch<SetStateAction<string>>;
  /** Keep name, phone and address on this device for the next order. */
  rememberDetails: boolean;
  setRememberDetails: Dispatch<SetStateAction<boolean>>;
  /** Empties the cart (items + promo) once an order is placed; keeps buyer details for next time. */
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// Switching locale changes the [locale] URL segment, which remounts this
// provider — localStorage is what survives that (and a page refresh).
const STORAGE_KEY = "khmio:mockup-cart";

interface PersistedCart {
  quantities: Record<string, number>;
  appliedPromo: MockPromoCode | null;
  currency: Currency;
  /** False = still following the store's default currency. */
  currencyChosen: boolean;
  name: string;
  phone: string;
  fulfilment: Fulfilment;
  area: Area;
  districtId: string;
  provinceId: string;
  landmark: string;
  rememberDetails: boolean;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [appliedPromo, setAppliedPromo] = useState<MockPromoCode | null>(null);
  const { settings: storeSettings, hydrated: storeSettingsReady } = useStoreSettings();
  const [currency, setCurrencyState] = useState<Currency>(storeSettings.defaultCurrency);
  // Until the buyer picks a currency (now or in an earlier visit), follow the store's default.
  const [currencyChosen, setCurrencyChosen] = useState(false);
  const setCurrency = (next: Currency) => {
    setCurrencyState(next);
    setCurrencyChosen(true);
  };
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfilment, setFulfilment] = useState<Fulfilment>("delivery");
  const [area, setArea] = useState<Area>("phnom_penh");
  const [districtId, setDistrictId] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [landmark, setLandmark] = useState("");
  const [rememberDetails, setRememberDetails] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Read persisted cart client-side only, after the initial (empty) render
  // matches the server-rendered HTML — avoids a hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedCart>;
        if (parsed.quantities) setQuantities(parsed.quantities);
        if (parsed.appliedPromo) setAppliedPromo(parsed.appliedPromo);
        if (parsed.currency) {
          setCurrencyState(parsed.currency);
          setCurrencyChosen(parsed.currencyChosen ?? false);
        }
        if (parsed.name) setName(parsed.name);
        if (parsed.phone) setPhone(parsed.phone);
        const storedFulfilment = fulfilmentSchema.safeParse(parsed.fulfilment);
        if (storedFulfilment.success) setFulfilment(storedFulfilment.data);
        const storedArea = deliveryAreaSchema.safeParse(parsed.area);
        if (storedArea.success) setArea(storedArea.data);
        if (typeof parsed.districtId === "string") setDistrictId(parsed.districtId);
        if (typeof parsed.provinceId === "string") setProvinceId(parsed.provinceId);
        if (parsed.landmark) setLandmark(parsed.landmark);
        if (typeof parsed.rememberDetails === "boolean") setRememberDetails(parsed.rememberDetails);
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
      // "Remember my details" off: the cart itself is kept, who and where are not.
      const details = rememberDetails
        ? { name, phone, fulfilment, area, districtId, provinceId, landmark }
        : { name: "", phone: "", fulfilment: "delivery" as const, area: "phnom_penh" as const, districtId: "", provinceId: "", landmark: "" };
      const payload: PersistedCart = {
        quantities,
        appliedPromo,
        currency,
        currencyChosen,
        ...details,
        rememberDetails,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage full or unavailable — cart just won't persist this time.
    }
  }, [
    quantities,
    appliedPromo,
    currency,
    currencyChosen,
    name,
    phone,
    fulfilment,
    area,
    districtId,
    provinceId,
    landmark,
    rememberDetails,
    hydrated,
  ]);

  // A buyer who hasn't picked a currency sees the store's default — including after the seller changes it.
  useEffect(() => {
    if (hydrated && storeSettingsReady && !currencyChosen) setCurrencyState(storeSettings.defaultCurrency);
  }, [hydrated, storeSettingsReady, currencyChosen, storeSettings.defaultCurrency]);

  function clearCart() {
    setQuantities({});
    setAppliedPromo(null);
  }

  return (
    <CartContext.Provider
      value={{
        hydrated,
        quantities,
        setQuantities,
        appliedPromo,
        setAppliedPromo,
        currency,
        setCurrency,
        name,
        setName,
        phone,
        setPhone,
        fulfilment,
        setFulfilment,
        area,
        setArea,
        districtId,
        setDistrictId,
        provinceId,
        setProvinceId,
        landmark,
        setLandmark,
        rememberDetails,
        setRememberDetails,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
