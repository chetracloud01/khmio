"use client";

import {
  dispatchInputSchema,
  formatKhmerPhoneLocal,
  isCashOrder,
  orderCancellationSchema,
  SELLER_CANCEL_REASONS,
  toFieldErrors,
  type Driver,
  type FormErrorCode,
  type OrderActionRequest,
  type OrderCancelReason,
  type SellerOrderAction,
} from "@khmio/shared";
import { BottomSheet, Button, Card, Input, Select } from "@khmio/ui";
import { ArrowLeft, Bus, MapPin, Phone, Store, Truck, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { formatMoney, OrderStatusPill, useOrderText } from "@/components/order-ui";
import { OrderContactBar } from "@/components/seller-app";
import { SELLER_FORM } from "@/components/seller-frame/seller-frame";
import { api, ApiError, type DeliveryResponse, type SellerOrderDetail } from "@/lib/api";
import { PageLoading, PageOffline } from "../../page-states";

const OTHER_DRIVER = "__other__";

export default function OrderDetailPage() {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<SellerOrderDetail | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "offline">("loading");

  const load = useCallback(() => {
    setState("loading");
    Promise.all([api<SellerOrderDetail>(`/orders/${id}`), api<DeliveryResponse>("/delivery")])
      .then(([detail, delivery]) => {
        setOrder(detail);
        setDrivers(delivery.settings.drivers);
        setState("ready");
      })
      .catch((error: unknown) => setState(error instanceof ApiError && (error.status === 404 || error.status === 400) ? "not_found" : "offline"));
  }, [id]);
  useEffect(load, [load]);

  if (state === "offline") return <PageOffline onRetry={load} />;
  if (state === "not_found") {
    return (
      <div className="flex flex-col items-center gap-3 p-4 pt-16 text-center">
        <p className="font-semibold">{t("notFoundTitle")}</p>
        <Link href={`/${locale}/m/orders`} className="block">
          <Button variant="secondary">{t("backToOrders")}</Button>
        </Link>
      </div>
    );
  }
  if (!order) return <PageLoading />;
  return <OrderDetail order={order} drivers={drivers} onChanged={setOrder} onReload={load} />;
}

// The seller's order screen (design/screens.md S5). Which buttons show comes
// from the API (packages/shared getSellerActions) — the screen never decides
// by itself what may happen next.
function OrderDetail({
  order,
  drivers,
  onChanged,
  onReload,
}: {
  order: SellerOrderDetail;
  drivers: Driver[];
  onChanged: (order: SellerOrderDetail) => void;
  onReload: () => void;
}) {
  const t = useTranslations("Orders");
  const tStore = useTranslations("Storefront");
  const tCheckout = useTranslations("Checkout");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const locale = useLocale();
  const { paymentLabel, placeLabel, timeAgo, clockTime, statusLabel, actionLabel } = useOrderText();

  const actions = order.actions;
  const primary = actions.find((action) => action !== "cancel" && action !== "fail_delivery");
  const route = order.route;
  const isPickup = order.fulfilment === "pickup";
  const cash = isCashOrder(order);
  const dispatch = order.dispatches[0];

  // "Send the order": the shop's saved drivers (Delivery page), or any other driver typed in.
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? OTHER_DRIVER);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [busCompany, setBusCompany] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [sendErrors, setSendErrors] = useState<Partial<Record<string, FormErrorCode>>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<OrderCancelReason>("out_of_stock");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelError, setCancelError] = useState<FormErrorCode | undefined>();

  async function run(request: OrderActionRequest) {
    setBusy(true);
    setProblem(null);
    try {
      onChanged(await api<SellerOrderDetail>(`/orders/${order.id}/actions`, { method: "POST", body: request }));
      return true;
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "action_not_allowed") {
        // Moved on meanwhile (from Telegram, another phone): show it as it is now.
        setProblem(tApp("orderMovedOn"));
        onReload();
      } else if (failure instanceof ApiError && failure.code === "store_paused") setProblem(tApp("storePaused"));
      else if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) {
        setSendErrors(Object.fromEntries(Object.entries(failure.fields).map(([key, code]) => [key.replace(/^dispatch\./, ""), code])));
      } else setProblem(tApp("saveFailed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleSend() {
    const picked = drivers.find((driver) => driver.id === driverId);
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
    void run({ action: "dispatch", dispatch: result.data });
  }

  async function handleCancel() {
    const result = orderCancellationSchema.safeParse({ reason: cancelReason, note: cancelNote });
    if (!result.success) {
      setCancelError(toFieldErrors(result.error).note);
      return;
    }
    if (await run({ action: "cancel", cancellation: result.data })) setCancelOpen(false);
  }

  /** One sentence telling the seller what this step means. */
  function hint(action: SellerOrderAction): string {
    if (action === "dispatch") return t(`hint_dispatch_${route}`);
    if (action === "mark_delivered") return t(isPickup ? "hint_mark_delivered_pickup" : "hint_mark_delivered");
    if (action === "rebook" && isPickup) return t("hint_rebook_pickup");
    if (action === "settle_cash" && isPickup) return t("hint_settle_cash_pickup");
    return t(`hint_${action}`);
  }

  const text = (km: string, en: string) => (locale === "km" ? km || en : en || km);

  return (
    <div className={`${SELLER_FORM} gap-4`}>
      <div className="flex items-center gap-1">
        <Link href={`/${locale}/m/orders`} aria-label={t("backToOrders")} className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/30 print:hidden">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold leading-normal">
            {t("orderNumber")} #{order.orderNumber}
          </h1>
          <p className="text-sm text-muted">{timeAgo(order.createdAt)}</p>
        </div>
      </div>

      {/* Call, Telegram, copy address and the invoice (design/screens.md B7) — one tap each, above everything else. */}
      <div className="print:hidden">
        <OrderContactBar
          phone={order.buyerPhone}
          address={[isPickup ? order.pickupAddress : placeLabel(order), order.landmark].filter(Boolean).join(" · ")}
          invoiceHref={`/${locale}/m/orders/${order.id}/invoice`}
          trackingCode={order.trackingCode}
        />
      </div>

      <Card className="flex flex-col gap-3 p-4 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{t("nextStep")}</h2>
          <OrderStatusPill order={order} />
        </div>
        {problem && (
          <p role="alert" className="rounded-DEFAULT border border-warning/40 bg-warning/5 p-3 text-sm">
            {problem}
          </p>
        )}
        {order.status === "awaiting_payment" && <p className="text-sm text-muted">{t("hint_awaiting_payment")}</p>}
        {actions.length === 0 && <p className="text-sm text-muted">{t(order.status === "cancelled" ? "hint_cancelled" : "hint_completed")}</p>}
        {order.status === "cancelled" && order.cancelReason && (
          <p className="rounded-DEFAULT bg-danger/5 p-3 text-sm">
            <span className="font-medium">{t(`cancelReason_${order.cancelReason}`)}</span>
            {order.cancelNote && <span className="block text-muted">{order.cancelNote}</span>}
          </p>
        )}

        {primary && <p className="text-sm text-muted">{hint(primary)}</p>}

        {primary === "dispatch" && route === "driver" && (
          <div className="flex flex-col gap-3">
            {/* With no saved drivers, the only choice would be "another driver" — so go straight to the name and phone. */}
            {drivers.length > 0 && (
              <Select
                label={t("driver")}
                value={driverId}
                onChange={(e) => {
                  setDriverId(e.target.value);
                  setSendErrors({});
                }}
                options={[
                  ...drivers.map((driver) => ({ value: driver.id, label: `${driver.name} · ${formatKhmerPhoneLocal(driver.phone)}` })),
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
                    setSendErrors((previous) => ({ ...previous, driverName: undefined }));
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
                    setSendErrors((previous) => ({ ...previous, driverPhone: undefined }));
                  }}
                  error={errorText(sendErrors.driverPhone)}
                />
              </>
            )}
            {cash && <p className="rounded-DEFAULT bg-warning/10 p-3 text-sm font-medium text-warning">{t("collectCash", { amount: formatMoney(order.totalMinor, order.currency) })}</p>}
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
                setSendErrors((previous) => ({ ...previous, busCompany: undefined }));
              }}
              error={errorText(sendErrors.busCompany)}
            />
            <Input
              label={t("ticketNumber")}
              value={ticketNumber}
              onChange={(e) => {
                setTicketNumber(e.target.value);
                setSendErrors((previous) => ({ ...previous, ticketNumber: undefined }));
              }}
              error={errorText(sendErrors.ticketNumber)}
            />
          </div>
        )}

        {primary && (
          <Button variant="primary" className="w-full" loading={busy} onClick={() => (primary === "dispatch" ? handleSend() : void run({ action: primary } as OrderActionRequest))}>
            {actionLabel(order, primary, route)}
          </Button>
        )}

        {(actions.includes("fail_delivery") || actions.includes("cancel")) && (
          <div className="flex flex-wrap gap-2">
            {actions.includes("fail_delivery") && (
              <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => void run({ action: "fail_delivery" })}>
                {actionLabel(order, "fail_delivery")}
              </Button>
            )}
            {actions.includes("cancel") && (
              <Button
                variant="secondary"
                className="flex-1 text-danger"
                disabled={busy}
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

      <Card className="flex flex-col gap-2 p-4">
        <h2 className="font-semibold">{t("items")}</h2>
        {order.items.map((item, index) => {
          const option = text(item.variantLabelKm, item.variantLabelEn);
          return (
            <div key={index} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="font-semibold tabular-nums">{item.quantity} ×</span> {text(item.titleKm, item.titleEn)}
                {option && <span className="text-muted"> – {option}</span>}
              </span>
              <span className="shrink-0 tabular-nums">{formatMoney(item.lineTotalMinor, order.currency)}</span>
            </div>
          );
        })}
        <div className="flex items-center justify-between border-t border-border pt-2 text-sm text-muted">
          <span>{isPickup ? tCheckout("pickup") : tCheckout("deliveryFee")}</span>
          <span className="tabular-nums">{order.deliveryFeeMinor === 0 ? tCheckout("free") : formatMoney(order.deliveryFeeMinor, order.currency)}</span>
        </div>
        {order.vatMinor > 0 && (
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{tStore("vat", { percent: order.vatPercent })}</span>
            <span className="tabular-nums">{formatMoney(order.vatMinor, order.currency)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
          <span>{t("total")}</span>
          <span className="text-lg tabular-nums">{formatMoney(order.totalMinor, order.currency)}</span>
        </div>
        <p className={cash && order.status !== "completed" && order.status !== "cancelled" ? "text-sm font-medium text-warning" : "text-sm text-muted"}>
          {cash && order.status !== "completed" && order.status !== "cancelled" ? t("cashToCollect", { amount: formatMoney(order.totalMinor, order.currency) }) : paymentLabel(order)}
        </p>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-semibold">{t("buyer")}</h2>
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{order.buyerName}</span>
          <a href={`tel:+${order.buyerPhone}`} className="flex min-h-touch shrink-0 items-center gap-2 rounded-DEFAULT border border-border px-3 text-sm font-medium">
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span className="tabular-nums">{formatKhmerPhoneLocal(order.buyerPhone)}</span>
          </a>
        </div>
        <div className="flex items-start gap-3 text-sm">
          {isPickup ? <Store className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" /> : <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />}
          <span>
            <span className="block font-medium">{isPickup ? t("buyerPicksUp") : placeLabel(order)}</span>
            {order.landmark && <span className="block text-muted">{order.landmark}</span>}
          </span>
        </div>
        {dispatch && dispatch.route !== "pickup" && (
          <div className="flex items-start gap-3 border-t border-border pt-3 text-sm">
            {dispatch.route === "driver" ? <Truck className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" /> : <Bus className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />}
            {dispatch.route === "driver" ? (
              <span>
                <span className="block font-medium">{dispatch.driverName}</span>
                <a href={`tel:+${dispatch.driverPhone}`} className="flex min-h-touch items-center text-brand tabular-nums">
                  {formatKhmerPhoneLocal(dispatch.driverPhone)}
                </a>
              </span>
            ) : (
              <span>
                <span className="block font-medium">{dispatch.busCompany}</span>
                <span className="block text-muted">
                  {t("ticketNumber")}: {dispatch.ticketNumber}
                </span>
              </span>
            )}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-4 print:hidden">
        <h2 className="font-semibold">{t("history")}</h2>
        <ol className="flex flex-col gap-2 text-sm">
          {[...order.events].reverse().map((entry, index) => (
            <li key={`${entry.status}-${entry.at}`} className="flex items-baseline justify-between gap-3">
              <span className={index === 0 ? "font-medium" : "text-muted"}>{statusLabel({ ...order, status: entry.status })}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{clockTime(entry.at)}</span>
            </li>
          ))}
        </ol>
      </Card>

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
            <Button variant="danger" className="w-full" loading={busy} onClick={() => void handleCancel()}>
              {t("cancelOrder")}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
