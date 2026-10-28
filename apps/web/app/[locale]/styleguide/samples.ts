import type { Currency, DeliverySettings, InvoiceDetails, OrderFulfilment, OrderStatus, SitePage, StoreSettings } from "@khmio/shared";

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
