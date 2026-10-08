"use client";

import {
  checkoutInputSchema,
  deliveryFeeIn,
  formatKhr,
  formatUsd,
  getAvailablePaymentMethods,
  getDeliverableDistrictIds,
  getDeliveryQuote,
  PHNOM_PENH_DISTRICTS,
  placeName,
  PROVINCES,
  toFieldErrors,
  type Currency,
  type DeliveryFee,
  type FormErrorCode,
  type Fulfilment,
} from "@khmio/shared";
import { Button, cn, Input, Select } from "@khmio/ui";
import { AlertTriangle, Check, Clock, MapPin, Store, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { mockPaymentMethods, type MockPaymentMethodCode } from "@/mock/mock-data";
import { BuyerBottomBar, BuyerColumns, BuyerSection, BuyerShell, BuyerSteps, BuyerTopBar } from "@/components/buyer-shell";
import { useCart } from "../cart-context";
import { useDeliverySettings } from "../delivery-settings-context";
import { focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import { useClampCartToStock } from "../online-stock";
import { useOrders } from "../orders-context";
import { useStorePayments, useStoreSettings } from "../store-settings-context";
import { useCheckoutTotal } from "../use-checkout-total";

type Field = "name" | "phone" | "districtId" | "provinceId";

// One page, not a wizard (design/design-standard.md §6): who, how to get it,
// where, how to pay — then one button with the amount.
export default function CheckoutMockupPage() {
  const t = useTranslations("Checkout");
  const tStore = useTranslations("Storefront");
  const tCart = useTranslations("Cart");
  const errorText = useFormErrorText();
  const locale = useLocale();
  const router = useRouter();
  const {
    quantities,
    setQuantities,
    appliedPromo,
    setAppliedPromo,
    currency,
    setCurrency,
    name,
    setName,
    phone,
    setPhone,
    fulfilment,
    setFulfilment,
    area,
    setArea,
    districtId,
    setDistrictId,
    provinceId,
    setProvinceId,
    landmark,
    setLandmark,
    rememberDetails,
    setRememberDetails,
    clearCart,
  } = useCart();

  const [errors, setErrors] = useState<Partial<Record<Field, FormErrorCode>>>({});
  const [paymentMethod, setPaymentMethod] = useState<MockPaymentMethodCode>(mockPaymentMethods[0]!.code);
  const [submitted, setSubmitted] = useState(false);
  // Set once the order is created, so the emptied cart doesn't flash "your cart is empty" before the next screen loads.
  const [placed, setPlaced] = useState(false);
  const { placeOrder } = useOrders();
  const formRef = useRef<HTMLDivElement>(null);

  const { settings: storeSettings, rate } = useStoreSettings();
  const { settings: delivery } = useDeliverySettings();
  // Stock may have run out since the cart was filled; the total below then uses what's really left.
  const stockCheck = useClampCartToStock(quantities, setQuantities);

  const format = (amount: number, cur: Currency) => (cur === "USD" ? formatUsd(amount) : formatKhr(amount));
  const feeText = (fee: DeliveryFee) => {
    const amount = deliveryFeeIn(fee, currency, rate);
    return amount === 0 ? t("free") : format(amount, currency);
  };

  // What this shop offers. A buyer only ever sees choices that can work.
  const deliversInPhnomPenh = delivery.zones.length > 0;
  const deliversToProvinces = delivery.province.enabled;
  const canDeliver = deliversInPhnomPenh || deliversToProvinces;
  const canPickup = delivery.pickup.enabled;
  const districtOptions = PHNOM_PENH_DISTRICTS.filter((place) => getDeliverableDistrictIds(delivery).includes(place.id)).map(
    (place) => {
      const quote = getDeliveryQuote(delivery, { fulfilment: "delivery", area: "phnom_penh", districtId: place.id });
      return { value: place.id, label: `${placeName(place, locale)} — ${quote.status === "ok" ? feeText(quote.fee) : ""}` };
    },
  );
  const cheapestZoneFee = delivery.zones.length
    ? Math.min(...delivery.zones.map((zone) => deliveryFeeIn(zone, currency, rate)))
    : null;

  // Keep the saved choice valid if the shop changed what it offers since last time.
  useEffect(() => {
    if (fulfilment === "delivery" && !canDeliver && canPickup) setFulfilment("pickup");
    if (fulfilment === "pickup" && !canPickup && canDeliver) setFulfilment("delivery");
    if (area === "phnom_penh" && !deliversInPhnomPenh && deliversToProvinces) setArea("province");
    if (area === "province" && !deliversToProvinces && deliversInPhnomPenh) setArea("phnom_penh");
  }, [fulfilment, area, canDeliver, canPickup, deliversInPhnomPenh, deliversToProvinces, setFulfilment, setArea]);

  // Only what this shop has set up: KHQR needs its Bakong ID, PayWay its keys;
  // cash needs the setting on and either pickup or a Phnom Penh address.
  const { khqrReady, payWayReady } = useStorePayments();
  const availableMethods = getAvailablePaymentMethods({
    khqrReady,
    payWayReady,
    storeAllowsCod: storeSettings.allowCod,
    area,
    fulfilment,
  });

  // Keep the payment choice valid when the area or delivery/pickup changes.
  useEffect(() => {
    const first = availableMethods[0];
    if (first && !availableMethods.includes(paymentMethod)) setPaymentMethod(first);
  }, [availableMethods, paymentMethod]);

  const { lines, itemCount, subtotal, itemDiscount, promoDiscount, deliveryFee, deliveryStatus, vat, total, secondaryTotal } =
    useCheckoutTotal(quantities, locale, appliedPromo, currency);

  const canTakeOrder = availableMethods.length > 0 && (canDeliver || canPickup) && deliveryStatus !== "unavailable";

  // The same schema the API checks the order with (packages/shared checkout.ts).
  function parseCheckout() {
    return checkoutInputSchema.safeParse({
      name,
      phone,
      currency,
      fulfilment,
      area,
      districtId: districtId || undefined,
      provinceId: provinceId || undefined,
      landmark,
      paymentMethod,
      storeAllowsCod: storeSettings.allowCod,
    });
  }

  function checkoutErrors() {
    const result = parseCheckout();
    return result.success ? {} : toFieldErrors(result.error);
  }

  function checkField(field: Field) {
    setErrors((prev) => ({ ...prev, [field]: checkoutErrors()[field] }));
  }

  function clearError(field: Field) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function handleSubmit() {
    if (!canTakeOrder) return;
    const found = checkoutErrors();
    const next: Partial<Record<Field, FormErrorCode>> = {
      name: found.name,
      phone: found.phone,
      districtId: found.districtId,
      provinceId: found.provinceId,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      focusFirstInvalidField(formRef.current);
      return;
    }
    const result = parseCheckout();
    if (!result.success) return;
    // ABA PayWay's own checkout isn't built yet, so no order is created for it.
    if (paymentMethod === "aba_payway") {
      setSubmitted(true);
      return;
    }

    // The order exists from this moment (design/screens.md B6): cash orders go
    // to the seller at once; KHQR orders wait for payment on the next screen.
    const valid = result.data;
    const isPickup = valid.fulfilment === "pickup";
    const order = placeOrder({
      paymentMethod: valid.paymentMethod,
      currency,
      total,
      deliveryFee,
      vat,
      vatPercent: storeSettings.vatPercent,
      lines: lines.map((line) => ({ key: line.key, label: line.title, qty: line.qty, lineTotal: line.discounted * line.qty })),
      name: valid.name,
      phone: valid.phone,
      fulfilment: valid.fulfilment,
      area: valid.area,
      districtId: !isPickup && valid.area === "phnom_penh" ? valid.districtId : undefined,
      provinceId: !isPickup && valid.area === "province" ? valid.provinceId : undefined,
      landmark: isPickup ? "" : valid.landmark,
      pickupAddress: isPickup ? delivery.pickup.address : undefined,
      pickupHours: isPickup ? delivery.pickup.hours : undefined,
    });
    setPlaced(true);
    clearCart();
    const number = encodeURIComponent(order.orderNumber);
    router.push(valid.paymentMethod === "khqr" ? `/${locale}/mockup/khqr?order=${number}` : `/${locale}/mockup/order/${number}`);
  }

  if (placed) return null;

  if (itemCount === 0 && !submitted) {
    return (
      <BuyerShell className="items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm text-muted">{tCart("empty")}</p>
        <Link href={`/${locale}/mockup/storefront`} className="block">
          <Button variant="primary">{tCart("browseMenu")}</Button>
        </Link>
      </BuyerShell>
    );
  }

  if (submitted) {
    return (
      <BuyerShell className="items-center justify-center gap-3 p-4 text-center">
        <Check className="h-10 w-10 text-success" aria-hidden="true" />
        <p className="text-lg font-semibold">{t("submittedTitle")}</p>
        <p className="text-sm text-muted">{t("submittedBody")}</p>
        <Link href={`/${locale}/mockup/cart`} className="block">
          <Button variant="secondary">{t("backToCart")}</Button>
        </Link>
      </BuyerShell>
    );
  }

  const fulfilmentCards: { value: Fulfilment; icon: typeof Truck; title: string; detail: string; show: boolean }[] = [
    {
      value: "delivery",
      icon: Truck,
      title: t("delivery"),
      detail:
        cheapestZoneFee === null
          ? feeText(delivery.province)
          : cheapestZoneFee === 0
            ? t("free")
            : t("feeFrom", { fee: format(cheapestZoneFee, currency) }),
      show: canDeliver,
    },
    { value: "pickup", icon: Store, title: t("pickup"), detail: t("free"), show: canPickup },
  ];

  const segment = (active: boolean) =>
    cn(
      "min-h-touch rounded-full px-4 text-sm font-medium transition-colors",
      active ? "bg-brand text-on-brand" : "text-muted hover:text-fg",
    );

  const summary = (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4">
          <h2 className="font-semibold">{t("sectionSummary")}</h2>
          {appliedPromo && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-success">{tStore("promoApplied", { code: appliedPromo.code })}</span>
              <button
                type="button"
                onClick={() => setAppliedPromo(null)}
                className="flex min-h-touch items-center px-2 text-sm text-muted underline"
              >
                {tStore("remove")}
              </button>
            </div>
          )}
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between text-muted">
              <dt>{tStore("subtotal")}</dt>
              <dd className="tabular-nums">{format(subtotal, currency)}</dd>
            </div>
            {itemDiscount > 0 && (
              <div className="flex items-center justify-between text-success">
                <dt>{tStore("itemDiscount")}</dt>
                <dd className="tabular-nums">-{format(itemDiscount, currency)}</dd>
              </div>
            )}
            {promoDiscount > 0 && (
              <div className="flex items-center justify-between text-success">
                <dt>{tStore("promoDiscount")}</dt>
                <dd className="tabular-nums">-{format(promoDiscount, currency)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between text-muted">
              <dt>{fulfilment === "pickup" ? t("pickup") : t("deliveryFee")}</dt>
              <dd className="tabular-nums">
                {deliveryStatus === "ok"
                  ? deliveryFee === 0
                    ? t("free")
                    : format(deliveryFee, currency)
                  : deliveryStatus === "incomplete"
                    ? t("feeAfterChoice")
                    : "—"}
              </dd>
            </div>
            {storeSettings.vatPercent > 0 && (
              <div className="flex items-center justify-between text-muted">
                <dt>{tStore("vat", { percent: storeSettings.vatPercent })}</dt>
                <dd className="tabular-nums">{format(vat, currency)}</dd>
              </div>
            )}
          </dl>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-semibold">{tStore("totalToPay")}</span>
            <span className="text-right">
              <span className="block text-lg font-bold tabular-nums">{format(total, currency)}</span>
              <span className="block text-xs text-muted">≈ {format(secondaryTotal, currency === "USD" ? "KHR" : "USD")}</span>
            </span>
          </div>
        </section>
  );
  const placeOrderButton = (
    <Button variant="primary" className="w-full" onClick={handleSubmit} disabled={!canTakeOrder}>
      {t("placeOrder")} · {format(total, currency)}
    </Button>
  );
  // What a buyer may wonder before pressing the button.
  const trust = (
    <ul className="flex flex-col gap-1 text-sm text-muted">
      {paymentMethod === "cod" && <li>{t("trustCod")}</li>}
      <li>{t("trustDetails")}</li>
    </ul>
  );

  return (
    <BuyerShell wide className="pb-32 lg:pb-0">
      <BuyerTopBar backHref={`/${locale}/mockup/cart`} backLabel={t("backToCart")} title={t("title")}>
        <BuyerSteps steps={[tCart("stepCart"), tCart("stepCheckout"), tCart("stepPay")]} current={1} />
      </BuyerTopBar>

      <BuyerColumns
        plain
        aside={
          <>
            {summary}
            {placeOrderButton}
            {trust}
          </>
        }
      >
      <div ref={formRef} className="flex flex-col gap-4 p-4 lg:p-0">
        {stockCheck.adjusted && (
          <p role="status" className="flex items-start gap-2 rounded-DEFAULT border border-warning/40 bg-warning/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            {tCart("stockAdjusted")}
          </p>
        )}

        <BuyerSection number={1} title={t("sectionYou")}>
          <Input
            label={t("name")}
            placeholder={t("namePlaceholder")}
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
            onBlur={() => checkField("name")}
            error={errors.name ? t("nameError") : undefined}
          />
          <Input
            label={t("phone")}
            prefix="+855"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="012 345 678"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearError("phone");
            }}
            onBlur={() => checkField("phone")}
            error={errorText(errors.phone)}
          />
        </BuyerSection>

        <BuyerSection number={2} title={t("sectionHow")}>
          {!canDeliver && !canPickup ? (
            <p role="status" className="flex items-start gap-2 rounded-DEFAULT border border-warning/40 bg-warning/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              {t("noPaymentMethods")}
            </p>
          ) : (
            <div role="radiogroup" aria-label={t("sectionHow")} className="grid grid-cols-2 gap-3">
              {fulfilmentCards
                .filter((card) => card.show)
                .map((card) => {
                  const selected = fulfilment === card.value;
                  return (
                    <button
                      key={card.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setFulfilment(card.value)}
                      className={cn(
                        "flex min-h-touch flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-colors",
                        selected ? "border-brand bg-brand/5" : "border-border hover:bg-border/10",
                      )}
                    >
                      <card.icon className={cn("h-5 w-5", selected ? "text-brand" : "text-muted")} aria-hidden="true" />
                      <span className="text-sm font-semibold">{card.title}</span>
                      <span className="text-sm text-muted">{card.detail}</span>
                    </button>
                  );
                })}
            </div>
          )}

          {fulfilment === "pickup" && canPickup && (
            <div className="flex flex-col gap-2 rounded-DEFAULT bg-border/10 p-3 text-sm">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span>
                  <span className="block font-medium">{t("pickupAt")}</span>
                  {delivery.pickup.address}
                </span>
              </p>
              {delivery.pickup.hours && (
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  {delivery.pickup.hours}
                </p>
              )}
            </div>
          )}

          {fulfilment === "delivery" && canDeliver && (
            <>
              {deliversInPhnomPenh && deliversToProvinces && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{t("area")}</span>
                  <div className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-border/10 p-1">
                    <button type="button" aria-pressed={area === "phnom_penh"} onClick={() => setArea("phnom_penh")} className={segment(area === "phnom_penh")}>
                      {t("phnomPenh")}
                    </button>
                    <button type="button" aria-pressed={area === "province"} onClick={() => setArea("province")} className={segment(area === "province")}>
                      {t("otherProvince")}
                    </button>
                  </div>
                </div>
              )}

              {area === "phnom_penh" && deliversInPhnomPenh && (
                <div className="flex flex-col gap-1.5">
                  <Select
                    label={t("district")}
                    placeholder={t("chooseDistrict")}
                    value={districtOptions.some((option) => option.value === districtId) ? districtId : ""}
                    onChange={(e) => {
                      setDistrictId(e.target.value);
                      clearError("districtId");
                    }}
                    options={districtOptions}
                    error={errorText(errors.districtId)}
                  />
                  {districtOptions.length < PHNOM_PENH_DISTRICTS.length && (
                    <p className="text-sm text-muted">{t("districtNotListed")}</p>
                  )}
                </div>
              )}

              {area === "province" && deliversToProvinces && (
                <div className="flex flex-col gap-1.5">
                  <Select
                    label={t("province")}
                    placeholder={t("chooseProvince")}
                    value={provinceId}
                    onChange={(e) => {
                      setProvinceId(e.target.value);
                      clearError("provinceId");
                    }}
                    options={PROVINCES.map((place) => ({ value: place.id, label: placeName(place, locale) }))}
                    error={errorText(errors.provinceId)}
                  />
                  <p className="text-sm text-muted">
                    {t("provinceByBus", { fee: feeText(delivery.province) })}
                    {delivery.province.note ? ` ${delivery.province.note}` : ""}
                  </p>
                  <p className="text-sm text-muted">{t("provinceCodNote")}</p>
                </div>
              )}

              <Input
                label={t("landmark")}
                placeholder={t("landmarkPlaceholder")}
                maxLength={200}
                autoComplete="street-address"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
              />
            </>
          )}

          <label className="flex min-h-touch cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={rememberDetails}
              onChange={(e) => setRememberDetails(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-brand"
            />
            <span className="text-sm">{t("rememberDetails")}</span>
          </label>
        </BuyerSection>

        <BuyerSection number={3} title={t("sectionPay")}>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("payIn")}</span>
            <div className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-border/10 p-1">
              {(["USD", "KHR"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={currency === option}
                  onClick={() => setCurrency(option)}
                  className={segment(currency === option)}
                >
                  {option === "USD" ? "$" : "៛"} {option}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("paymentMethod")}</span>
            {availableMethods.length === 0 && (
              <p role="status" className="flex items-start gap-2 rounded-DEFAULT border border-warning/40 bg-warning/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                {t("noPaymentMethods")}
              </p>
            )}
            {mockPaymentMethods
              .filter((method) => availableMethods.includes(method.code))
              .map((method) => (
                <button
                  key={method.code}
                  type="button"
                  onClick={() => setPaymentMethod(method.code)}
                  aria-pressed={paymentMethod === method.code}
                  className={cn(
                    "flex min-h-touch items-center justify-between rounded-DEFAULT border-2 px-4 text-left transition-colors",
                    paymentMethod === method.code ? "border-brand bg-brand/5" : "border-border",
                  )}
                >
                  <span className="font-medium">
                    {method.code === "cod" && fulfilment === "pickup"
                      ? t("payAtPickup")
                      : locale === "km"
                        ? method.labelKm
                        : method.labelEn}
                  </span>
                  {paymentMethod === method.code && <Check className="h-4 w-4 text-brand" aria-hidden="true" />}
                </button>
              ))}
          </div>
        </BuyerSection>

        {/* Phone and tablet: the summary ends the form; from 1024 px it's in the side column. */}
        <div className="flex flex-col gap-3 lg:hidden">
          {summary}
          {trust}
        </div>
      </div>
      </BuyerColumns>

      <BuyerBottomBar wide>{placeOrderButton}</BuyerBottomBar>
    </BuyerShell>
  );
}
