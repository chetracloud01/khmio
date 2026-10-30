"use client";

import { DEFAULT_ADMIN_SETTINGS, fulfilmentSchema, orderStatusSchema, phnomPenhDay, type Currency, type InvoiceDetails, type ReportQuery, type ShopLocation } from "@khmio/shared";
import { Card, Input } from "@khmio/ui";
import { AlarmClock, Bell, Boxes, CircleCheck, Coins, Languages, Percent, ReceiptText, ShoppingBag, Store, Truck, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DataGrid, DataGridHighlight, type DataGridColumn } from "@/components/data-grid";
import { DetailStats } from "@/components/detail-stats";
import { SupplierPicker } from "@/components/purchases/supplier-picker";
import { FormActions, FormSection, ReadOnlyField, SectionJumpLinks } from "@/components/form-ui";
import { ShopHero } from "@/components/buyer/shop-hero";
import { KhqrPayPanel } from "@/components/buyer/khqr-pay-panel";
import { StockNote } from "@/components/buyer/stock-note";
import { CashPayment } from "@/components/counter/cash-payment";
import { CounterCart } from "@/components/counter/counter-cart";
import { PaymentQrField } from "@/components/counter/payment-qr-field";
import { QrPayment } from "@/components/counter/qr-payment";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { ShopInfoButton, ShopInfoSheet } from "@/components/buyer/shop-info-sheet";
import { LANGUAGE_NAMES, LanguageSwitch } from "@/components/language-switch";
import { MenuList } from "@/components/menu-list";
import { formatMoney, OrderStatusPill } from "@/components/order-ui";
import { Paper, PaperDivider, PaperHeader, PaperRow, PaperSignatures, PaperStamp } from "@/components/paper/paper-parts";
import { PrintLink } from "@/components/paper/print-link";
import { PhotoThumb } from "@/components/photo-thumb";
import { InvoiceFields } from "@/components/shop-details/invoice-fields";
import { LocationFields } from "@/components/shop-details/location-fields";
import { PricingFields, toPricingDraft, type PricingDraft } from "@/components/shop-details/pricing-fields";
import { ActionStatTile } from "@/components/action-stat-tile";
import { BestSellersCard } from "@/components/dashboard/best-sellers-card";
import { KpiLink } from "@/components/dashboard/kpi-link";
import { LatestOrdersCard } from "@/components/dashboard/latest-orders-card";
import { NeedsYouStrip } from "@/components/dashboard/needs-you-strip";
import { ProfitSnapshotCard } from "@/components/dashboard/profit-snapshot-card";
import { SalesMixCard } from "@/components/dashboard/sales-mix-card";
import { SalesTrendCard } from "@/components/dashboard/sales-trend-card";
import { ChangeText } from "@/components/home/chart-parts";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportLinks } from "@/components/reports/report-links";
import { StatusTileRow } from "@/components/status-tile-row";
import { useDateText } from "@/components/use-date-text";
import { SAMPLE_DELIVERY, SAMPLE_INVOICE_DETAILS, SAMPLE_ORDERS, SAMPLE_DASHBOARD, SAMPLE_SELLER_ORDERS, SAMPLE_SHOP, SAMPLE_STORE_SETTINGS, SAMPLE_SUPPLIERS, type SampleOrder } from "./samples";
import { Demo, Section } from "./styleguide-ui";

