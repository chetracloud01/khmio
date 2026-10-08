"use client";

import {
  BUYER_ORDER_STEPS,
  canBuyerCancel,
  formatKhmerPhoneLocal,
  getBuyerProgress,
  type OrderStatus,
} from "@khmio/shared";
import { Button, cn, ConfirmDialog, TONE_STYLES } from "@khmio/ui";
import {
  AlertTriangle,
  Bus,
  Check,
  CircleCheck,
  Clock,
  MapPin,
  PackageCheck,
  Phone,
  Send,
  Store,
  Truck,
  User,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { mockStore } from "@/mock/mock-data";
import { orderLineLabel, type OrderRecord } from "@/mock/mock-orders";
import { BuyerBottomBar, BuyerColumns, BuyerShell } from "@/components/buyer-shell";
import { useMerchantProducts } from "../../merchant-products-context";
import { useMerchantProfile } from "../../merchant-profile-context";
import { formatMoney, ORDER_STATUS_TONE, useOrderText } from "@/components/order-ui";
import { useOrders } from "../../orders-context";

const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  awaiting_payment: Clock,
  paid: CircleCheck,
  cod_pending: CircleCheck,
  confirmed: CircleCheck,
  packing: PackageCheck,
  waiting_for_driver: PackageCheck,
  out_for_delivery: Truck,
  delivered: CircleCheck,
  completed: CircleCheck,
  cancelled: XCircle,
  failed_delivery: AlertTriangle,
};

// The buyer's order page (design/screens.md B6): a link they can reopen any
// time to see where the order is — so they never have to message the shop.
export default function OrderStatusPage() {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const params = useParams<{ number: string }>();
  const { hydrated, orders } = useOrders();

  if (!hydrated) return null;
  const order = orders.find((item) => item.orderNumber === decodeURIComponent(params.number));

  if (!order) {
    return (
      <BuyerShell className="items-center justify-center gap-3 p-4 text-center">
        <p className="font-semibold">{t("notFoundTitle")}</p>
        <p className="text-sm text-muted">{t("notFoundBody")}</p>
        <Link href={`/${locale}/mockup/storefront`} className="block">
          <Button variant="primary">{t("backToShop")}</Button>
        </Link>
      </BuyerShell>
    );
  }
  return <OrderStatus order={order} />;
}

