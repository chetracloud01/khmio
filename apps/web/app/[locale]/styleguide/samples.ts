import type { Currency, DeliverySettings, InvoiceDetails, OrderFulfilment, OrderStatus, SitePage, StoreSettings } from "@khmio/shared";
import type { Dashboard, SellerOrder, Supplier } from "@/lib/api";

// Sample values the styleguide shows its parts with: a made-up garage, like
// the Demo Garage the app is tested with (docs/blueprint.md "Garage first").
// Only the styleguide uses them; screens read real data from the API.

export const SAMPLE_SHOP = { nameEn: "Mekong Auto Garage", phone: "85512345678" };

export const SAMPLE_STORE_SETTINGS: StoreSettings = { defaultCurrency: "USD", usdToKhrRate: 4100, allowCod: true, vatPercent: 10 };

/** Two zones, pickup and the provinces; three outer districts left out, so "we don't deliver there" can be seen. */
export const SAMPLE_DELIVERY: DeliverySettings = {
  zones: [
    { id: "zone-central", name: "Central", districtIds: ["daun-penh", "chamkar-mon", "prampir-makara", "boeng-keng-kang", "tuol-kouk"], feeUsdCents: 100, feeKhr: 4000 },
    { id: "zone-outer", name: "Outer", districtIds: ["sen-sok", "russey-keo", "chroy-changvar", "mean-chey", "chbar-ampov", "pou-senchey"], feeUsdCents: 150, feeKhr: 6000 },
  ],
  pickup: { enabled: true, address: "ផ្លូវជាតិលេខ ៥ ឫស្សីកែវ · National Road 5, Russey Keo", hours: "7:30 – 18:00" },
  province: { enabled: true, note: "", feeUsdCents: 200, feeKhr: 8000 },
  drivers: [
    { id: "driver-1", name: "Bong Rith", phone: "85512345678", kind: "own" },
    { id: "driver-2", name: "Sok Delivery", phone: "855971234567", kind: "partner" },
  ],
};

export const SAMPLE_INVOICE_DETAILS: InvoiceDetails = {
  taxNumber: "K009-901234567",
  telegramLink: "t.me/mekongautogarage",
  facebookLink: "fb.com/mekongautogarage",
  invoiceNote: "សូមអរគុណ! ធានាការងារជួសជុល 30 ថ្ងៃ ដោយភ្ជាប់បង្កាន់ដៃនេះ។",
};

/** One row of the data grid sample. */
export interface SampleOrder {
  orderNumber: string;
  name: string;
  status: OrderStatus;
  fulfilment: OrderFulfilment;
  total: number;
  currency: Currency;
}

export const SAMPLE_ORDERS: SampleOrder[] = [
  { orderNumber: "#128", name: "Sok Dara", status: "cod_pending", fulfilment: "delivery", total: 2450, currency: "USD" },
  { orderNumber: "#127", name: "Heng Pisey", status: "confirmed", fulfilment: "pickup", total: 4200, currency: "USD" },
  { orderNumber: "#126", name: "Chan Sreymom", status: "packing", fulfilment: "delivery", total: 62000, currency: "KHR" },
  { orderNumber: "#125", name: "Kim Lina", status: "out_for_delivery", fulfilment: "delivery", total: 5800, currency: "USD" },
  { orderNumber: "#124", name: "Vann Rithy", status: "completed", fulfilment: "in_store", total: 750, currency: "USD" },
  { orderNumber: "#123", name: "Meas Sophea", status: "cancelled", fulfilment: "delivery", total: 1990, currency: "USD" },
  { orderNumber: "#122", name: "Sophea Nhem", status: "awaiting_payment", fulfilment: "pickup", total: 3500, currency: "USD" },
  { orderNumber: "#121", name: "Visal Prak", status: "delivered", fulfilment: "delivery", total: 48000, currency: "KHR" },
];

