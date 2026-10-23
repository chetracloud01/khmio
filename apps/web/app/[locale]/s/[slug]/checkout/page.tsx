"use client";

import {
  approximateIn,
  checkoutInputSchema,
  deliveryFeeIn,
  getDeliverableDistrictIds,
  getDeliveryQuote,
  PHNOM_PENH_DISTRICTS,
  placeName,
  PROVINCES,
  toFieldErrors,
  type Currency,
  type DeliveryFee,
  type DeliverySettings,
  type FormErrorCode,
  type Fulfilment,
  type PaymentMethod,
} from "@khmio/shared";
import { Button, Checkbox, ChoiceCards, Input, Notice, SegmentedControl, Select } from "@khmio/ui";
import { Clock, History, MapPin, Store, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BotCheck, TURNSTILE_SITE_KEY } from "@/components/bot-check";
import { BuyerBottomBar, BuyerColumns, BuyerSection, BuyerShell, BuyerSteps, BuyerTopBar } from "@/components/buyer-shell";
import { focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import { CurrencyChoice } from "@/components/buyer/currency-choice";
import { formatMoney } from "@/components/order-ui";
import { api, ApiError, placedOrderSchema, type PublicShop } from "@/lib/api";
import { cartLines, cartTotal, readBuyerDetails, saveBuyerDetails, useShopCart, type BuyerDetails } from "@/lib/cart";
import { newId } from "@/lib/new-id";
import { isTakingOrders, paymentMethodsFor } from "@/lib/shop-ordering";
import { usePublicShop } from "@/lib/use-public-shop";
import { BuyerLoading, BuyerProblem } from "../buyer-states";

type Field = "name" | "phone" | "districtId" | "provinceId" | "paymentMethod" | "fulfilment";
const FIELDS: readonly Field[] = ["name", "phone", "districtId", "provinceId", "paymentMethod", "fulfilment"];

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const { shop, state, reload } = usePublicShop(slug);
  const cart = useShopCart(slug);
  if (state === "loading" || !cart.ready) return <BuyerLoading />;
  if (state !== "ready" || !shop) return <BuyerProblem kind={state === "not_found" ? "not_found" : "offline"} onRetry={reload} />;
  return <CheckoutForm shop={shop} cart={cart} onShopChanged={reload} />;
}