const WAITING = new Set<SampleOrder["status"]>(["awaiting_payment", "cod_pending"]);
const SAMPLE_HOURS_AGO = 3;
const SAMPLE_LATTE_CENTS = 200;
const SAMPLE_COOKIE_CENTS = 100;
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
  const tKhqr = useTranslations("Khqr");
  const savedShopName = t("detailShopValue");
  const [supplierId, setSupplierId] = useState("");
  const [shopName, setShopName] = useState(savedShopName);
  const tProfile = useTranslations("DashboardProfile");
  const tPaper = useTranslations("BillPaper");
  const tPurchases = useTranslations("Purchases");
  const tPayables = useTranslations("Payables");
  const tDashboard = useTranslations("HomeDashboard");
  const tApp = useTranslations("SellerApp");
  // A status row's chosen tile, and a report's period and currency, kept here as a page would.
  const [tileView, setTileView] = useState<"overdue" | "open" | "paid" | null>("overdue");
  const [reportQuery, setReportQuery] = useState<ReportQuery>({ period: "month" });
  const [reportInOne, setReportInOne] = useState<Currency | null>(null);
  // Shop details' groups with the sample shop's values, editable here.
  const [location, setLocation] = useState<ShopLocation>({
    address: SAMPLE_DELIVERY.pickup.address,
    mapUrl: "",
    pickupEnabled: SAMPLE_DELIVERY.pickup.enabled,
    pickupHours: SAMPLE_DELIVERY.pickup.hours,
  });
  const [invoice, setInvoice] = useState<InvoiceDetails>(SAMPLE_INVOICE_DETAILS);
  const [pricing, setPricing] = useState<PricingDraft>(() => toPricingDraft(SAMPLE_STORE_SETTINGS));
  const [shopInfoOpen, setShopInfoOpen] = useState(false);
  // Selling at the counter, with a sample sale of two lines.
  const [counterQuantities, setCounterQuantities] = useState<Record<string, number>>({ latte: 2, cookie: 1 });
  const [cashText, setCashText] = useState("");
  const [qrSeen, setQrSeen] = useState(false);
  const tCounterDemo = useTranslations("Counter");
  const sampleCounterTotal = (counterQuantities.latte ?? 0) * SAMPLE_LATTE_CENTS + (counterQuantities.cookie ?? 0) * SAMPLE_COOKIE_CENTS;
  const dirty = shopName !== savedShopName;
  const dates = useDateText();
  /** Three hours ago: one moment that shows every way a date is written. */
  const [sampleMoment] = useState(() => new Date(Date.now() - SAMPLE_HOURS_AGO * 60 * 60 * 1000).toISOString());

  const columns: DataGridColumn<SampleOrder>[] = [
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
          {/* Who a bill is from: search, keyboard, add a new one by name. */}
          <Demo name="SupplierPicker">
            <SupplierPicker suppliers={SAMPLE_SUPPLIERS} value={supplierId} onChange={setSupplierId} onAddNew={() => undefined} />
          </Demo>
          {/* The number cards under every detail page's title: a customer, an item, a supplier, a bill. */}
          <Demo name="DetailStats">
            <DetailStats
              stats={[
                { icon: Boxes, label: t("detailStatOnHand"), value: "24", detail: t("detailStatInStock") },
                { icon: Coins, label: t("detailStatCost"), value: formatMoney(2_600, "USD") },
                { icon: Wallet, label: t("detailStatValue"), value: formatMoney(62_400, "USD") },
                { icon: Store, label: t("detailStatBills"), value: "3" },
              ]}
              note={t("detailStatNote")}
            />
          </Demo>
          <Demo name="PhotoThumb" className="flex-row">
            <PhotoThumb photo={{ key: "sample", url: "/icons/icon-512.png", thumbUrl: "/icons/icon-192.png" }} className="h-16 w-16 rounded-full object-cover" />
          </Demo>
        </Section>
      </div>

      <Section title={t("shopDetailsSection")} description={t("shopDetailsHint")}>
        {/* Shop details (design/screens.md S10): its groups, as the live page uses them. */}
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
                shop={{ name: t("detailShopValue"), logoUrl: null, phone: SAMPLE_SHOP.phone, address: location.address }}
              />
            </Card>
          </Demo>
          <Demo name={["Paper", "PaperHeader", "PaperStamp", "PaperRow", "PaperDivider", "PaperSignatures", "PrintLink"]}>
            {/* The pieces of every printed document: invoice, bill, return, payment voucher. */}
            <div className="overflow-hidden rounded-2xl border border-border">
              <Paper size="a4">
                <PaperHeader
                  shop={{ name: t("detailShopValue"), phone: SAMPLE_SHOP.phone, address: location.address }}
                  title={tPaper("titleVoucher")}
                  stamps={
                    <>
                      <PaperStamp tone="paid">{tPaper("paid")}</PaperStamp>
                      <PaperStamp tone="void">{tPaper("void")}</PaperStamp>
                    </>
                  }
                  receipt={false}
                />
                <PaperDivider receipt={false} />
                <dl className="flex flex-col gap-1 text-sm">
                  <PaperRow label={tPaper("number")} value="PAY-0004" strong />
                  <PaperRow label={tPaper("balanceAfter")} value={formatMoney(50700, "USD")} />
                </dl>
                <PaperSignatures labels={[tPaper("signPaidBy"), tPaper("signReceivedPayment")]} receipt={false} />
              </Paper>
            </div>
            <PrintLink href="#" label={tPaper("titleVoucher")} />
          </Demo>
        </div>
      </Section>

      <Section title={t("homeChartsSection")} description={t("homeChartsHint")}>
        {/* The dashboard's blocks (design/screens.md S3), from chart-parts: ChartCard, ChangeText, ChartLegend, ChartTooltipBox, Sparkline. As on the home. */}
        <div className="flex flex-col gap-8">
          <Demo name="NeedsYouStrip">
            <NeedsYouStrip
              title={tDashboard("needsYouTitle")}
              allClear={tApp("allCaughtUp")}
              items={[
                { key: "orders", icon: Bell, tone: "warning", text: tDashboard("ordersToHandle", { count: 3 }), href: "#", show: true },
                { key: "bills", icon: ReceiptText, tone: "danger", text: tDashboard("billsOverdue", { count: 1 }), href: "#", show: true },
              ]}
            />
          </Demo>
          <Demo name={["KpiLink", "Sparkline", "ChangeText"]}>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <KpiLink
                href="#"
                icon={ShoppingBag}
                label={tDashboard("kpiSales")}
                value={formatMoney(182_400, "USD")}
                sub={formatMoney(120_000, "KHR")}
                change={
                  <>
                    <ChangeText percent={15} />
                    <span>{tDashboard("compare_week")}</span>
                  </>
                }
                spark={{ values: SAMPLE_DASHBOARD.sales.points.map((point) => point.shop.USD + point.online.USD), label: tDashboard("trendOf", { name: tDashboard("kpiSales") }) }}
              />
              <KpiLink
                href="#"
                icon={Percent}
                label={tDashboard("kpiMargin")}
                value={tDashboard("percent", { value: 32 })}
                change={
                  <>
                    <ChangeText percent={-2} text={tDashboard("points", { value: 2 })} />
                    <span>{tDashboard("compare_week")}</span>
                  </>
                }
              />
            </div>
          </Demo>
          <Demo name={["SalesTrendCard", "ChartCard", "ChartLegend", "ChartTooltipBox"]}>
            <SalesTrendCard dashboard={SAMPLE_DASHBOARD} mainCurrency="USD" rate={SAMPLE_STORE_SETTINGS.usdToKhrRate} previousLabel={tDashboard("previous_week")} href="#" />
          </Demo>
          <div className="grid gap-5 lg:grid-cols-2">
            <Demo name="SalesMixCard">
              <SalesMixCard dashboard={SAMPLE_DASHBOARD} mainCurrency="USD" rate={SAMPLE_STORE_SETTINGS.usdToKhrRate} href="#" />
            </Demo>
            <Demo name={["ProfitSnapshotCard", "ProfitStatement"]}>
              {SAMPLE_DASHBOARD.profit && <ProfitSnapshotCard profit={SAMPLE_DASHBOARD.profit} mainCurrency="USD" rate={SAMPLE_STORE_SETTINGS.usdToKhrRate} href="#" addCostsHref="#" />}
            </Demo>
            <Demo name="BestSellersCard">
              <BestSellersCard products={SAMPLE_DASHBOARD.sales.products} mainCurrency="USD" rate={SAMPLE_STORE_SETTINGS.usdToKhrRate} href="#" productHref={() => "#"} />
            </Demo>
            <Demo name="LatestOrdersCard">
              <LatestOrdersCard orders={SAMPLE_SELLER_ORDERS} href="#" orderHref={() => "#"} />
            </Demo>
          </div>
          <Demo name="ReportLinks">
            <ReportLinks base="#" plan="pro" variant="compact" />
          </Demo>
          <Demo name="ActionStatTile">
            {/* A number that leads somewhere: the Purchases page's tiles. */}
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <ActionStatTile icon={AlarmClock} tone="danger" label={tPurchases("tile_overdue")} count={tPayables("billCount", { count: 2 })} amount={formatMoney(72100, "USD")} action={tPurchases("tileActionPay")} active onSelect={() => undefined} />
              <ActionStatTile icon={CircleCheck} tone="success" label={tPurchases("tile_paid")} count={tPayables("billCount", { count: 7 })} amount={formatMoney(347650, "USD")} sub={`+ ${formatMoney(641000, "KHR")}`} active={false} onSelect={() => undefined} />
            </div>
          </Demo>
          <Demo name="StatusTileRow">
            {/* A page's row of tiles (Purchases, Stock, Suppliers, Orders, Customers, the reports): tap one and the list follows. */}
            <StatusTileRow
              label={tPurchases("tilesLabel")}
              active={tileView}
              onSelect={setTileView}
              tiles={[
                { key: "overdue", icon: AlarmClock, tone: "danger", label: tPurchases("tile_overdue"), count: tPayables("billCount", { count: 2 }), amount: formatMoney(72100, "USD"), action: tPurchases("tileActionPay"), view: "overdue" },
                { key: "open", icon: Wallet, tone: "warning", label: tPurchases("tile_open"), count: tPayables("billCount", { count: 3 }), amount: formatMoney(50700, "USD"), action: tPurchases("tileActionPay"), view: "open" },
                { key: "paid", icon: CircleCheck, tone: "success", label: tPurchases("tile_paid"), count: tPayables("billCount", { count: 7 }), amount: formatMoney(347650, "USD"), sub: `+ ${formatMoney(641000, "KHR")}`, view: "paid" },
              ]}
            />
          </Demo>
          <Demo name="ReportFilters">
            {/* Every report's period and "show all in one currency" (design/screens.md S17). */}
            <ReportFilters query={reportQuery} onQuery={setReportQuery} inOne={reportInOne} onInOne={setReportInOne} mainCurrency="USD" rate={SAMPLE_STORE_SETTINGS.usdToKhrRate} />
          </Demo>
        </div>
      </Section>

      <Section title={t("counterSection")} description={t("counterHint")}>
        {/* Sell in shop (design/screens.md P1–P2): the sale, cash with change, the shop's own QR, and where the QR is added. */}
        <div className="grid gap-8 md:grid-cols-2">
          <Demo name="CounterCart">
            <CounterCart
              lines={(["latte", "cookie"] as const)
                .filter((key) => (counterQuantities[key] ?? 0) > 0)
                .map((key) => ({
                  key,
                  title: key === "latte" ? t("sampleLatte") : t("sampleCookie"),
                  quantity: counterQuantities[key] ?? 0,
                  lineTotal: formatMoney((counterQuantities[key] ?? 0) * (key === "latte" ? SAMPLE_LATTE_CENTS : SAMPLE_COOKIE_CENTS), "USD"),
                }))}
              totals={{
                subtotal: formatMoney(sampleCounterTotal, "USD"),
                total: formatMoney(sampleCounterTotal, "USD"),
                approx: "",
              }}
              onQuantity={(key, quantity) => setCounterQuantities((current) => ({ ...current, [key]: Math.max(0, quantity) }))}
            />
          </Demo>
          <Demo name="CashPayment">
            <CashPayment total={sampleCounterTotal} currency="USD" receivedText={cashText} onReceivedText={setCashText} />
          </Demo>
          <Demo name="QrPayment">
            <QrPayment qrUrl={null} amount={formatMoney(sampleCounterTotal, "USD")} setupHref="#" confirmed={qrSeen} onConfirmed={setQrSeen} />
          </Demo>
          <Demo name={["PaymentQrField", "PaymentQrGuide"]}>
            <PaymentQrField previewUrl={null} onFile={() => undefined} onRemove={() => undefined} />
          </Demo>
          <Demo name="KhqrPayPanel">
            <KhqrPayPanel
              storeName={SAMPLE_SHOP.nameEn}
              amountMinor={10_800}
              currency="KHR"
              qrText="KHQR-STYLEGUIDE"
              secondsLeft={432}
              status="pending"
              saveName="khqr-styleguide.png"
              expired={{ body: tKhqr("expiredOrderBody"), actionLabel: tKhqr("tryAgain"), onAction: () => undefined }}
              testPay={{ label: tKhqr("testPay"), note: tKhqr("testPayNote"), onPay: () => undefined, busy: false }}
            />
          </Demo>
          <Demo name="StockNote">
            <div className="flex flex-col gap-1">
              <StockNote state={{ kind: "low", available: 3 }} labels={{ soldOut: tShop("soldOut"), onlyLeft: (count) => tShop("onlyLeft", { count }) }} />
              <StockNote state={{ kind: "sold_out" }} labels={{ soldOut: tShop("soldOut"), onlyLeft: (count) => tShop("onlyLeft", { count }) }} />
            </div>
          </Demo>
          <Demo name="UpgradePrompt">
            <UpgradePrompt title={tCounterDemo("upgradeTitle")} body={tCounterDemo("upgradeBody")} plan="basic" href="#" />
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
              phone: SAMPLE_SHOP.phone,
              address: SAMPLE_DELIVERY.pickup.address,
              mapUrl: "",
              telegram: SAMPLE_INVOICE_DETAILS.telegramLink,
              facebook: SAMPLE_INVOICE_DETAILS.facebookLink,
              delivery: SAMPLE_DELIVERY,
              currency: SAMPLE_STORE_SETTINGS.defaultCurrency,
              rate: SAMPLE_STORE_SETTINGS.usdToKhrRate,
              khqrReady: true,
              allowCod: SAMPLE_STORE_SETTINGS.allowCod,
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
            rows={SAMPLE_ORDERS}
            getRowId={(order) => order.orderNumber}
            columns={columns}
            searchText={(order) => `${order.orderNumber} ${order.name}`}
            searchPlaceholder={t("gridSearch")}
            chips={[{ value: "waiting", label: t("tone_warning"), predicate: (order: SampleOrder) => WAITING.has(order.status) }]}
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
