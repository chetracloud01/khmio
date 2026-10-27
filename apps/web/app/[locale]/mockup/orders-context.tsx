"use client";

import {
  applyOrderAction,
  getInitialOrderStatus,
  orderStatusSchema,
  type OrderAction,
  type OrderCancellation,
} from "@khmio/shared";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { generateOrderNumber, mockStore, parseLineKey } from "@/mock/mock-data";
import { buildSampleOrders, type OrderDispatch, type OrderRecord } from "@/mock/mock-orders";
import { useMerchantInventory } from "./merchant-inventory-context";
import { useOnlineStock } from "./online-stock";

export type NewOrder = Omit<OrderRecord, "orderNumber" | "placedAtIso" | "status" | "timeline" | "stockTaken" | "fromShop">;

interface OrdersContextValue {
  /** False until saved orders have been read. */
  hydrated: boolean;
  /** Newest first. */
  orders: OrderRecord[];
  /** Creates the order in its starting status (cash → with the seller; online → awaiting payment). */
  placeOrder: (order: NewOrder) => OrderRecord;
  /**
   * Moves an order along by one action from packages/shared orders.ts.
   * Returns false (and changes nothing) if the action isn't allowed right now.
   */
  act: (orderNumber: string, action: OrderAction, detail?: { dispatch?: OrderDispatch; cancellation?: OrderCancellation }) => boolean;
  /** A new shop starts with no orders. */
  startNewShop: () => void;
}

const OrdersContext = createContext<OrdersContextValue | null>(null);

const STORAGE_KEY = "khmio:mockup-orders";

function isOrderRecord(value: unknown): value is OrderRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.orderNumber === "string" &&
    orderStatusSchema.safeParse(record.status).success &&
    Array.isArray(record.lines) &&
    Array.isArray(record.timeline)
  );
}

/**
 * One shared list of orders for the buyer's order page and the seller's
 * dashboard, so a change on one side shows on the other — like the real
 * thing will through the API.
 */
export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { recordTransaction } = useMerchantInventory();
  const { tracksStock, location } = useOnlineStock();

  // Read in the browser only: the samples are built from the current time.
  useEffect(() => {
    let loaded: OrderRecord[] | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) loaded = parsed.filter(isOrderRecord);
    } catch {
      // Corrupt or inaccessible storage — fall back to the samples.
    }
    setOrders(loaded ?? buildSampleOrders(new Date()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      // Storage full or unavailable — orders just won't persist this time.
    }
  }, [orders, hydrated]);

  // Stock leaves the shelf when the order is sure (paid online, or placed as
  // cash on delivery) and comes back if it's cancelled — Pro and Advance only.
  function moveStock(order: OrderRecord, direction: "take" | "return") {
    if (!tracksStock || !location) return;
    for (const line of order.lines) {
      const { productId, variantId } = parseLineKey(line.key);
      recordTransaction({
        type: direction === "take" ? "sale" : "adjust_in",
        reason: direction === "take" ? undefined : "returned",
        productId,
        variantId,
        locationType: location.type,
        locationId: location.id,
        quantity: line.qty,
        note: order.orderNumber,
      });
    }
  }

  function placeOrder(input: NewOrder): OrderRecord {
    const now = new Date().toISOString();
    const status = getInitialOrderStatus(input.paymentMethod);
    const order: OrderRecord = {
      ...input,
      orderNumber: generateOrderNumber(mockStore),
      placedAtIso: now,
      status,
      timeline: [{ status, atIso: now }],
      stockTaken: status === "cod_pending",
      fromShop: true,
    };
    if (order.stockTaken) moveStock(order, "take");
    setOrders((prev) => [order, ...prev]);
    return order;
  }

  function act(orderNumber: string, action: OrderAction, detail?: { dispatch?: OrderDispatch; cancellation?: OrderCancellation }) {
    const order = orders.find((item) => item.orderNumber === orderNumber);
    if (!order) return false;
    const status = applyOrderAction(order, action);
    if (!status) return false;

    const next: OrderRecord = {
      ...order,
      status,
      timeline: [...order.timeline, { status, atIso: new Date().toISOString() }],
      dispatch: action === "dispatch" ? detail?.dispatch : action === "rebook" ? undefined : order.dispatch,
      cancellation: action === "cancel" ? detail?.cancellation : order.cancellation,
    };
    if (action === "pay" && !order.stockTaken) {
      moveStock(order, "take");
      next.stockTaken = true;
    }
    if (action === "cancel" && order.stockTaken) {
      moveStock(order, "return");
      next.stockTaken = false;
    }
    setOrders((prev) => prev.map((item) => (item.orderNumber === orderNumber ? next : item)));
    return true;
  }

  function startNewShop() {
    setOrders([]);
  }

  return <OrdersContext.Provider value={{ hydrated, orders, placeOrder, act, startNewShop }}>{children}</OrdersContext.Provider>;
}

export function useOrders(): OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within an OrdersProvider");
  return ctx;
}
