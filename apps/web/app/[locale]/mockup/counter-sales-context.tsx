"use client";

import { currencySchema, phnomPenhDay } from "@khmio/shared";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { z } from "zod";

// Sales rung up at the counter (design/screens.md P1–P4), kept in this
// browser. The live app saves them as orders with channel "in_store".

const counterSaleSchema = z.object({
  /** C-0001, C-0002 … */
  number: z.string(),
  atIso: z.string(),
  currency: currencySchema,
  /** The rate frozen on the sale, for the "≈" line. */
  rate: z.number(),
  vatPercent: z.number(),
  lines: z.array(
    z.object({ key: z.string(), title: z.string(), option: z.string().optional(), quantity: z.number(), unitPrice: z.number(), lineTotal: z.number() }),
  ),
  subtotal: z.number(),
  discount: z.number(),
  vat: z.number(),
  total: z.number(),
  payment: z.enum(["cash", "qr"]),
  cashReceived: z.number().optional(),
  change: z.number().optional(),
  buyerName: z.string(),
  /** 855… or "". */
  buyerPhone: z.string(),
  voided: z.boolean(),
});
export type CounterSale = z.infer<typeof counterSaleSchema>;
export type NewCounterSale = Omit<CounterSale, "number" | "atIso" | "voided">;

/** The sales of today in Phnom Penh, voided ones included (they still show, struck through). */
export function salesToday(sales: CounterSale[], now = new Date()): CounterSale[] {
  const today = phnomPenhDay(now.toISOString());
  return sales.filter((sale) => phnomPenhDay(sale.atIso) === today);
}

interface CounterSalesContextValue {
  hydrated: boolean;
  /** Newest first. */
  sales: CounterSale[];
  recordSale: (sale: NewCounterSale) => CounterSale;
  voidSale: (number: string) => void;
}

const CounterSalesContext = createContext<CounterSalesContextValue | null>(null);
const STORAGE_KEY = "khmio:mockup-counter-sales";
const NUMBER_DIGITS = 4;

export function CounterSalesProvider({ children }: { children: ReactNode }) {
  const [sales, setSales] = useState<CounterSale[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = z.array(counterSaleSchema).safeParse(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"));
      if (stored.success) setSales(stored.data);
    } catch {
      // Corrupt or blocked storage: start with no sales.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
    } catch {
      // Storage full or blocked: the sales just won't survive a refresh.
    }
  }, [sales, hydrated]);

  function recordSale(input: NewCounterSale): CounterSale {
    const sale: CounterSale = { ...input, number: `C-${String(sales.length + 1).padStart(NUMBER_DIGITS, "0")}`, atIso: new Date().toISOString(), voided: false };
    setSales((current) => [sale, ...current]);
    return sale;
  }

  function voidSale(number: string) {
    setSales((current) => current.map((sale) => (sale.number === number ? { ...sale, voided: true } : sale)));
  }

  return <CounterSalesContext.Provider value={{ hydrated, sales, recordSale, voidSale }}>{children}</CounterSalesContext.Provider>;
}

export function useCounterSales(): CounterSalesContextValue {
  const ctx = useContext(CounterSalesContext);
  if (!ctx) throw new Error("useCounterSales must be used within a CounterSalesProvider");
  return ctx;
}