/** The sample orders as GET /orders gives them (the dashboard's latest orders). */
export const SAMPLE_SELLER_ORDERS: SellerOrder[] = SAMPLE_ORDERS.map((order, index) => ({
  id: `order-${index}`,
  orderNumber: Number(order.orderNumber.slice(1)),
  trackingCode: `MEK-SAMP-${index}`,
  status: order.status,
  channel: order.fulfilment === "in_store" ? "in_store" : "online",
  paymentMethod: order.fulfilment === "in_store" ? "cash" : "cod",
  currency: order.currency,
  totalMinor: order.total,
  buyerName: order.name,
  buyerPhone: SAMPLE_SHOP.phone,
  fulfilment: order.fulfilment,
  area: "phnom_penh",
  districtId: null,
  provinceId: null,
  createdAt: `2026-10-${String(29 - index).padStart(2, "0")}T09:30:00+07:00`,
  itemCount: 1,
}));

/**
 * Site kit sections no website page uses today (an announcement, a timed
 * promotion, a seller's story, a coming-soon waitlist), kept for the admin's
 * site editor (A10–A12): shown on the styleguide with this sample page so
 * they stay in view.
 */
export const SAMPLE_SITE_PAGE: SitePage = {
  slug: "",
  seo: { title: { km: "គំរូ", en: "Sample" }, description: { km: "គំរូ", en: "Sample" } },
  sections: [
    {
      id: "announcement",
      type: "announcement",
      visible: true,
      text: { km: "ថ្មី៖ ប័ណ្ណការងារ សម្រាប់យានដ្ឋាន", en: "New: job cards for garages" },
      link: { label: { km: "មើល", en: "See it" }, href: "/solutions/garage" },
    },
    {
      id: "promotion",
      type: "promotion",
      visible: true,
      title: { km: "យានដ្ឋាន ២០ ដំបូង ទទួលបានជំនួយរៀបចំឥតគិតថ្លៃ", en: "The first 20 garages get free set-up help" },
      line: { km: "យើងបន្ថែមគ្រឿងបន្លាស់ និងសេវាកម្មជាមួយអ្នក។", en: "We add your parts and services with you." },
      button: { label: { km: "ចាប់ផ្តើមឥតគិតថ្លៃ", en: "Start free" }, href: "/start" },
      startsAt: "2026-01-01T00:00:00+07:00",
      endsAt: "2099-01-01T00:00:00+07:00",
    },
    {
      id: "story",
      type: "sellerStory",
      visible: true,
      name: { km: "សុខា", en: "Sokha" },
      shop: { km: "យានដ្ឋានមេគង្គ", en: "Mekong Auto Garage" },
      quote: { km: "ឥឡូវខ្ញុំដឹងថារថយន្តណាកំពុងជួសជុល និងគ្រឿងបន្លាស់ណានៅសល់។", en: "Now I know which car is in the workshop and which parts are left." },
      permission: true,
      sample: true,
    },
    {
      id: "waitlist",
      type: "waitlist",
      visible: true,
      solution: "retail",
      title: { km: "ប្រាប់ខ្ញុំពេលវារួចរាល់", en: "Tell me when it's ready" },
      thanks: { km: "អរគុណ! យើងនឹងផ្ញើសារតាម Telegram ឬទូរស័ព្ទ នៅពេលវាបើក។", en: "Thank you! We'll message you on Telegram or by phone when it opens." },
    },
  ],
};

/** Suppliers for the styleguide's SupplierPicker. */
export const SAMPLE_SUPPLIERS: Supplier[] = [
  { id: "s1", name: "Chhay Auto Parts", phone: "85512345678", note: "", archived: false, purchaseCount: 3, bought: { USD: 106_050, KHR: 0 }, owed: { USD: 52_400, KHR: 0 }, lastBillOn: "2026-10-08" },
  { id: "s2", name: "Angkor Tyres & Batteries", phone: "855971234567", note: "", archived: false, purchaseCount: 4, bought: { USD: 248_500, KHR: 0 }, owed: { USD: 0, KHR: 0 }, lastBillOn: "2026-10-23" },
  { id: "s3", name: "Phnom Penh Lubricants", phone: "", note: "", archived: false, purchaseCount: 2, bought: { USD: 121_800, KHR: 540_000 }, owed: { USD: 0, KHR: 0 }, lastBillOn: "2026-10-16" },
];

