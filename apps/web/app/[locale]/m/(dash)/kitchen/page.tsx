"use client";

import { KITCHEN_REFRESH_SECONDS } from "@khmio/shared";
import { Button, EmptyState, Notice, PageHeader } from "@khmio/ui";
import { Check, ChefHat } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { LineDetails, useChoiceLabels } from "@/components/order-ui";
import { SELLER_PAGE } from "@/components/seller-frame/seller-frame";
import { useDateText } from "@/components/use-date-text";
import { api, ApiError, type KitchenOrder, kitchenSchema } from "@/lib/api";
import { PageLoading, PageOffline } from "../page-states";

// The Kitchen screen (Features › tables): today's orders still to make,
// oldest first, with what to make — never prices. "Done" takes one off.
// Asks for new orders by itself, and when the tablet comes back to the tab.
export default function KitchenPage() {
  const t = useTranslations("Kitchen");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const choiceLabels = useChoiceLabels();
  const { clockTime } = useDateText();
  const [orders, setOrders] = useState<KitchenOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [doing, setDoing] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);

  const load = useCallback(() => {
    api("/kitchen", kitchenSchema).then(
      (answer) => {
        setOrders(answer.orders);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, []);
  useEffect(() => {
    load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && load(), KITCHEN_REFRESH_SECONDS * 1000);
    document.addEventListener("visibilitychange", load);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [load]);

  async function done(orderId: string) {
    setDoing(orderId);
    setProblem(null);
    try {
      setOrders((await api(`/kitchen/${orderId}/done`, kitchenSchema, { method: "POST" })).orders);
    } catch (failure) {
      setProblem(failure instanceof ApiError && failure.status === 404 ? t("alreadyDone") : tApp("saveFailed"));
      load();
    } finally {
      setDoing(null);
    }
  }

  if (failed && !orders) return <PageOffline onRetry={load} />;
  if (!orders) return <PageLoading />;
  return (
    <div className={`${SELLER_PAGE} gap-4`}>
      <PageHeader title={t("title")} description={t("description")} />
      {problem && (
        <Notice tone="warning" role="status">
          {problem}
        </Notice>
      )}
      {orders.length === 0 ? (
        <EmptyState icon={ChefHat} title={t("empty")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4 shadow-card">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-bold">{order.tableName ? t("table", { name: order.tableName }) : t(order.channel === "in_store" ? "counter" : "online")}</span>
                <span className="text-sm text-muted tabular-nums">
                  #{order.orderNumber} · {clockTime(order.createdAt)}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {order.items.map((item, index) => (
                  <li key={index} className="text-base">
                    <span className="font-semibold tabular-nums">{item.quantity} ×</span> {text(item.titleKm, item.titleEn)}
                    {(item.variantLabelKm || item.variantLabelEn) && <span className="text-muted"> – {text(item.variantLabelKm, item.variantLabelEn)}</span>}
                    <LineDetails choices={choiceLabels(item.choices)} note={item.note} className="text-sm" />
                  </li>
                ))}
              </ul>
              <Button variant="primary" className="mt-auto w-full" loading={doing === order.id} onClick={() => void done(order.id)}>
                <Check className="h-5 w-5" aria-hidden="true" />
                {t("done")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
