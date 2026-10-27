"use client";

import {
  formatTrackingCode,
  dispatchInputSchema,
  formatKhmerPhoneLocal,
  getDispatchRoute,
  getSellerActions,
  isCashOrder,
  orderCancellationSchema,
  SELLER_CANCEL_REASONS,
  toFieldErrors,
  type FormErrorCode,
  type OrderAction,
  type OrderCancelReason,
} from "@khmio/shared";
import { BottomSheet, Button, Card, Input, Select } from "@khmio/ui";
import { ArrowLeft, Bus, MapPin, Phone, Store, Truck, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { orderLineLabel, type OrderRecord } from "@/mock/mock-orders";
import { mockStore, mockTrackingCode } from "@/mock/mock-data";
import { OrderContactBar } from "@/components/seller-app";
import { useDeliverySettings } from "../../../delivery-settings-context";
import { useFormErrorText } from "@/components/form-ui";
import { useMerchantProducts } from "../../../merchant-products-context";
import { formatMoney, OrderStatusPill, useOrderText } from "@/components/order-ui";
import { useOrders } from "../../../orders-context";

const OTHER_DRIVER = "__other__";

export default function DashboardOrderDetailPage() {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const params = useParams<{ number: string }>();
  const { hydrated, orders } = useOrders();
  const { hydrated: deliveryReady } = useDeliverySettings();
  const listHref = `/${locale}/mockup/dashboard/orders`;

  if (!hydrated || !deliveryReady) return null;
  const order = orders.find((item) => item.orderNumber === decodeURIComponent(params.number));

  if (!order) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-3 p-4 pt-16 text-center text-fg">
        <p className="font-semibold">{t("notFoundTitle")}</p>
        <Link href={listHref} className="block">
          <Button variant="secondary">{t("backToOrders")}</Button>
        </Link>
      </div>
    );
  }
  return <OrderDetail order={order} listHref={listHref} />;
}

