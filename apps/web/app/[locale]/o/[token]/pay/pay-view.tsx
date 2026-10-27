"use client";

import { KHQR_CODE_MINUTES } from "@khmio/shared";
import { Notice } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BuyerShell, BuyerSteps, BuyerTopBar } from "@/components/buyer-shell";
import { KHQR_PAID_PAUSE_MS, KhqrPayPanel, type KhqrPayStatus } from "@/components/buyer/khqr-pay-panel";
import { api, apiSend, type PublicOrder, publicOrderSchema } from "@/lib/api";
import { addToShopCart } from "@/lib/cart";
import { rememberOrder } from "@/lib/my-orders";

/** How often the page asks whether the payment landed (the worker checks the bank every few seconds). */
const PAY_POLL_MS = 3_000;

/** What the buyer sees: the code to pay, "Paid!", or "expired". Anything else belongs on the order page. */
function payStatus(order: PublicOrder): KhqrPayStatus | "elsewhere" {
  if (order.status === "awaiting_payment" && order.payment) return "pending";
  if (order.status === "cancelled" && order.cancelReason === "payment_timeout") return "expired";
  return order.status === "paid" ? "paid" : "elsewhere";
}

export function PayView({ initial, token }: { initial: PublicOrder | null; token: string }) {
  const t = useTranslations("Khqr");
  const tCart = useTranslations("Cart");
  const tOrders = useTranslations("Orders");
  const tApp = useTranslations("App");
  const locale = useLocale();
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  // The clock is read in the browser only: the server's "now" would differ and break hydration.
  const [now, setNow] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // The "Paid!" moment only for a payment seen landing here; an order already paid goes straight to its page.
  const [sawPending] = useState(() => initial !== null && payStatus(initial) === "pending");
  const orderHref = `/${locale}/o/${encodeURIComponent(token)}`;
  const status = order ? payStatus(order) : "elsewhere";

  // Under "My orders" on this phone straight away: from checkout the buyer lands here, not on the order page.
  useEffect(() => {
    if (!initial) return;
    rememberOrder({ token, shopSlug: initial.store.slug, shopName: initial.store.name, orderNumber: initial.orderNumber, placedAt: initial.createdAt });
  }, [initial, token]);

  // Ask for news while the code waits; tick the countdown every second.
  useEffect(() => {
    if (status !== "pending") return;
    const poll = window.setInterval(() => {
      api(`/public/orders/${encodeURIComponent(token)}`, publicOrderSchema).then(setOrder, () => undefined);
    }, PAY_POLL_MS);
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [status, token]);

  useEffect(() => {
    if (status === "elsewhere" || (status === "paid" && !sawPending)) {
      router.replace(orderHref);
      return;
    }
    if (status !== "paid") return;
    const timer = window.setTimeout(() => router.replace(orderHref), KHQR_PAID_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [status, sawPending, router, orderHref]);

  if (!order || status === "elsewhere" || (status === "paid" && !sawPending)) return null;

  const payment = order.payment;
  // Before the browser's first tick: the code's full time, the same on the server and in the browser.
  const secondsLeft = !payment ? 0 : now === null ? KHQR_CODE_MINUTES * 60 : Math.max(0, Math.ceil((Date.parse(payment.expiresAt) - now) / 1000));

  async function testPay() {
    if (!payment?.testBankRef) return;
    setPaying(true);
    setProblem(null);
    try {
      await apiSend(`/dev/fake-bank/${payment.testBankRef}/pay`, { method: "POST", body: { currency: payment.currency, amountMinor: payment.amountMinor } });
    } catch {
      setProblem(tApp("saveFailed"));
    } finally {
      setPaying(false);
    }
  }

  function orderAgain() {
    if (!order) return;
    addToShopCart(
      order.store.slug,
      order.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    );
    router.push(`/${locale}/s/${order.store.slug}/cart`);
  }

  return (
    <BuyerShell>
      <BuyerTopBar backHref={orderHref} backLabel={t("backToOrder")} title={t("title")} subtitle={`#${order.orderNumber}`}>
        <BuyerSteps steps={[tCart("stepCart"), tCart("stepCheckout"), tCart("stepPay")]} current={2} />
      </BuyerTopBar>
      <KhqrPayPanel
        storeName={order.store.name}
        amountMinor={payment?.amountMinor ?? order.totalMinor}
        currency={payment?.currency ?? order.currency}
        qrText={payment?.qrPayload ?? ""}
        secondsLeft={secondsLeft}
        status={status}
        saveName={`khqr-${order.orderNumber}.png`}
        expired={{ body: t("expiredOrderBody"), actionLabel: tOrders("orderAgain"), onAction: orderAgain }}
        testPay={payment?.testBankRef ? { label: t("testPay"), note: t("testPayNote"), onPay: () => void testPay(), busy: paying } : undefined}
      />
      {problem && (
        <div className="mx-auto w-full max-w-[332px] px-4 pb-6">
          <Notice tone="danger" role="alert">
            {problem}
          </Notice>
        </div>
      )}
    </BuyerShell>
  );
}
