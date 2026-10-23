"use client";

import { deliveryFeeIn, formatKhmerPhoneLocal, PHNOM_PENH_DISTRICTS, placeName, type Currency, type DeliveryFee } from "@khmio/shared";
import { BottomSheet } from "@khmio/ui";
import { Bus, ChevronRight, Phone, Store, Truck, Wallet, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { formatMoney } from "@/components/order-ui";
import type { PublicShop } from "@/lib/api";

function InfoSection({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-3 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {children}
      </div>
    </section>
  );
}

/**
 * How this shop gets an order to the buyer, in one line under the shop name —
 * and in full (every district and fee, pickup, provinces, how to pay) one tap
 * away. Buyers ask "do you deliver to me, and how much?" before anything else.
 */
export function ShopInfo({ shop, currency }: { shop: PublicShop; currency: Currency }) {
  const t = useTranslations("Storefront");
  const tCheckout = useTranslations("Checkout");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const { delivery, store } = shop;
  const rate = store.usdToKhrRate;

  const feeText = (fee: DeliveryFee) => {
    const amount = deliveryFeeIn(fee, currency, rate);
    return amount === 0 ? tCheckout("free") : formatMoney(amount, currency);
  };
  const zoneFees = delivery.zones.map((zone) => deliveryFeeIn(zone, currency, rate));
  const lowestFee = zoneFees.length > 0 ? Math.min(...zoneFees) : null;
  const oneFee = zoneFees.every((fee) => fee === lowestFee);
  const summary = shop.ordering.deliveryConfigured
    ? [
        lowestFee === null
          ? null
          : lowestFee === 0 && oneFee
            ? t("infoFreeDelivery")
            : t(oneFee ? "infoDelivery" : "infoDeliveryFrom", { fee: formatMoney(lowestFee, currency) }),
        delivery.pickup.enabled ? t("infoPickup") : null,
        delivery.province.enabled ? t("infoProvinces") : null,
      ].filter((part): part is string => part !== null)
    : [];
  const phoneLocal = store.phone ? formatKhmerPhoneLocal(store.phone) : "";

  return (
    <>
      <div className="flex items-center gap-2">
        {summary.length > 0 && (
          // eslint-disable-next-line no-restricted-syntax -- the shop's one-line summary row (delivery, pickup, provinces) that opens the shop-info sheet
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-touch min-w-0 flex-1 items-center gap-2 rounded-DEFAULT border border-border px-3 text-left text-sm hover:bg-border/10"
          >
            <Truck className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="sr-only">{t("shopInfo")}: </span>
            <span className="min-w-0 flex-1 truncate">{summary.join(" · ")}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          </button>
        )}
        {store.phone && (
          <a
            href={`tel:+${store.phone}`}
            aria-label={t("callShop", { phone: phoneLocal })}
            className={
              summary.length > 0
                ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-DEFAULT border border-border hover:bg-border/10"
                : "flex min-h-touch items-center gap-2 text-sm font-medium text-brand"
            }
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {summary.length === 0 && t("callShop", { phone: phoneLocal })}
          </a>
        )}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} closeLabel={t("close")} title={t("shopInfo")} placement="center">
        <div className="flex flex-col">
          {delivery.zones.length > 0 && (
            <InfoSection icon={Truck} title={t("infoPhnomPenhTitle")}>
              <ul className="flex flex-col gap-2">
                {delivery.zones.map((zone) => (
                  <li key={zone.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 text-muted">
                      {PHNOM_PENH_DISTRICTS.filter((district) => zone.districtIds.includes(district.id))
                        .map((district) => placeName(district, locale))
                        .join(", ")}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{feeText(zone)}</span>
                  </li>
                ))}
              </ul>
            </InfoSection>
          )}
          {delivery.province.enabled && (
            <InfoSection icon={Bus} title={t("infoProvinceTitle")}>
              <p className="flex items-start justify-between gap-3 text-sm">
                <span className="text-muted">{t("infoProvinceRow")}</span>
                <span className="shrink-0 font-medium tabular-nums">{feeText(delivery.province)}</span>
              </p>
              {delivery.province.note && <p className="text-sm text-muted">{delivery.province.note}</p>}
            </InfoSection>
          )}
          {delivery.pickup.enabled && (
            <InfoSection icon={Store} title={t("infoPickupTitle")}>
              <p className="text-sm text-muted">{delivery.pickup.address}</p>
              {delivery.pickup.hours && <p className="text-sm text-muted">{delivery.pickup.hours}</p>}
            </InfoSection>
          )}
          <InfoSection icon={Wallet} title={t("infoPaymentTitle")}>
            <ul className="flex flex-col gap-1 text-sm text-muted">
              {shop.ordering.khqrReady && <li>{t("infoPayKhqr")}</li>}
              {store.allowCod && <li>{t("infoPayCod")}</li>}
            </ul>
          </InfoSection>
          {store.phone && (
            <a href={`tel:+${store.phone}`} className="mt-4 flex min-h-touch items-center justify-center gap-2 rounded-DEFAULT border border-border text-sm font-medium">
              <Phone className="h-4 w-4" aria-hidden="true" />
              {t("callShop", { phone: phoneLocal })}
            </a>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