// Seller's order screen (design/screens.md S5). Which buttons show comes from
// getSellerActions — the screen never decides what may happen next by itself.
function OrderDetail({ order, listHref }: { order: OrderRecord; listHref: string }) {
  const t = useTranslations("Orders");
  const tStore = useTranslations("Storefront");
  const tCheckout = useTranslations("Checkout");
  const errorText = useFormErrorText();
  const locale = useLocale();
  const { act } = useOrders();
  const { products } = useMerchantProducts();
  const { settings: delivery } = useDeliverySettings();
  const { paymentLabel, placeLabel, timeAgo, clockTime, statusLabel, actionLabel } = useOrderText();

  const actions = getSellerActions(order);
  const primary = actions.find((action) => action !== "cancel" && action !== "fail_delivery");
  const route = getDispatchRoute(order);
  const isPickup = order.fulfilment === "pickup";
  const cash = isCashOrder(order);

  // "Send the order" form. The driver list comes from Delivery settings; any other driver can be typed in.
  const [driverId, setDriverId] = useState(delivery.drivers[0]?.id ?? OTHER_DRIVER);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [busCompany, setBusCompany] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [sendErrors, setSendErrors] = useState<Partial<Record<string, FormErrorCode>>>({});

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<OrderCancelReason>("out_of_stock");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelError, setCancelError] = useState<FormErrorCode | undefined>();

  function handleSend() {
    const picked = delivery.drivers.find((driver) => driver.id === driverId);
    const input =
      route === "driver"
        ? { route, driverName: picked ? picked.name : driverName, driverPhone: picked ? picked.phone : driverPhone }
        : route === "bus"
          ? { route, busCompany, ticketNumber }
          : { route };
    const result = dispatchInputSchema.safeParse(input);
    if (!result.success) {
      setSendErrors(toFieldErrors(result.error));
      return;
    }
    setSendErrors({});
    act(order.orderNumber, "dispatch", { dispatch: result.data });
  }

  function handleCancel() {
    const result = orderCancellationSchema.safeParse({ reason: cancelReason, note: cancelNote });
    if (!result.success) {
      setCancelError(toFieldErrors(result.error).note);
      return;
    }
    act(order.orderNumber, "cancel", { cancellation: result.data });
    setCancelOpen(false);
  }

  /** One sentence telling the seller what this step means. */
  function hint(action: OrderAction): string {
    if (action === "dispatch") return t(`hint_dispatch_${route}`);
    if (action === "mark_delivered") return t(isPickup ? "hint_mark_delivered_pickup" : "hint_mark_delivered");
    if (action === "rebook" && isPickup) return t("hint_rebook_pickup");
    if (action === "settle_cash" && isPickup) return t("hint_settle_cash_pickup");
    return t(`hint_${action}`);
  }

  const nextStep = (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("nextStep")}</h2>
        <OrderStatusPill order={order} />
      </div>

      {order.status === "awaiting_payment" && <p className="text-sm text-muted">{t("hint_awaiting_payment")}</p>}
      {actions.length === 0 && <p className="text-sm text-muted">{t(order.status === "cancelled" ? "hint_cancelled" : "hint_completed")}</p>}
      {order.status === "cancelled" && order.cancellation && (
        <p className="rounded-DEFAULT bg-danger/5 p-3 text-sm">
          <span className="font-medium">{t(`cancelReason_${order.cancellation.reason}`)}</span>
          {order.cancellation.note && <span className="block text-muted">{order.cancellation.note}</span>}
        </p>
      )}

      {primary && <p className="text-sm text-muted">{hint(primary)}</p>}

      {primary === "dispatch" && route === "driver" && (
        <div className="flex flex-col gap-3">
          {/* With no saved drivers, the only choice would be "another driver" — so go straight to the name and phone. */}
          {delivery.drivers.length > 0 && (
            <Select
              label={t("driver")}
              value={driverId}
              onChange={(e) => {
                setDriverId(e.target.value);
                setSendErrors({});
              }}
              options={[
                ...delivery.drivers.map((driver) => ({
                  value: driver.id,
                  label: `${driver.name} · ${formatKhmerPhoneLocal(driver.phone)}`,
                })),
                { value: OTHER_DRIVER, label: t("otherDriver") },
              ]}
            />
          )}
          {driverId === OTHER_DRIVER && (
            <>
              <Input
                label={t("driverName")}
                value={driverName}
                onChange={(e) => {
                  setDriverName(e.target.value);
                  setSendErrors((prev) => ({ ...prev, driverName: undefined }));
                }}
                error={errorText(sendErrors.driverName)}
              />
              <Input
                label={t("driverPhone")}
                prefix="+855"
                inputMode="tel"
                placeholder="012 345 678"
                value={driverPhone}
                onChange={(e) => {
                  setDriverPhone(e.target.value);
                  setSendErrors((prev) => ({ ...prev, driverPhone: undefined }));
                }}
                error={errorText(sendErrors.driverPhone)}
              />
            </>
          )}
          {cash && (
            <p className="rounded-DEFAULT bg-warning/10 p-3 text-sm font-medium text-warning">
              {t("collectCash", { amount: formatMoney(order.total, order.currency) })}
            </p>
          )}
        </div>
      )}

      {primary === "dispatch" && route === "bus" && (
        <div className="flex flex-col gap-3">
          <Input
            label={t("busCompany")}
            placeholder={t("busCompanyPlaceholder")}
            value={busCompany}
            onChange={(e) => {
              setBusCompany(e.target.value);
              setSendErrors((prev) => ({ ...prev, busCompany: undefined }));
            }}
            error={errorText(sendErrors.busCompany)}
          />
          <Input
            label={t("ticketNumber")}
            value={ticketNumber}
            onChange={(e) => {
              setTicketNumber(e.target.value);
              setSendErrors((prev) => ({ ...prev, ticketNumber: undefined }));
            }}
            error={errorText(sendErrors.ticketNumber)}
          />
        </div>
      )}

      {primary && (
        <Button
          variant="primary"
          className="w-full"
          onClick={() => (primary === "dispatch" ? handleSend() : act(order.orderNumber, primary))}
        >
          {actionLabel(order, primary, route)}
        </Button>
      )}

      {(actions.includes("fail_delivery") || actions.includes("cancel")) && (
        <div className="flex flex-wrap gap-2">
          {actions.includes("fail_delivery") && (
            <Button variant="secondary" className="flex-1" onClick={() => act(order.orderNumber, "fail_delivery")}>
              {actionLabel(order, "fail_delivery")}
            </Button>
          )}
          {actions.includes("cancel") && (
            <Button
              variant="secondary"
              className="flex-1 text-danger"
              onClick={() => {
                setCancelReason("out_of_stock");
                setCancelNote("");
                setCancelError(undefined);
                setCancelOpen(true);
              }}
            >
              {t("cancelOrder")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-4 text-fg md:p-6">
      <div className="flex items-center gap-1">
        <Link
          href={listHref}
          aria-label={t("backToOrders")}
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/30"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold leading-normal">{order.orderNumber}</h1>
          <p className="text-sm text-muted">{timeAgo(order.placedAtIso)}</p>
        </div>
      </div>

      {/* Call, Telegram, copy address and the invoice — one tap each, above everything else. */}
      <OrderContactBar
        phone={order.phone}
        address={[order.fulfilment === "pickup" ? order.pickupAddress ?? "" : placeLabel(order), order.landmark].filter(Boolean).join(" · ")}
        invoiceHref={`/${locale}/mockup/order/${encodeURIComponent(order.orderNumber)}/invoice`}
        trackingCode={formatTrackingCode(mockStore.slug, mockTrackingCode(order.orderNumber))}
      />

      {/* Phone and tablet: the next step first. Desktop: order on the left, actions and history on the right. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-4 lg:order-2 print:hidden">{nextStep}</div>

        <div className="flex flex-col gap-4 lg:order-1">
          <Card className="flex flex-col gap-2 p-4">
            <h2 className="font-semibold">{t("items")}</h2>
            {order.lines.map((line) => (
              <div key={line.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold tabular-nums">{line.qty} ×</span> {orderLineLabel(line, locale, products)}
                </span>
                <span className="shrink-0 tabular-nums">{formatMoney(line.lineTotal, order.currency)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-2 text-sm text-muted">
              <span>{isPickup ? tCheckout("pickup") : tCheckout("deliveryFee")}</span>
              <span className="tabular-nums">
                {order.deliveryFee === 0 ? tCheckout("free") : formatMoney(order.deliveryFee, order.currency)}
              </span>
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
            <p className={cash && order.status !== "completed" ? "text-sm font-medium text-warning" : "text-sm text-muted"}>
              {cash && order.status !== "completed" && order.status !== "cancelled"
                ? t("cashToCollect", { amount: formatMoney(order.total, order.currency) })
                : paymentLabel(order)}
            </p>
          </Card>

          <Card className="flex flex-col gap-3 p-4">
            <h2 className="font-semibold">{t("buyer")}</h2>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{order.name}</span>
              <a
                href={`tel:+${order.phone}`}
                className="flex min-h-touch shrink-0 items-center gap-2 rounded-DEFAULT border border-border px-3 text-sm font-medium print:border-0"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                <span className="tabular-nums">{formatKhmerPhoneLocal(order.phone)}</span>
              </a>
            </div>
            <div className="flex items-start gap-3 text-sm">
              {isPickup ? (
                <Store className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              ) : (
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              )}
              <span>
                <span className="block font-medium">{isPickup ? t("buyerPicksUp") : placeLabel(order)}</span>
                {order.landmark && <span className="block text-muted">{order.landmark}</span>}
              </span>
            </div>
            {order.dispatch && order.dispatch.route !== "pickup" && (
              <div className="flex items-start gap-3 border-t border-border pt-3 text-sm">
                {order.dispatch.route === "driver" ? (
                  <Truck className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                ) : (
                  <Bus className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                )}
                {order.dispatch.route === "driver" ? (
                  <span>
                    <span className="block font-medium">{order.dispatch.driverName}</span>
                    <span className="block text-muted tabular-nums">
                      {order.dispatch.driverPhone ? formatKhmerPhoneLocal(order.dispatch.driverPhone) : ""}
                    </span>
                  </span>
                ) : (
                  <span>
                    <span className="block font-medium">{order.dispatch.busCompany}</span>
                    <span className="block text-muted">
                      {t("ticketNumber")}: {order.dispatch.ticketNumber}
                    </span>
                  </span>
                )}
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-2 p-4 print:hidden">
            <h2 className="font-semibold">{t("history")}</h2>
            <ol className="flex flex-col gap-2 text-sm">
              {[...order.timeline].reverse().map((entry, index) => (
                <li key={`${entry.status}-${entry.atIso}`} className="flex items-baseline justify-between gap-3">
                  <span className={index === 0 ? "font-medium" : "text-muted"}>{statusLabel({ ...order, status: entry.status })}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">{clockTime(entry.atIso)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <BottomSheet open={cancelOpen} onClose={() => setCancelOpen(false)} closeLabel={t("keepOrder")} title={t("cancelOrder")} placement="center">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t("cancelSellerBody")}</p>
          <Select
            label={t("cancelReasonLabel")}
            value={cancelReason}
            onChange={(e) => {
              const next = SELLER_CANCEL_REASONS.find((reason) => reason === e.target.value);
              if (next) setCancelReason(next);
              setCancelError(undefined);
            }}
            options={SELLER_CANCEL_REASONS.map((reason) => ({ value: reason, label: t(`cancelReason_${reason}`) }))}
          />
          <Input
            label={cancelReason === "other" ? t("cancelNoteRequired") : t("cancelNote")}
            maxLength={200}
            value={cancelNote}
            onChange={(e) => {
              setCancelNote(e.target.value);
              setCancelError(undefined);
            }}
            error={errorText(cancelError)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="w-full" onClick={() => setCancelOpen(false)}>
              {t("keepOrder")}
            </Button>
            <Button variant="danger" className="w-full" onClick={handleCancel}>
              {t("cancelOrder")}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
