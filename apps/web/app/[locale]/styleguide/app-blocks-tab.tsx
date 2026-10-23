"use client";

import { DEFAULT_ADMIN_SETTINGS, fulfilmentSchema, orderStatusSchema, phnomPenhDay, type InvoiceDetails, type ShopLocation } from "@khmio/shared";
import { Card, Input } from "@khmio/ui";
import { Languages, Store, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { FormActions, FormSection, ReadOnlyField, SectionJumpLinks } from "@/components/form-ui";
import { ShopHero } from "@/components/buyer/shop-hero";
import { ShopInfoButton, ShopInfoSheet } from "@/components/buyer/shop-info-sheet";
import { LANGUAGE_NAMES, LanguageSwitch } from "@/components/language-switch";
import { MenuList } from "@/components/menu-list";
import { formatMoney, OrderStatusPill } from "@/components/order-ui";
import { PhotoThumb } from "@/components/photo-thumb";
import { InvoiceFields } from "@/components/shop-details/invoice-fields";
import { LocationFields } from "@/components/shop-details/location-fields";
import { PricingFields, toPricingDraft, type PricingDraft } from "@/components/shop-details/pricing-fields";
import { useDateText } from "@/components/use-date-text";
import { mockDeliverySettings, mockInvoiceDetails, mockStore, mockStoreSettings } from "@/mock/mock-data";
import { buildSampleOrders, type OrderRecord } from "@/mock/mock-orders";
import { Demo, Section } from "./styleguide-ui";

const WAITING = new Set<OrderRecord["status"]>(["awaiting_payment", "cod_pending"]);
const SAMPLE_HOURS_AGO = 3;
/** The platform's default rate band, for the Prices & tax sample. */
const SAMPLE_RATE_BAND = { min: DEFAULT_ADMIN_SETTINGS.usdToKhrMin, max: DEFAULT_ADMIN_SETTINGS.usdToKhrMax };

/**
 * Parts shared inside the web app (apps/web/components): they use Next.js,
 * translations or Khmio's own data, so they aren't in the kit
 * (design/design-standard.md "Kit or app block").
 */
export function AppBlocksTab() {
  const t = useTranslations("Styleguide");
  const tShop = useTranslations("Storefront");
  const savedShopName = t("detailShopValue");
  const [shopName, setShopName] = useState(savedShopName);
  const tProfile = useTranslations("DashboardProfile");
  // Shop details' groups with the sample shop's values, editable here.
  const [location, setLocation] = useState<ShopLocation>({
    address: mockDeliverySettings.pickup.address,
    mapUrl: "",
    pickupEnabled: mockDeliverySettings.pickup.enabled,
    pickupHours: mockDeliverySettings.pickup.hours,
  });
  const [invoice, setInvoice] = useState<InvoiceDetails>(mockInvoiceDetails);
  const [pricing, setPricing] = useState<PricingDraft>(() => toPricingDraft(mockStoreSettings));
  const [shopInfoOpen, setShopInfoOpen] = useState(false);
  const dirty = shopName !== savedShopName;
  const orders = useMemo(() => buildSampleOrders(new Date()), []);
  const dates = useDateText();
  /** Three hours ago: one moment that shows every way a date is written. */
  const [sampleMoment] = useState(() => new Date(Date.now() - SAMPLE_HOURS_AGO * 60 * 60 * 1000).toISOString());

  const columns: DataGridColumn<OrderRecord>[] = [
    { key: "order", header: t("gridColOrder"), hideable: false, sortable: true, value: (order) => order.orderNumber, cell: (order) => <span className="font-medium tabular-nums"><DataGridHighlight text={order.orderNumber} /></span> },
    { key: "buyer", header: t("gridColBuyer"), sortable: true, value: (order) => order.name, cell: (order) => <DataGridHighlight text={order.name} /> },
    { key: "status", header: t("gridColStatus"), cell: (order) => <OrderStatusPill order={order} /> },
    { key: "total", header: t("gridColTotal"), align: "right", sortable: true, value: (order) => order.total, cell: (order) => <span className="tabular-nums">{formatMoney(order.total, order.currency)}</span> },
  ];

  return (
    <>
      <p className="max-w-2xl text-sm text-muted">{t("appBlocksIntro")}</p>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title={t("menuSection")}>
          {/* Rows as data: My shop and any settings list. */}
          <Demo name="MenuList">
            <MenuList
              title={t("menuTitle")}
              rows={[
                { key: "store", href: "#", icon: Store, tone: "brand", title: t("menuShop"), detail: t("menuShopDetail") },
                { key: "delivery", href: "#", icon: Truck, tone: "info", title: t("menuDelivery"), detail: t("menuDeliveryDetail") },
                { key: "language", href: "#", icon: Languages, tone: "success", title: t("menuLanguage"), value: LANGUAGE_NAMES.en.long },
              ]}
            />
          </Demo>
        </Section>

        <Section title={t("orderSection")}>
          {/* One wording, colour and icon per status (design/design-standard.md §7). */}
          <Demo name="OrderStatusPill" className="flex-row flex-wrap gap-2">
            {orderStatusSchema.options.map((status) => (
              <OrderStatusPill key={status} order={{ status, fulfilment: fulfilmentSchema.enum.delivery }} />
            ))}
          </Demo>
          <Demo name="PhotoThumb" className="flex-row">
            <PhotoThumb photo={{ key: "sample", url: "/icons/icon-512.png", thumbUrl: "/icons/icon-192.png" }} className="h-16 w-16 rounded-full object-cover" />
          </Demo>
        </Section>
      </div>

      <Section title={t("shopDetailsSection")} description={t("shopDetailsHint")}>
        {/* Shop details (design/screens.md S10): its groups, shared by the live page and the mockup. */}
        <Demo name="SectionJumpLinks">
          <SectionJumpLinks
            label={tProfile("jumpTo")}
            links={(["details", "location", "payments", "invoices"] as const).map((id) => ({ id: `sample-${id}`, label: tProfile(`jump_${id}`) }))}
          />
        </Demo>
        <div className="grid gap-8 md:grid-cols-2">
          <Demo name="LocationFields">
            <Card className="p-4">
              <LocationFields values={location} errors={{}} onChange={(patch) => setLocation((current) => ({ ...current, ...patch }))} onCheck={() => undefined} />
            </Card>
          </Demo>
          <Demo name="PricingFields">
            <Card className="p-4">
              <PricingFields values={pricing} band={SAMPLE_RATE_BAND} errors={{}} onChange={(patch) => setPricing((current) => ({ ...current, ...patch }))} onCheck={() => undefined} />
            </Card>
          </Demo>
          <Demo name={["InvoiceFields", "InvoiceHeaderPreview"]}>
            <Card className="p-4">
              <InvoiceFields
                values={invoice}
                errors={{}}
                onChange={(field, value) => setInvoice((current) => ({ ...current, [field]: value }))}
                shop={{ name: t("detailShopValue"), logoUrl: null, phone: mockStore.phone, address: location.address }}
              />
            </Card>
          </Demo>
        </div>
      </Section>

      <Section title={t("shopHeroSection")} description={t("shopHeroHint")}>
        {/* The buyer's shop header and its Shop info sheet (design/screens.md B1), with the sample shop. */}
        <Demo name={["ShopHero", "ShopInfoButton", "ShopInfoSheet"]}>
          <div className="max-w-md overflow-hidden rounded-2xl border border-border">
            <ShopHero
              name={t("detailShopValue")}
              logo={t("detailShopValue").charAt(0)}
              openLabel={tShop("openNow")}
              info={<ShopInfoButton onClick={() => setShopInfoOpen(true)} />}
            />
          </div>
          <ShopInfoSheet
            open={shopInfoOpen}
            onClose={() => setShopInfoOpen(false)}
            shop={{
              name: t("detailShopValue"),
              logo: t("detailShopValue").charAt(0),
              openLabel: tShop("openNow"),
              phone: mockStore.phone,
              address: mockDeliverySettings.pickup.address,
              mapUrl: "",
              telegram: mockInvoiceDetails.telegramLink,
              facebook: mockInvoiceDetails.facebookLink,
              delivery: mockDeliverySettings,
              currency: mockStoreSettings.defaultCurrency,
              rate: mockStoreSettings.usdToKhrRate,
              khqrReady: true,
              allowCod: mockStoreSettings.allowCod,
            }}
          />
        </Demo>
      </Section>

      <Section title={t("languageSection")} description={t("languageHint")}>
        <div className="grid gap-6 md:grid-cols-2">
          <Demo name="LanguageSwitch">
            <LanguageSwitch className="self-start" />
            <LanguageSwitch size="long" className="w-full [&>*]:flex-1" />
          </Demo>
          {/* The same moment, every way a screen shows it. */}
          <Demo name="useDateText">
            <ul className="flex flex-col gap-1 text-sm">
              {[dates.timeAgo(sampleMoment), dates.clockTime(sampleMoment), dates.date(sampleMoment), dates.dateTime(sampleMoment), dates.day(phnomPenhDay(sampleMoment))].map((text) => (
                <li key={text} className="tabular-nums">
                  {text}
                </li>
              ))}
            </ul>
          </Demo>
        </div>
      </Section>

      <Section title={t("formSection")} description={t("formHint")}>
        <Demo name={["FormSection", "ReadOnlyField", "FormActions"]}>
          <Card className="flex flex-col p-4 md:p-6">
            <FormSection title={t("formShopTitle")} description={t("formShopHint")}>
              <Input label={t("detailShop")} value={shopName} onChange={(event) => setShopName(event.target.value)} />
              <ReadOnlyField label={t("formLinkLabel")} value="khmio.com/s/sokha-coffee" hint={t("formLinkHint")} />
            </FormSection>
            <FormActions
              dirty={dirty}
              onCancel={() => setShopName(savedShopName)}
              onSave={() => setShopName(savedShopName)}
              saveLabel={t("formSave")}
              cancelLabel={t("buttonSecondary")}
              status={dirty ? t("formUnsaved") : t("formSaved")}
              className="static mx-0 px-0 md:mx-0 md:px-0"
            />
          </Card>
        </Demo>
      </Section>

      <Section title={t("gridSection")} description={t("gridHint")}>
        <Demo name={["DataGrid", "DataGridHighlight"]}>
          <DataGrid
            rows={orders}
            getRowId={(order) => order.orderNumber}
            columns={columns}
            searchText={(order) => `${order.orderNumber} ${order.name}`}
            searchPlaceholder={t("gridSearch")}
            chips={[{ value: "waiting", label: t("tone_warning"), predicate: (order: OrderRecord) => WAITING.has(order.status) }]}
            initialSort={{ key: "order", direction: "desc" }}
            renderCard={(order) => (
              <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium tabular-nums">{order.orderNumber}</span>
                  <span className="tabular-nums">{formatMoney(order.total, order.currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-muted">
                  <span className="min-w-0 truncate">{order.name}</span>
                  <OrderStatusPill order={order} />
                </div>
              </div>
            )}
            exportFileName="styleguide-orders"
            rowNumbers
          />
        </Demo>
      </Section>
    </>
  );
}
