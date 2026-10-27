"use client";

import { KHQR_CODE_MINUTES } from "@khmio/shared";
import { Button } from "@khmio/ui";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { mockStore } from "@/mock/mock-data";
import type { OrderRecord } from "@/mock/mock-orders";
import { BuyerShell, BuyerSteps, BuyerTopBar } from "@/components/buyer-shell";
import { KHQR_PAID_PAUSE_MS, KhqrPayPanel, type KhqrPayStatus } from "@/components/buyer/khqr-pay-panel";
import { useMerchantProfile } from "../merchant-profile-context";
import { useOrders } from "../orders-context";

const CODE_SECONDS = KHQR_CODE_MINUTES * 60;

// useSearchParams needs a Suspense boundary for Next's static prerender.
export default function KhqrMockupPage() {
  return (
    <Suspense fallback={null}>
      <KhqrPayment />
    </Suspense>
  );
}

// Pays for one order (?order=SC-123456), created at checkout. Only an order
// still awaiting payment gets a code; anything else goes to its order page.
function KhqrPayment() {
  const tOrders = useTranslations("Orders");
  const locale = useLocale();
  const router = useRouter();
  const orderNumber = useSearchParams().get("order") ?? "";
  const { hydrated, orders } = useOrders();
  const order = orders.find((item) => item.orderNumber === orderNumber);

  const orderHref = `/${locale}/mockup/order/${encodeURIComponent(orderNumber)}`;
  const notPayable = hydrated && order !== undefined && order.status !== "awaiting_payment";
  useEffect(() => {
    if (notPayable) router.replace(orderHref);
  }, [notPayable, router, orderHref]);

  if (!hydrated || notPayable) return null;

  if (!order) {
    return (
      <BuyerShell className="items-center justify-center gap-3 p-4 text-center">
        <p className="font-semibold">{tOrders("notFoundTitle")}</p>
        <p className="text-sm text-muted">{tOrders("notFoundBody")}</p>
        <Link href={`/${locale}/mockup/storefront`} className="block">
          <Button variant="primary">{tOrders("backToShop")}</Button>
        </Link>
      </BuyerShell>
    );
  }

  return <PayOrder order={order} orderHref={orderHref} />;
}

function PayOrder({ order, orderHref }: { order: OrderRecord; orderHref: string }) {
  const t = useTranslations("Khqr");
  const tCart = useTranslations("Cart");
  const locale = useLocale();
  const router = useRouter();
  const { act } = useOrders();
  const profile = useMerchantProfile();
  const storeName = profile.hasProfile ? profile.shopName : locale === "km" ? mockStore.nameKm : mockStore.nameEn;

  const [status, setStatus] = useState<KhqrPayStatus>("pending");
  const [secondsLeft, setSecondsLeft] = useState(CODE_SECONDS);

  useEffect(() => {
    if (status !== "pending") return;
    if (secondsLeft <= 0) {
      setStatus("expired");
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, secondsLeft]);

  // A short "Paid!" moment with Mio, then the order page. The order is only
  // marked paid when the pause ends: marking it earlier would send this page
  // straight to the order page (see notPayable above) and skip the moment.
  useEffect(() => {
    if (status !== "paid") return;
    const timer = setTimeout(() => {
      if (act(order.orderNumber, "pay")) router.push(orderHref);
      else setStatus("pending");
    }, KHQR_PAID_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [status, act, order.orderNumber, router, orderHref]);

  return (
    <BuyerShell>
      <BuyerTopBar backHref={orderHref} backLabel={t("cancel")} title={t("title")} subtitle={order.orderNumber}>
        <BuyerSteps steps={[tCart("stepCart"), tCart("stepCheckout"), tCart("stepPay")]} current={2} />
      </BuyerTopBar>
      <KhqrPayPanel
        storeName={storeName}
        amountMinor={order.total}
        currency={order.currency}
        // A real, scannable QR image — but a mock string, so no bank app will take money for it.
        qrText={`KHQR-MOCK|${mockStore.slug}|${order.orderNumber}|${order.currency}|${order.total}`}
        secondsLeft={secondsLeft}
        status={status}
        saveName={`khqr-${order.orderNumber}.png`}
        expired={{
          body: t("expiredBody"),
          actionLabel: t("tryAgain"),
          onAction: () => {
            setSecondsLeft(CODE_SECONDS);
            setStatus("pending");
          },
        }}
        onOpenBankApp={() => undefined}
        // Stands in for the worker's bank check confirming payment.
        testPay={{ label: t("simulatePayment"), note: t("mockQrNote"), onPay: () => setStatus("paid"), busy: false }}
      />
    </BuyerShell>
  );
}
