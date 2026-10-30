"use client";

import { deliveryFeeIn, formatKhmerPhoneLocal, PHNOM_PENH_DISTRICTS, placeName, shopMapLink, type Currency, type DeliveryFee, type DeliverySettings } from "@khmio/shared";
import { ActionTiles, BottomSheet, GroupTitle, IconBadge, StatusPill } from "@khmio/ui";
import { Banknote, Bus, ChevronRight, Clock, Info, MapPin, Phone, QrCode, Store, Truck, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { MenuList } from "@/components/menu-list";
import { formatMoney } from "@/components/order-ui";
import { useShopContacts } from "./use-shop-contacts";

/** Everything the sheet shows, from the shop page or the styleguide's sample. */
export interface ShopInfoData {
  name: string;
  /** The logo picture, or the shop's first letter. */
  logo: ReactNode;
  openLabel: string;
  /** 855… or "". */
  phone: string;
  address: string;
  mapUrl: string;
  telegram: string;
  facebook: string;
  delivery: Pick<DeliverySettings, "zones" | "pickup" | "province">;
  currency: Currency;
  rate: number;
  khqrReady: boolean;
  allowCod: boolean;
}

interface InfoRow {
  key: string;
  icon: LucideIcon;
  /** Small, above: "Phone". */
  label?: string;
  title: string;
  detail?: string;
  /** At the right: a fee. */
  value?: string;
  /** Opens outside: tel:, the map, … */
  href?: string;
  external?: boolean;
}

function InfoGroup({ title, rows }: { title: string; rows: InfoRow[] }) {
  if (rows.length === 0) return null;
  const row = "flex min-h-[56px] items-center gap-3 px-3 py-2.5 text-left";
  return (
    <section className="flex flex-col gap-2">
      <GroupTitle as="h3">{title}</GroupTitle>
      <ul className="overflow-hidden rounded-2xl border border-border bg-bg">
        {rows.map((item) => {
          const content = (
            <>
              <IconBadge icon={item.icon} size="sm" />
              <span className="min-w-0 flex-1">
                {item.label && <span className="block text-xs text-muted">{item.label}</span>}
                <span className="block text-sm font-medium">{item.title}</span>
                {item.detail && <span className="block text-xs text-muted">{item.detail}</span>}
              </span>
              {item.value && <span className="shrink-0 text-sm font-semibold tabular-nums">{item.value}</span>}
              {item.href && <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
            </>
          );
          return (
            <li key={item.key} className="border-b border-border last:border-b-0">
              {item.href ? (
                <a href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined} className={`${row} hover:bg-border/10`}>
                  {content}
                </a>
              ) : (
                <div className={row}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The shop header's one way in: "Shop info & contact — Call, map, delivery fees, how to pay". */
export function ShopInfoButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("Storefront");
  return <MenuList rows={[{ key: "info", icon: Info, title: t("shopInfoButton"), detail: t("shopInfoButtonDetail"), onClick }]} />;
}

/**
 * The buyer's Shop info (design/screens.md B1): the shop, its round buttons —
 * Call, Map, Telegram, Facebook, each opening the phone's own app — then
 * Contact, Delivery and How to pay, each a list of rows. Anything the seller
 * left empty is left out.
 */
export function ShopInfoSheet({ open, onClose, shop }: { open: boolean; onClose: () => void; shop: ShopInfoData }) {
  const t = useTranslations("Storefront");
  const tCheckout = useTranslations("Checkout");
  const locale = useLocale();
  const actions = useShopContacts(shop);
  const { delivery, currency, rate } = shop;
  const mapLink = shopMapLink(shop.mapUrl, shop.address);

  const feeText = (fee: DeliveryFee) => {
    const amount = deliveryFeeIn(fee, currency, rate);
    return amount === 0 ? tCheckout("free") : formatMoney(amount, currency);
  };

  const contact: InfoRow[] = [
    ...(shop.phone ? [{ key: "phone", icon: Phone, label: t("contactPhone"), title: formatKhmerPhoneLocal(shop.phone), href: `tel:+${shop.phone}` }] : []),
    ...(shop.address.trim() ? [{ key: "address", icon: MapPin, label: t("contactAddress"), title: shop.address.trim(), href: mapLink ?? undefined, external: true }] : []),
    ...(delivery.pickup.hours.trim() ? [{ key: "hours", icon: Clock, label: t("contactHours"), title: delivery.pickup.hours.trim() }] : []),
  ];
  const deliveryRows: InfoRow[] = [
    ...delivery.zones.map((zone) => ({
      key: zone.id,
      icon: Truck,
      label: t("infoPhnomPenhTitle"),
      title: PHNOM_PENH_DISTRICTS.filter((district) => zone.districtIds.includes(district.id))
        .map((district) => placeName(district, locale))
        .join(", "),
      value: feeText(zone),
    })),
    ...(delivery.province.enabled
      ? [{ key: "province", icon: Bus, label: t("infoProvinceTitle"), title: t("infoProvinceRow"), detail: delivery.province.note || undefined, value: feeText(delivery.province) }]
      : []),
    ...(delivery.pickup.enabled ? [{ key: "pickup", icon: Store, title: t("infoPickupTitle"), value: tCheckout("free") }] : []),
  ];
  const payRows: InfoRow[] = [
    ...(shop.khqrReady ? [{ key: "khqr", icon: QrCode, title: t("infoPayKhqr") }] : []),
    ...(shop.allowCod ? [{ key: "cod", icon: Banknote, title: t("infoPayCod") }] : []),
  ];

  return (
    <BottomSheet open={open} onClose={onClose} closeLabel={t("close")} title={t("shopInfo")} placement="center">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand text-lg font-bold text-on-brand">{shop.logo}</span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="font-semibold">{shop.name}</p>
            <StatusPill tone="success">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              {shop.openLabel}
            </StatusPill>
          </div>
        </div>

        {actions.length > 0 && <ActionTiles items={actions} columns={actions.length >= 4 ? 4 : actions.length === 3 ? 3 : 2} variant="boxed" />}

        <InfoGroup title={t("infoContactSection")} rows={contact} />
        <InfoGroup title={t("infoDeliverySection")} rows={deliveryRows} />
        <InfoGroup title={t("infoPaymentTitle")} rows={payRows} />
      </div>
    </BottomSheet>
  );
}
