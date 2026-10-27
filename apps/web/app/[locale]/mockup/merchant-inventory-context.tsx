"use client";

import { stockMovementTypeSchema, type StockMovementInput, type StockTransferInput } from "@khmio/shared";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  mockBranches,
  mockStockTransactions,
  mockWarehouses,
  type MockBranch,
  type MockStockTransaction,
  type MockWarehouse,
} from "@/mock/mock-data";

interface MerchantInventoryContextValue {
  /** False until saved data has been read. */
  hydrated: boolean;
  warehouses: MockWarehouse[];
  addWarehouse: (warehouse: MockWarehouse) => void;
  branches: MockBranch[];
  addBranch: (branch: MockBranch) => void;
  transactions: MockStockTransaction[];
  /** Purchase, sale or correction. Validate with stockMovementInputSchema first. */
  recordTransaction: (input: StockMovementInput) => void;
  /** Writes the out and in halves together, so a transfer can never be half-recorded. Validate with stockTransferInputSchema first. */
  recordTransfer: (input: StockTransferInput) => void;
  /** A new shop has no stock history. */
  startNewShop: () => void;
}

const MerchantInventoryContext = createContext<MerchantInventoryContextValue | null>(null);

// Switching locale changes the [locale] URL segment, which remounts this
// provider — localStorage is what survives that (and a page refresh).
const WAREHOUSES_KEY = "khmio:mockup-merchant-warehouses";
const BRANCHES_KEY = "khmio:mockup-merchant-branches";
const TRANSACTIONS_KEY = "khmio:mockup-merchant-stock-transactions";

let transactionCounter = 0;
function nextTransactionId(): string {
  transactionCounter += 1;
  // The time part keeps IDs unique across reloads, when the counter starts again from 0.
  return `tx-${Date.now()}-${transactionCounter}`;
}

export function MerchantInventoryProvider({ children }: { children: ReactNode }) {
  // Starts from the seed mock data so server and client render the same
  // list before hydration reads whatever was saved locally.
  const [warehouses, setWarehouses] = useState<MockWarehouse[]>(mockWarehouses);
  const [branches, setBranches] = useState<MockBranch[]>(mockBranches);
  const [transactions, setTransactions] = useState<MockStockTransaction[]>(mockStockTransactions);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawWarehouses = window.localStorage.getItem(WAREHOUSES_KEY);
      if (rawWarehouses) setWarehouses(JSON.parse(rawWarehouses) as MockWarehouse[]);
      const rawBranches = window.localStorage.getItem(BRANCHES_KEY);
      if (rawBranches) setBranches(JSON.parse(rawBranches) as MockBranch[]);
      const rawTransactions = window.localStorage.getItem(TRANSACTIONS_KEY);
      if (rawTransactions) {
        // Drop anything a newer or older version of this mockup saved that this ledger doesn't understand.
        const stored = (JSON.parse(rawTransactions) as MockStockTransaction[]).filter(
          (tx) => stockMovementTypeSchema.safeParse(tx.type).success && Number.isInteger(tx.quantity) && tx.quantity > 0,
        );
        setTransactions(stored);
      }
    } catch {
      // Corrupt or inaccessible storage (e.g. private browsing) — keep the seed defaults.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(WAREHOUSES_KEY, JSON.stringify(warehouses));
    } catch {
      // Storage full or unavailable — changes just won't persist this time.
    }
  }, [warehouses, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(branches));
    } catch {
      // Storage full or unavailable — changes just won't persist this time.
    }
  }, [branches, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
    } catch {
      // Storage full or unavailable — changes just won't persist this time.
    }
  }, [transactions, hydrated]);

  function addWarehouse(warehouse: MockWarehouse) {
    setWarehouses((prev) => [...prev, warehouse]);
  }

  function addBranch(branch: MockBranch) {
    setBranches((prev) => [...prev, branch]);
  }

  function recordTransaction(input: StockMovementInput) {
    setTransactions((prev) => [{ id: nextTransactionId(), minutesAgo: 0, ...input }, ...prev]);
  }

  function recordTransfer({ from, to, ...item }: StockTransferInput) {
    const transferId = `tr-${Date.now()}`;
    setTransactions((prev) => [
      { id: nextTransactionId(), minutesAgo: 0, type: "transfer_in", locationType: to.type, locationId: to.id, transferId, ...item },
      { id: nextTransactionId(), minutesAgo: 0, type: "transfer_out", locationType: from.type, locationId: from.id, transferId, ...item },
      ...prev,
    ]);
  }

  function startNewShop() {
    setTransactions([]);
  }

  return (
    <MerchantInventoryContext.Provider
      value={{ hydrated, warehouses, addWarehouse, branches, addBranch, transactions, recordTransaction, recordTransfer, startNewShop }}
    >
      {children}
    </MerchantInventoryContext.Provider>
  );
}

export function useMerchantInventory(): MerchantInventoryContextValue {
  const ctx = useContext(MerchantInventoryContext);
  if (!ctx) throw new Error("useMerchantInventory must be used within a MerchantInventoryProvider");
  return ctx;
}