// One page, not a wizard (design/design-standard.md §6): who, how to get it,
// where, how to pay — then one button with the amount. The API prices the
// order again; the total here is the same function, for showing.
function CheckoutForm({ shop, cart, onShopChanged }: { shop: PublicShop; cart: ReturnType<typeof useShopCart>; onShopChanged: () => void }) {
  const t = useTranslations("Checkout");
  const tStore = useTranslations("Storefront");
  const tCart = useTranslations("Cart");
  const tApp = useTranslations("App");
  const errorText = useFormErrorText();
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);
  const slug = shop.store.slug;

  const [{ details: initialDetails, remembered }] = useState(readBuyerDetails);
  const [details, setDetails] = useState<BuyerDetails>(initialDetails);
  // Ticked only if the buyer chose it last time: keeping their details needs their own consent.
  const [remember, setRemember] = useState(remembered);
  // "Filled in from your last order": shown until the buyer clears it (someone else ordering on this phone).
  const [prefilled, setPrefilled] = useState(remembered && initialDetails.name !== "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [errors, setErrors] = useState<Partial<Record<Field, FormErrorCode>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  // Set once the order exists, so the emptied cart doesn't flash "your cart is empty" before the order page opens.
  const [placed, setPlaced] = useState(false);
  // One key per checkout: a double tap or a retry on bad signal gives back the same order (packages/shared placeOrderRequestSchema).
  const [idempotencyKey] = useState(newId);
  // Cloudflare Turnstile: a fresh token for each attempt (each works once).
  const [botToken, setBotToken] = useState<string | null>(null);
  const [botReset, setBotReset] = useState(0);

  const currency: Currency = cart.currency ?? shop.store.defaultCurrency;
  const rate = shop.store.usdToKhrRate;
  const delivery: DeliverySettings = { ...shop.delivery, drivers: [] };
  const deliversInPhnomPenh = delivery.zones.length > 0;
  const deliversToProvinces = delivery.province.enabled;
  const canDeliver = deliversInPhnomPenh || deliversToProvinces;
  const canPickup = delivery.pickup.enabled;

  const set = useCallback(<K extends keyof BuyerDetails>(field: K, value: BuyerDetails[K]) => setDetails((previous) => ({ ...previous, [field]: value })), []);

  // Keep the saved choice valid if the shop changed what it offers since last time.
  useEffect(() => {
    if (details.fulfilment === "delivery" && !canDeliver && canPickup) set("fulfilment", "pickup");
    if (details.fulfilment === "pickup" && !canPickup && canDeliver) set("fulfilment", "delivery");
    if (details.area === "phnom_penh" && !deliversInPhnomPenh && deliversToProvinces) set("area", "province");
    if (details.area === "province" && !deliversToProvinces && deliversInPhnomPenh) set("area", "phnom_penh");
  }, [details.fulfilment, details.area, canDeliver, canPickup, deliversInPhnomPenh, deliversToProvinces, set]);

  const methods = paymentMethodsFor(shop, details.area, details.fulfilment);
  useEffect(() => {
    const first = methods[0];
    if (first && !methods.includes(paymentMethod)) setPaymentMethod(first);
  }, [methods, paymentMethod]);

  const feeText = (fee: DeliveryFee) => {
    const amount = deliveryFeeIn(fee, currency, rate);
    return amount === 0 ? t("free") : formatMoney(amount, currency);
  };
  const districtOptions = PHNOM_PENH_DISTRICTS.filter((place) => getDeliverableDistrictIds(delivery).includes(place.id)).map((place) => {
    const quote = getDeliveryQuote(delivery, { fulfilment: "delivery", area: "phnom_penh", districtId: place.id });
    return { value: place.id, label: `${placeName(place, locale)} — ${quote.status === "ok" ? feeText(quote.fee) : ""}` };
  });
  const cheapestZoneFee = delivery.zones.length ? Math.min(...delivery.zones.map((zone) => deliveryFeeIn(zone, currency, rate))) : null;

  const quote = getDeliveryQuote(delivery, {
    fulfilment: details.fulfilment,
    area: details.area,
    districtId: details.districtId || undefined,
    provinceId: details.provinceId || undefined,
  });
  const lines = cartLines(shop, cart.quantities);
  const total = lines.length ? cartTotal(shop, lines, currency, quote.status === "ok" ? quote.fee : null) : null;
  const canTakeOrder = isTakingOrders(shop) && methods.length > 0 && (canDeliver || canPickup) && quote.status !== "unavailable";

  /** The same schema the API checks the order with (packages/shared checkout.ts). */
  function checkoutForm() {
    return {
      name: details.name,
      phone: details.phone,
      currency,
      fulfilment: details.fulfilment,
      area: details.area,
      districtId: details.districtId || undefined,
      provinceId: details.provinceId || undefined,
      landmark: details.fulfilment === "pickup" ? "" : details.landmark,
      paymentMethod,
    };
  }
  function formErrors(): Partial<Record<Field, FormErrorCode>> {
    const result = checkoutInputSchema.safeParse({ ...checkoutForm(), storeAllowsCod: shop.store.allowCod });
    if (result.success) return {};
    const found = toFieldErrors(result.error);
    return Object.fromEntries(FIELDS.flatMap((field) => (found[field] ? [[field, found[field]]] : [])));
  }
  const checkField = (field: Field) => setErrors((previous) => ({ ...previous, [field]: formErrors()[field] }));
  const clearError = (field: Field) => setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));

  async function handleSubmit() {
    if (!canTakeOrder || placing) return;
    setProblem(null);
    const found = formErrors();
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      focusFirstInvalidField(formRef.current);
      return;
    }
    if (TURNSTILE_SITE_KEY && !botToken) {
      setProblem(t("botCheckWait"));
      return;
    }
    setPlacing(true);
    try {
      const order = await api(`/public/stores/${encodeURIComponent(slug)}/orders`, placedOrderSchema, {
        method: "POST",
        body: {
          idempotencyKey,
          lines: lines.map((line) => ({ variantId: line.variant.id, quantity: line.quantity })),
          checkout: checkoutForm(),
          ...(botToken ? { botCheck: botToken } : {}),
        },
      });
      saveBuyerDetails(details, remember);
      setPlaced(true);
      cart.clear();
      router.replace(`/${locale}/o/${order.token}`);
    } catch (failure) {
      setPlacing(false);
      setBotReset((count) => count + 1);
      if (failure instanceof ApiError && failure.code === "bot_check_failed") {
        setProblem(t("botCheckFailed"));
        return;
      }
      if (failure instanceof ApiError && failure.code === "too_many_requests") {
        setProblem(tApp("tooManyTries"));
        return;
      }
      if (failure instanceof ApiError && Object.keys(failure.fields).length > 0) {
        const fields = failure.fields;
        if (Object.keys(fields).some((key) => key.startsWith("lines"))) {
          // Something in the cart stopped being sold while the buyer was here: show the cart as it is now.
          setProblem(tCart("stockAdjusted"));
          onShopChanged();
          return;
        }
        setErrors(Object.fromEntries(FIELDS.flatMap((field) => (fields[field] ? [[field, fields[field]]] : []))));
        focusFirstInvalidField(formRef.current);
        return;
      }
      // The shop was paused meanwhile: say so; reloading the shop then shows "temporarily closed".
      if (failure instanceof ApiError && failure.code === "store_closed") {
        setProblem(tStore("temporarilyClosed"));
        onShopChanged();
        return;
      }
      if (failure instanceof ApiError && failure.code === "not_accepting_orders") {
        setProblem(t("noPaymentMethods"));
        onShopChanged();
        return;
      }
      setProblem(tApp("orderFailed"));
    }
  }

  if (placed) return null;

  if (!total) {
    return (
      <BuyerShell className="items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm text-muted">{tCart("empty")}</p>
        <Link href={`/${locale}/s/${slug}`} className="block">
          <Button variant="primary">{tCart("browseMenu")}</Button>
        </Link>
      </BuyerShell>
    );
  }

  const fulfilmentCards: { value: Fulfilment; icon: typeof Truck; title: string; detail: string; show: boolean }[] = [
    {
      value: "delivery",
      icon: Truck,
      title: t("delivery"),
      detail: cheapestZoneFee === null ? feeText(delivery.province) : cheapestZoneFee === 0 ? t("free") : t("feeFrom", { fee: formatMoney(cheapestZoneFee, currency) }),
      show: canDeliver,
    },
    { value: "pickup", icon: Store, title: t("pickup"), detail: t("free"), show: canPickup },
  ];
  const methodLabel = (method: PaymentMethod) => (method === "cod" ? (details.fulfilment === "pickup" ? t("payAtPickup") : tApp("payCashOnDelivery")) : method === "khqr" ? "KHQR" : "ABA PayWay");

  const summary = (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4">
          <h2 className="font-semibold">{t("sectionSummary")}</h2>
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between text-muted">
              <dt>{tStore("subtotal")}</dt>
              <dd className="tabular-nums">{formatMoney(total.subtotal, currency)}</dd>
            </div>
            {total.discount > 0 && (
              <div className="flex items-center justify-between text-success">
                <dt>{tStore("itemDiscount")}</dt>
                <dd className="tabular-nums">-{formatMoney(total.discount, currency)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between text-muted">
              <dt>{details.fulfilment === "pickup" ? t("pickup") : t("deliveryFee")}</dt>
              <dd className="tabular-nums">
                {quote.status === "ok" ? (total.deliveryFee === 0 ? t("free") : formatMoney(total.deliveryFee, currency)) : quote.status === "incomplete" ? t("feeAfterChoice") : "—"}
              </dd>
            </div>
            {shop.store.vatPercent > 0 && (
              <div className="flex items-center justify-between text-muted">
                <dt>{tStore("vat", { percent: shop.store.vatPercent })}</dt>
                <dd className="tabular-nums">{formatMoney(total.vat, currency)}</dd>
              </div>
            )}
          </dl>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-semibold">{tStore("totalToPay")}</span>
            <span className="text-right">
              <span className="block text-lg font-bold tabular-nums">{formatMoney(total.total, currency)}</span>
              <span className="block text-xs text-muted">≈ {formatMoney(approximateIn(total.total, currency, rate), currency === "USD" ? "KHR" : "USD")}</span>
            </span>
          </div>
        </section>
  );
  const placeOrderButton = (
    <Button variant="primary" className="w-full" onClick={() => void handleSubmit()} disabled={!canTakeOrder} loading={placing}>
      {t("placeOrder")} · {formatMoney(total.total, currency)}
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
      <BuyerTopBar backHref={`/${locale}/s/${slug}/cart`} backLabel={t("backToCart")} title={t("title")} subtitle={shop.store.name}>
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
        {problem && (
          <Notice tone="warning" role="alert">
            {problem}
          </Notice>
        )}

        <BuyerSection number={1} title={t("sectionYou")}>
          {prefilled && (
            <div className="flex items-center gap-3 rounded-2xl bg-brand/5 p-3 text-sm">
              <History className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="min-w-0 flex-1">{t("prefilledNote")}</span>
              <Button
                variant="ghost"
                onClick={() => {
                  setDetails({ ...details, name: "", phone: "", landmark: "", districtId: "", provinceId: "" });
                  setRemember(false);
                  setPrefilled(false);
                }}
                className="-my-2 shrink-0 px-2 font-semibold"
              >
                {t("prefilledClear")}
              </Button>
            </div>
          )}
          <Input
            label={t("name")}
            placeholder={t("namePlaceholder")}
            autoComplete="name"
            value={details.name}
            onChange={(e) => {
              set("name", e.target.value);
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
            value={details.phone}
            onChange={(e) => {
              set("phone", e.target.value);
              clearError("phone");
            }}
            onBlur={() => checkField("phone")}
            error={errorText(errors.phone)}
          />
        </BuyerSection>

        <BuyerSection number={2} title={t("sectionHow")}>
          <ChoiceCards
            label={t("sectionHow")}
            value={details.fulfilment}
            invalid={Boolean(errors.fulfilment)}
            onChange={(value) => {
              const card = fulfilmentCards.find((entry) => entry.value === value);
              if (!card) return;
              set("fulfilment", card.value);
              clearError("fulfilment");
            }}
            options={fulfilmentCards.filter((card) => card.show).map(({ value, icon, title, detail }) => ({ value, icon, title, detail }))}
          />
          {errors.fulfilment && <p className="text-sm text-danger">{errorText(errors.fulfilment)}</p>}

          {details.fulfilment === "pickup" && canPickup && (
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

          {details.fulfilment === "delivery" && canDeliver && (
            <>
              {deliversInPhnomPenh && deliversToProvinces && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{t("area")}</span>
                  <SegmentedControl
                    mode="choice"
                    label={t("area")}
                    value={details.area}
                    onChange={(value) => set("area", value === "province" ? "province" : "phnom_penh")}
                    options={[
                      { value: "phnom_penh", label: t("phnomPenh") },
                      { value: "province", label: t("otherProvince") },
                    ]}
                    className="w-fit"
                  />
                </div>
              )}

              {details.area === "phnom_penh" && deliversInPhnomPenh && (
                <div className="flex flex-col gap-1.5">
                  <Select
                    label={t("district")}
                    placeholder={t("chooseDistrict")}
                    value={districtOptions.some((option) => option.value === details.districtId) ? details.districtId : ""}
                    onChange={(e) => {
                      set("districtId", e.target.value);
                      clearError("districtId");
                    }}
                    options={districtOptions}
                    error={errorText(errors.districtId)}
                  />
                  {districtOptions.length < PHNOM_PENH_DISTRICTS.length && <p className="text-sm text-muted">{t("districtNotListed")}</p>}
                </div>
              )}

              {details.area === "province" && deliversToProvinces && (
                <div className="flex flex-col gap-1.5">
                  <Select
                    label={t("province")}
                    placeholder={t("chooseProvince")}
                    value={details.provinceId}
                    onChange={(e) => {
                      set("provinceId", e.target.value);
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
                value={details.landmark}
                onChange={(e) => set("landmark", e.target.value)}
              />
            </>
          )}

          <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} label={t("rememberDetails")} />
        </BuyerSection>

        <BuyerSection number={3} title={t("sectionPay")}>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("payIn")}</span>
            <CurrencyChoice label={t("payIn")} value={currency} onChange={cart.setCurrency} />
          </div>

          {/* With no method to pick, the group itself carries the error mark; otherwise ChoiceCards does. */}
          <div className="flex flex-col gap-2" data-invalid={errors.paymentMethod && methods.length === 0 ? "true" : undefined}>
            <span className="text-sm font-medium">{t("paymentMethod")}</span>
            {methods.length === 0 && (
              <Notice tone="warning" role="status">
                {details.area === "province" && details.fulfilment === "delivery" ? t("provinceCodNote") : t("noPaymentMethods")}
              </Notice>
            )}
            {methods.length > 0 && (
              <ChoiceCards
                variant="rows"
                label={t("paymentMethod")}
                value={paymentMethod}
                invalid={Boolean(errors.paymentMethod)}
                onChange={(value) => {
                  const method = methods.find((entry) => entry === value);
                  if (!method) return;
                  setPaymentMethod(method);
                  clearError("paymentMethod");
                }}
                options={methods.map((method) => ({ value: method, title: methodLabel(method) }))}
              />
            )}
            {errors.paymentMethod && <p className="text-sm text-danger">{errorText(errors.paymentMethod)}</p>}
          </div>
        </BuyerSection>

        {/* Phone and tablet: the summary ends the form; from 1024 px it's in the side column. */}
        <div className="flex flex-col gap-3 lg:hidden">
          {summary}
          {trust}
        </div>
        {/* Once only, whatever the width: the bot check gives one token per attempt. */}
        <BotCheck onToken={setBotToken} resetKey={botReset} />
      </div>
      </BuyerColumns>

      <BuyerBottomBar wide>{placeOrderButton}</BuyerBottomBar>
    </BuyerShell>
  );
}