function OrderStatus({ order }: { order: OrderRecord }) {
  const t = useTranslations("Orders");
  const tStore = useTranslations("Storefront");
  const tCheckout = useTranslations("Checkout");
  const locale = useLocale();
  const { act } = useOrders();
  const { products } = useMerchantProducts();
  const profile = useMerchantProfile();
  const { placeLabel, clockTime, paymentLabel } = useOrderText();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const isPickup = order.fulfilment === "pickup";
  const progress = getBuyerProgress(order.status);
  const Icon = STATUS_ICON[order.status];
  const storeName = profile.hasProfile ? profile.shopName : locale === "km" ? mockStore.nameKm : mockStore.nameEn;
  const shopPhone = profile.phone ? formatKhmerPhoneLocal(profile.phone) : "";

  // Same status, different words for pickup: the order waits at the shop instead of travelling.
  const headlineKey =
    order.status === "out_for_delivery" && isPickup
      ? "ready_for_pickup"
      : order.status === "failed_delivery" && isPickup
        ? "not_collected"
        : order.status === "completed"
        ? "delivered"
        : order.status;

  /** When the buyer's step was reached: the first status at or past it. */
  function stepTime(index: number): string | null {
    const entry = order.timeline.find((item) => (getBuyerProgress(item.status) ?? -1) >= index);
    return entry ? clockTime(entry.atIso) : null;
  }

  const awaitingPayment = order.status === "awaiting_payment";
  const delivered = order.status === "delivered" || order.status === "completed";
  // How many steps get a tick. Paying and confirming are moments, so they're
  // ticked and the next step pulses; packing and travelling take time, so that
  // step itself pulses until it's over.
  const ongoing = order.status === "packing" || order.status === "waiting_for_driver" || order.status === "out_for_delivery";
  const doneCount =
    progress === null ? 0 : awaitingPayment ? 0 : delivered ? BUYER_ORDER_STEPS.length : ongoing ? progress : progress + 1;
  const payHref = `/${locale}/mockup/khqr?order=${encodeURIComponent(order.orderNumber)}`;
  const shopHref = `/${locale}/mockup/storefront`;

  const deliveryCard = (
      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{isPickup ? t("pickupInfo") : t("deliveryInfo")}</h2>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            {order.name}
          </li>
          <li className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="tabular-nums">{formatKhmerPhoneLocal(order.phone)}</span>
          </li>
          <li className="flex items-start gap-2">
            {isPickup ? (
              <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            ) : (
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            )}
            {isPickup ? (
              <span>
                <span className="block font-medium">{tCheckout("pickupAt")}</span>
                {order.pickupAddress}
                {order.pickupHours && <span className="block text-muted">{order.pickupHours}</span>}
              </span>
            ) : (
              <span>
                {placeLabel(order)}
                {order.landmark && <span className="block text-muted">{order.landmark}</span>}
              </span>
            )}
          </li>
        </ul>
      </section>
  );
  const shopCard = (
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("buyerOrderedFrom")}</h2>
          <p className="font-semibold">{storeName}</p>
        </div>
        {shopPhone && (
          <a
            href={`tel:+${profile.phone}`}
            className="flex min-h-touch items-center justify-center gap-2 rounded-DEFAULT border border-border text-sm font-medium"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {t("callShop", { phone: shopPhone })}
          </a>
        )}
        {/* Inert until the Telegram bot integration exists (blueprint Stage G). */}
        <Button variant="secondary" className="w-full">
          <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("telegramUpdates")}
        </Button>
        {canBuyerCancel(order) && (
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            className="flex min-h-touch items-center justify-center text-sm font-medium text-danger"
          >
            {t("cancelOrder")}
          </button>
        )}
        {order.status === "paid" && <p className="text-center text-sm text-muted">{t("cancelAfterPaid")}</p>}
      </section>
  );
  const mainAction = awaitingPayment ? (
    <Link href={payHref} className="block">
      <Button variant="primary" className="w-full">
        {t("payNow")} · {formatMoney(order.total, order.currency)}
      </Button>
    </Link>
  ) : (
    <Link href={shopHref} className="block">
      <Button variant={delivered || order.status === "cancelled" ? "primary" : "secondary"} className="w-full">
        {delivered || order.status === "cancelled" ? t("orderAgain") : t("backToShop")}
      </Button>
    </Link>
  );

  return (
    <BuyerShell wide className="pb-32 lg:pb-0">
      <BuyerColumns
        plain
        aside={
          <>
            {shopCard}
            {deliveryCard}
            {mainAction}
          </>
        }
      >
      <div className="flex flex-col gap-4 p-4 lg:p-0">
      <header className="flex flex-col items-center gap-2 pt-4 text-center">
        <span className={cn("flex h-16 w-16 items-center justify-center rounded-full", TONE_STYLES[ORDER_STATUS_TONE[order.status]])}>
          <Icon className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold leading-normal" role="status">
          {t(`buyerTitle_${headlineKey}`)}
        </h1>
        <p className="max-w-[36ch] text-sm text-muted">
          {/* A bus parcel has no driver to call: the buyer collects it with the ticket number. */}
          {order.status === "out_for_delivery" && order.dispatch?.route === "bus"
            ? t("buyerBody_out_for_delivery_bus")
            : t(`buyerBody_${headlineKey}`)}
        </p>
        <p className="text-sm text-muted">
          {t("orderNumber")}: <span className="font-semibold text-fg">{order.orderNumber}</span> · {storeName}
        </p>
      </header>

      {order.status === "cancelled" && order.cancellation && (
        <p className="rounded-2xl border border-danger/40 bg-danger/5 p-3 text-sm">
          <span className="font-medium">{t(`cancelReason_${order.cancellation.reason}`)}</span>
          {order.cancellation.note && <span className="block text-muted">{order.cancellation.note}</span>}
        </p>
      )}

      {progress !== null && (
        <section className="rounded-2xl border border-border bg-bg p-4" aria-label={t("progressLabel")}>
          <ol className="flex flex-col">
            {BUYER_ORDER_STEPS.map((step, index) => {
              const done = index < doneCount;
              const current = index === doneCount;
              const time = index <= progress ? stepTime(index) : null;
              const stepKey = step === "sending" && isPickup ? "ready" : step;
              return (
                <li key={step} className="flex gap-3" aria-current={current ? "step" : undefined}>
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                        done
                          ? "border-success bg-success text-bg"
                          : current
                            ? "border-brand bg-brand/10"
                            : "border-border bg-bg",
                      )}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : current ? (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-brand motion-reduce:animate-none" aria-hidden="true" />
                      ) : null}
                    </span>
                    {index < BUYER_ORDER_STEPS.length - 1 && (
                      <span className={cn("w-0.5 flex-1", index < doneCount - 1 ? "bg-success" : "bg-border")} aria-hidden="true" />
                    )}
                  </div>
                  <div className={cn("flex flex-1 items-baseline justify-between gap-2 pb-5", index === BUYER_ORDER_STEPS.length - 1 && "pb-0")}>
                    <span className={cn("text-sm", done || current ? "font-medium" : "text-muted")}>{t(`step_${stepKey}`)}</span>
                    {time && <span className="shrink-0 text-xs text-muted tabular-nums">{time}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {order.dispatch && order.dispatch.route !== "pickup" && order.status !== "cancelled" && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("onTheWay")}</h2>
          {order.dispatch.route === "driver" ? (
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{order.dispatch.driverName}</p>
                <p className="text-muted">{t("driver")}</p>
              </div>
              {order.dispatch.driverPhone && (
                <a
                  href={`tel:+${order.dispatch.driverPhone}`}
                  className="flex min-h-touch items-center gap-2 rounded-DEFAULT border border-border px-3 text-sm font-medium"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {formatKhmerPhoneLocal(order.dispatch.driverPhone)}
                </a>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 text-sm">
              <Bus className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              <div>
                <p className="font-medium">{order.dispatch.busCompany}</p>
                <p className="text-muted">
                  {t("ticketNumber")}: <span className="font-semibold text-fg">{order.dispatch.ticketNumber}</span>
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("items")}</h2>
        {order.lines.map((line) => (
          <div key={line.key} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">
              {orderLineLabel(line, locale, products)} × {line.qty}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatMoney(line.lineTotal, order.currency)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-border pt-2 text-sm text-muted">
          <span>{isPickup ? tCheckout("pickup") : tCheckout("deliveryFee")}</span>
          <span className="tabular-nums">{order.deliveryFee === 0 ? tCheckout("free") : formatMoney(order.deliveryFee, order.currency)}</span>
        </div>
        {order.vatPercent > 0 && (
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{tStore("vat", { percent: order.vatPercent })}</span>
            <span className="tabular-nums">{formatMoney(order.vat, order.currency)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
          <span>{t("total")}</span>
          <span className="text-lg tabular-nums">{formatMoney(order.total, order.currency)}</span>
        </div>
        <p className="text-sm text-muted">{paymentLabel(order)}</p>
      </section>

      {/* Phone and tablet: the delivery and shop cards follow; from 1024 px they're in the side column. */}
      <div className="flex flex-col gap-4 lg:hidden">
        {deliveryCard}
        {shopCard}
      </div>
      </div>
      </BuyerColumns>





      <BuyerBottomBar wide>{mainAction}</BuyerBottomBar>

      <ConfirmDialog
        open={confirmingCancel}
        title={t("cancelConfirmTitle")}
        body={t("cancelConfirmBody")}
        confirmLabel={t("cancelOrder")}
        cancelLabel={t("keepOrder")}
        danger
        onConfirm={() => {
          act(order.orderNumber, "cancel", { cancellation: { reason: "buyer_cancelled", note: "" } });
          setConfirmingCancel(false);
        }}
        onClose={() => setConfirmingCancel(false)}
      />
    </BuyerShell>
  );
}