/** A day key so many days before 2026-10-29. */
const sampleDay = (daysAgo: number) => new Date(Date.UTC(2026, 9, 29 - daysAgo)).toISOString().slice(0, 10);
/** Sales that rise and fall through the week. */
const sampleSales = (index: number) => 20_000 + ((index * 7919) % 9) * 6_000 + (index % 7 === 5 ? 18_000 : 0);
const inDollars = (USD: number) => ({ USD, KHR: 0 });
const SAMPLE_WEEK = 7;

/** The dashboard for 7 days beside the 7 before (design/screens.md S3), on Pro: profit and stock included. */
export const SAMPLE_DASHBOARD: Dashboard = {
  period: "week",
  days: { from: sampleDay(6), to: sampleDay(0) },
  previousDays: { from: sampleDay(13), to: sampleDay(7) },
  unit: "day",
  sales: {
    now: { sales: { USD: 182_400, KHR: 120_000 }, orders: 21, average: { USD: 8_686, KHR: 120_000 }, shop: inDollars(64_000), online: { USD: 118_400, KHR: 120_000 }, bookings: 2 },
    before: { sales: inDollars(158_000), orders: 18, average: inDollars(8_778), shop: inDollars(60_000), online: inDollars(98_000), bookings: 0 },
    toCollect: { orders: 3, money: { USD: 12_500, KHR: 80_000 } },
    points: Array.from({ length: SAMPLE_WEEK }, (_, index) => {
      const sales = sampleSales(index);
      const shop = Math.round(sales * 0.35);
      return { key: sampleDay(SAMPLE_WEEK - 1 - index), shop: inDollars(shop), online: inDollars(sales - shop), orders: 3, previous: inDollars(sampleSales(index + SAMPLE_WEEK)) };
    }),
    payments: [
      { method: "cod", orders: 11, money: inDollars(96_000) },
      { method: "cash", orders: 7, money: inDollars(52_000) },
      { method: "khqr", orders: 3, money: inDollars(34_400) },
    ],
    products: [
      { productId: "p1", nameKm: "សំបកកង់", nameEn: "Michelin Primacy 4 tyre", quantity: 8, money: inDollars(92_000) },
      { productId: "p2", nameKm: "ប្រេងម៉ាស៊ីន", nameEn: "Engine oil 5W-30", quantity: 20, money: inDollars(25_000) },
      { productId: "p3", nameKm: "អាគុយ", nameEn: "Amaron battery", quantity: 2, money: inDollars(16_000) },
    ],
  },
  profit: {
    now: { netSales: inDollars(182_400), costedGoods: inDollars(170_000), cost: inDollars(116_000), missingCostSales: inDollars(12_000), grossProfit: inDollars(54_400), losses: inDollars(-2_500), found: inDollars(0), profit: inDollars(51_900), lossesEstimated: false },
    before: { netSales: inDollars(158_000), costedGoods: inDollars(158_000), cost: inDollars(110_600), missingCostSales: inDollars(0), grossProfit: inDollars(47_400), losses: inDollars(0), found: inDollars(0), profit: inDollars(47_400), lossesEstimated: false },
    points: Array.from({ length: SAMPLE_WEEK }, (_, index) => ({ key: sampleDay(SAMPLE_WEEK - 1 - index), profit: inDollars(Math.round(sampleSales(index) * 0.3)) })),
  },
  stock: { value: { USD: 383_056, KHR: 540_000 }, withoutCost: 0, toReorder: 4, unpaidBills: 3, overdueBills: 1 },
};
