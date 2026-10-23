"use client";

import { approximateIn, BUYER_ORDER_STEPS, formatKhmerPhoneLocal, getBuyerProgress, getInvoiceState } from "@khmio/shared";
import { Button, cn, ConfirmDialog, GroupTitle, Notice } from "@khmio/ui";
import { BellRing, Bus, Check, Clock, FileText, ListOrdered, MapPin, PackageX, Phone, RotateCcw, Send, Store, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BuyerColumns, BuyerShell } from "@/components/buyer-shell";
import { TrackingCodeCard } from "@/components/invoice/tracking-code-card";
import { formatMoney, OrderStatusPill, useOrderText } from "@/components/order-ui";
import { api, ApiError, apiSend, type PublicOrder, telegramLinkSchema } from "@/lib/api";
import { addToShopCart } from "@/lib/cart";
import { rememberOrder } from "@/lib/my-orders";

/** How often an open order page asks for news (weak signal friendly; stops once the order is finished). */
const REFRESH_EVERY_MS = 20_000;

export function OrderView({ order, token }: { order: PublicOrder | null; token: string }) {
  const t = useTranslations("Orders");
  const tStore = useTranslations("Storefront");
  const tCheckout = useTranslations("Checkout");
  const locale = useLocale();
  const tApp = useTranslations("App");
  const tInvoice = useTranslations("Invoice");
  const tBuyer = useTranslations("MyOrders");
  const { paymentLabel, placeLabel, clockTime } = useOrderText();
  const router = useRouter();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelProblem, setCancelProblem] = useState<string | null>(null);
  const finished = !order || order.status === "completed" || order.status === "cancelled";

  // The seller works on the order meanwhile: read it again now and then, and when the buyer comes back to the tab.
  useEffect(() => {
    if (finished) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, REFRESH_EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [finished, router]);

  // Kept on this phone, so it shows under "My orders" — however the buyer opened it (checkout, Telegram, a shared link).
  useEffect(() => {
    if (!order) return;
    rememberOrder({ token, shopSlug: order.store.slug, shopName: order.store.name, orderNumber: order.orderNumber, placedAt: order.createdAt });
  }, [order, token]);

  async function cancelOrder() {
    setCancelling(true);
    setCancelProblem(null);
    try {
      await apiSend(`/public/orders/${encodeURIComponent(token)}/cancel`, { method: "POST" });
    } catch (failure) {
      // Already moved on (the shop confirmed it meanwhile): the page shows why after the refresh.
      setCancelProblem(failure instanceof ApiError && failure.code === "action_not_allowed" ? tApp("orderMovedOn") : failure instanceof ApiError && failure.code === "too_many_requests" ? tApp("tooManyTries") : tApp("saveFailed"));
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
      router.refresh();
    }
  }

  if (!order) {
    return (
      <BuyerShell className="items-center justify-center gap-3 p-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-border/30">
          <PackageX className="h-8 w-8 text-muted" aria-hidden="true" />
        </span>
        <p className="font-semibold">{t("notFoundTitle")}</p>
        <p className="text-sm text-muted">{t("notFoundBody")}</p>
      </BuyerShell>
    );
  }

  const pickup = order.fulfilment === "pickup";
  // Delivered, collected or cancelled: the same items can go straight back in the cart.
  const canOrderAgain = order.status === "delivered" || order.status === "completed" || order.status === "cancelled";
  function orderAgain() {
    if (!order) return;
    addToShopCart(
      order.store.slug,
      order.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    );
    router.push(`/${locale}/s/${order.store.slug}/cart`);
  }
  // A pickup order "out for delivery" is waiting at the shop.
  // For the buyer, "completed" (the seller settled the cash) reads the same as "delivered".
  const shownStatus =
    pickup && order.status === "out_for_delivery"
      ? "ready_for_pickup"
      : pickup && order.status === "failed_delivery"
        ? "not_collected"
        : order.status === "completed"
          ? "delivered"
          : order.status;
  const progress = getBuyerProgress(order.status);
  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);
  const shopHref = `/${locale}/s/${order.store.slug}`;

  const deliveryCard = (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4 text-sm">
          <p className="flex items-start gap-2">
            {pickup ? <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> : <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
            <span>
              <span className="block font-medium">{pickup ? t("pickupInfo") : t("deliveryInfo")}</span>
              {order.buyerName} · {pickup ? order.pickupAddress : placeLabel(order)}
              {!pickup && order.landmark && <span className="block text-muted">{order.landmark}</span>}
            </span>
          </p>
          {pickup && order.pickupHours && (
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              {order.pickupHours}
            </p>
          )}
          {!pickup && order.area === "province" && (
            <p className="flex items-start gap-2 text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {tCheckout("otherProvince")}
            </p>
          )}
          <p className="text-muted">{paymentLabel(order)}</p>
          {order.dispatch && order.dispatch.route !== "pickup" && (
            <p className="flex items-start gap-2 border-t border-border pt-2">
              {order.dispatch.route === "driver" ? <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> : <Bus className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
              <span>
                {order.dispatch.route === "driver" ? (
                  <>
                    <span className="block font-medium">{t("driver")}</span>
                    {order.dispatch.driverName}
                  </>
                ) : (
                  <>
                    <span className="block font-medium">{order.dispatch.busCompany}</span>
                    {t("ticketNumber")}: {order.dispatch.ticketNumber}
                  </>
                )}
              </span>
            </p>
          )}
        </section>
  );
  const shopCard = (
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4">
        <div>
          <GroupTitle className="px-0">{t("buyerOrderedFrom")}</GroupTitle>
          <p className="font-semibold">{order.store.name}</p>
        </div>
          {order.store.phone && (
            <a href={`tel:+${order.store.phone}`} className="flex min-h-touch items-center justify-center gap-2 rounded-DEFAULT border border-border text-sm font-medium">
              <Phone className="h-4 w-4" aria-hidden="true" />
              {t("callShop", { phone: formatKhmerPhoneLocal(order.store.phone) })}
            </a>
          )}
          {canOrderAgain && (
            <Button variant="primary" className="w-full" onClick={orderAgain}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t("orderAgain")}
            </Button>
          )}
          <Link href={shopHref} className="block">
            <Button variant="secondary" className="w-full">
              {t("backToShop")}
            </Button>
          </Link>
          <Link href={`/${locale}/orders`} className="flex min-h-touch items-center justify-center gap-2 text-sm font-medium text-brand">
            <ListOrdered className="h-4 w-4" aria-hidden="true" />
            {tBuyer("myOrders")}
          </Link>
          {!finished && <TelegramUpdates token={token} following={order.followingOnTelegram} />}
          {cancelProblem && (
            <Notice tone="warning" role="alert">
              {cancelProblem}
            </Notice>
          )}
          {order.canCancel && (
            <Button variant="secondary" className="w-full text-danger" loading={cancelling} onClick={() => setConfirmCancel(true)}>
              {t("cancelOrder")}
            </Button>
          )}
      </section>
  );

  return (
    <BuyerShell wide className="pb-10 lg:pb-0">
      <BuyerColumns
        plain
        aside={
          <>
            {shopCard}
            {deliveryCard}
          </>
        }
      >
      <main className="flex flex-col gap-4 p-4 lg:p-0">
      {/* The order at a glance: whose, which number, where it stands. */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-bg p-4">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-lg font-bold text-on-brand">
          {order.store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the shop's own uploaded logo
            <img src={order.store.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            order.store.name.charAt(0).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{order.store.name}</p>
          <p className="text-sm text-muted">
            {t("orderNumber")} #{order.orderNumber}
          </p>
        </div>
        <OrderStatusPill order={order} />
      </header>
        <div className="flex flex-col gap-1 border-t border-border pt-4" role="status">
          <h1 className="text-xl font-bold leading-normal">{t(`buyerTitle_${shownStatus}`)}</h1>
          <p className="text-sm text-muted">{t(`buyerBody_${shownStatus}`)}</p>
          {order.status === "cancelled" && order.cancelReason && (
            <p className="text-sm">
              {t("cancelReasonLabel")}: {t(`cancelReason_${order.cancelReason}`)}
            </p>
          )}
        </div>
      </section>

        <TrackingCodeCard code={order.trackingCode} />

        {progress !== null && (
          <ol aria-label={t("progressLabel")} className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4">
            {BUYER_ORDER_STEPS.map((step, index) => {
              const done = index <= progress;
              const label = pickup && step === "sending" ? t("step_ready") : t(`step_${step}`);
              return (
                <li key={step} className="flex items-center gap-3" aria-current={index === progress ? "step" : undefined}>
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", done ? "bg-brand text-on-brand" : "bg-border/40 text-muted")}>
                    {done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className={cn("text-sm", index === progress ? "font-semibold" : done ? "" : "text-muted")}>{label}</span>
                </li>
              );
            })}
          </ol>
        )}


        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4">
          <h2 className="font-semibold">{t("items")}</h2>
          <ul className="flex flex-col">
            {order.items.map((item, index) => {
              const title = text(item.titleKm, item.titleEn);
              const option = text(item.variantLabelKm, item.variantLabelEn);
              return (
                <li key={index} className="flex items-start justify-between gap-3 border-b border-border py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {item.quantity} × {title}
                    </span>
                    {option && <span className="block text-muted">{option}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatMoney(item.lineTotalMinor, order.currency)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between text-muted">
              <dt>{tStore("subtotal")}</dt>
              <dd className="tabular-nums">{formatMoney(order.subtotalMinor, order.currency)}</dd>
            </div>
            {order.discountMinor > 0 && (
              <div className="flex justify-between text-success">
                <dt>{tStore("itemDiscount")}</dt>
                <dd className="tabular-nums">-{formatMoney(order.discountMinor, order.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between text-muted">
              <dt>{pickup ? tCheckout("pickup") : tCheckout("deliveryFee")}</dt>
              <dd className="tabular-nums">{order.deliveryFeeMinor === 0 ? tCheckout("free") : formatMoney(order.deliveryFeeMinor, order.currency)}</dd>
            </div>
            {order.vatMinor > 0 && (
              <div className="flex justify-between text-muted">
                <dt>{tStore("vat", { percent: order.vatPercent })}</dt>
                <dd className="tabular-nums">{formatMoney(order.vatMinor, order.currency)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border pt-2">
              <dt className="font-semibold">{t("total")}</dt>
              <dd className="text-right">
                <span className="block text-lg font-bold tabular-nums">{formatMoney(order.totalMinor, order.currency)}</span>
                {/* At the rate frozen on the order, never today's. */}
                <span className="block text-xs text-muted">
                  ≈ {formatMoney(approximateIn(order.totalMinor, order.currency, order.exchangeRateUsed), order.currency === "USD" ? "KHR" : "USD")}
                </span>
              </dd>
            </div>
          </dl>
          <Link href={`/${locale}/o/${encodeURIComponent(token)}/invoice`} className="block">
            <Button variant="secondary" className="w-full">
              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
              {getInvoiceState(order) === "paid" ? tInvoice("viewReceipt") : tInvoice("viewInvoice")}
            </Button>
          </Link>
        </section>

        {order.events.length > 0 && <p className="text-xs text-muted">{clockTime(order.events[order.events.length - 1]!.at)}</p>}

        {/* Phone and tablet: the shop and delivery cards follow; from 1024 px they're in the side column. */}
        <div className="flex flex-col gap-4 lg:hidden">
          {shopCard}
          {deliveryCard}
        </div>
      </main>
      </BuyerColumns>

      <ConfirmDialog
        open={confirmCancel}
        title={t("cancelConfirmTitle")}
        body={t("cancelConfirmBody")}
        confirmLabel={t("cancelOrder")}
        cancelLabel={t("keepOrder")}
        danger
        onConfirm={() => void cancelOrder()}
        onClose={() => setConfirmCancel(false)}
      />
    </BuyerShell>
  );
}

/**
 * "Get updates on Telegram": a one-time link opens the shop's bot, and each
 * status change then arrives as a message — no app, no account. The buyer can
 * stop them from the message itself.
 */
function TelegramUpdates({ token, following }: { token: string; following: boolean }) {
  const t = useTranslations("Telegram");
  const tApp = useTranslations("App");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  if (following) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-DEFAULT bg-success/10 p-3 text-sm font-medium text-success">
        <BellRing className="h-4 w-4" aria-hidden="true" />
        {t("buyerFollowing")}
      </p>
    );
  }
  async function getLink() {
    setBusy(true);
    setFailed(null);
    try {
      const result = await api(`/public/orders/${encodeURIComponent(token)}/telegram-link`, telegramLinkSchema, { method: "POST" });
      setLink(result.link);
      window.open(result.link, "_blank", "noopener");
    } catch (failure) {
      setFailed(failure instanceof ApiError && failure.code === "too_many_requests" ? tApp("tooManyTries") : t("buyerFailed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-1">
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="flex min-h-touch items-center justify-center gap-2 rounded-DEFAULT border border-brand text-sm font-medium text-brand">
          <Send className="h-4 w-4" aria-hidden="true" />
          {t("buyerOpenAgain")}
        </a>
      ) : (
        <Button variant="secondary" className="w-full" loading={busy} onClick={() => void getLink()}>
          <Send className="h-4 w-4" aria-hidden="true" />
          {t("buyerGetUpdates")}
        </Button>
      )}
      <p className="text-center text-xs text-muted">{failed ?? (link ? t("buyerPressStart") : t("buyerHint"))}</p>
    </div>
  );
}
