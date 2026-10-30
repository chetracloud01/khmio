"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type PurchaseDetail, purchaseDetailSchema } from "@/lib/api";

/** One bill or return from GET /purchases/:id — its page and its printouts. Another shop's, or a mistyped address, is "not_found". */
export function useLoadedPurchase(id: string) {
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "offline">("loading");
  const load = useCallback(() => {
    setState("loading");
    api(`/purchases/${id}`, purchaseDetailSchema)
      .then((answer) => {
        setPurchase(answer);
        setState("ready");
      })
      .catch((error: unknown) => setState(error instanceof ApiError && (error.status === 404 || error.status === 400) ? "not_found" : "offline"));
  }, [id]);
  useEffect(load, [load]);
  return { purchase, state, load };
}
