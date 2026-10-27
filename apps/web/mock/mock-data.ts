// Mock data for screens built under app/[locale]/mockup/. Real data comes
// from the API once a screen is approved and connected (see CLAUDE.md
// workflow). Product titles are catalog data, not UI copy, so they live
// here rather than in messages/*.json.

import {
  BUSINESS_TYPE_DEFAULTS,
  BUSINESS_TYPES,
  convertKhrToUsdCents,
  convertUsdCentsToKhr,
  DEFAULT_UNITS,
  stockMovementSign,
  TRACKING_CODE_ALPHABET,
  TRACKING_CODE_LENGTH,
  type BusinessType,
  type Currency,
  type DeliverySettings,
  type InvoiceDetails,
  type KycIdType,
  type KycRejectReason,
  type KycStatus,
  type PlanId,
  type StockAdjustmentReason,
  type StockMovementType,
  type StoreSettings,
  type SubscriptionStatus,
} from "@khmio/shared";

export interface MockStore {
  slug: string;
  nameKm: string;
  nameEn: string;
  bannerColor: string;
  /** 855XXXXXXXX — buyers tap it to call the shop. */
  phone: string;
}

// The seller's selling settings (currency, rate, delivery fee, cash on
// delivery, VAT) before they change anything in Dashboard → Store settings.
// Stands in for the stores table columns in docs/blueprint.md.
export const mockStoreSettings: StoreSettings = {
  defaultCurrency: "USD",
  usdToKhrRate: 4100,
  // Whether the seller accepts Cash on delivery at all. Even when true, the
  // checkout screen only offers it for pickup or Phnom Penh delivery —
  // province orders go by bus and must be prepaid.
  allowCod: true,
  vatPercent: 10,
};

// How the sample shop gets orders to buyers before the seller changes
// anything in Dashboard → Delivery. Three outer districts are left out on
// purpose, so "we don't deliver there" can be seen at checkout.
export const mockDeliverySettings: DeliverySettings = {
  zones: [
    {
      id: "zone-central",
      name: "Central",
      districtIds: ["daun-penh", "chamkar-mon", "prampir-makara", "boeng-keng-kang", "tuol-kouk"],
      feeUsdCents: 100,
      feeKhr: 4000,
    },
    {
      id: "zone-outer",
      name: "Outer",
      districtIds: ["sen-sok", "russey-keo", "chroy-changvar", "mean-chey", "chbar-ampov", "pou-senchey"],
      feeUsdCents: 150,
      feeKhr: 6000,
    },
  ],
  pickup: { enabled: true, address: "ផ្លូវ ២៤០ ដូនពេញ · St. 240, Daun Penh", hours: "7:00 – 19:00" },
  province: { enabled: true, note: "", feeUsdCents: 200, feeKhr: 8000 },
  drivers: [
    { id: "driver-1", name: "Bong Rith", phone: "85512345678", kind: "own" },
    { id: "driver-2", name: "Sok Delivery", phone: "855971234567", kind: "partner" },
  ],
};

export interface MockCategory {
  id: string;
  labelKm: string;
  labelEn: string;
}

export interface MockBrand {
  id: string;
  nameKm: string;
  nameEn: string;
}

/** Unit of measure a product is sold by — piece, kg, box, carton, etc. */
export interface MockUom {
  id: string;
  labelKm: string;
  labelEn: string;
}

/** Central storage — where Purchase transactions typically land (Advance tier only). */
export interface MockWarehouse {
  id: string;
  nameKm: string;
  nameEn: string;
}

/** A retail/wholesale outlet that sells to customers, supplied by one warehouse (Advance tier only). */
export interface MockBranch {
  id: string;
  nameKm: string;
  nameEn: string;
  warehouseId: string;
}

export type MockStockLocationType = "warehouse" | "branch";

/**
 * One stock movement. Current stock at a location is always derived by
 * summing these (purchases add, sales subtract) rather than stored as its
 * own number — a ledger, not a cached balance, so it can never drift out of
 * sync with its own history.
 */
export interface MockStockTransaction {
  id: string;
  type: StockMovementType;
  productId: string;
  variantId?: string;
  locationType: MockStockLocationType;
  locationId: string;
  /** Always positive; stockMovementSign(type) says whether it adds or takes away. */
  quantity: number;
  note?: string;
  /** Corrections only. */
  reason?: StockAdjustmentReason;
  /** Links the out and in halves of one transfer. */
  transferId?: string;
  /** Minutes since the transaction was recorded, so "time ago" stays correct whenever the mockup is viewed. */
  minutesAgo: number;
}

/**
 * A sellable variant (SKU) of a product — e.g. Size S/M/L, a colour, or any
 * other seller-defined option. The label is free text set by the seller, so
 * this works the same way for a coffee shop's cup sizes as it would for a
 * clothing seller's sizes/colours or any other merchant's option list.
 *
 * Stock quantity isn't tracked here — it's tracked per branch/warehouse
 * location, in MockStockTransaction, once a store is on the Advance tier
 * (see docs/blueprint.md "Subscription tiers").
 */
export interface MockVariant {
  id: string;
  sku: string;
  labelKm: string;
  labelEn: string;
  /** Price the storefront shows buyers. */
  retailPriceUsdCents?: number;
  retailPriceKhr?: number;
  /** Price for bulk/B2B orders — not shown on the buyer storefront yet. */
  wholesalePriceUsdCents?: number;
  wholesalePriceKhr?: number;
}

export interface MockProduct {
  id: string;
  categoryId: string;
  brandId?: string;
  uomId?: string;
  titleKm: string;
  titleEn: string;
  /** Shown on the buyer's product page. */
  descriptionKm?: string;
  descriptionEn?: string;
  /** True = kept in the dashboard, not shown in the shop. Absent = visible. */
  isHidden?: boolean;
  photoColor: string;
  /** Real client-side photo previews from the product form, newest catalog entries only. */
  photoDataUrls?: string[];
  /** Used only when the product has no variants. Price the storefront shows buyers. */
  retailPriceUsdCents?: number;
  retailPriceKhr?: number;
  /** Used only when the product has no variants. Price for bulk/B2B orders — not shown on the buyer storefront yet. */
  wholesalePriceUsdCents?: number;
  wholesalePriceKhr?: number;
  /** Merchant-set discount from master data; applied automatically, no promo code needed. */
  discountPercent?: number;
  /** When set, the buyer must pick one before adding to cart; each variant has its own price/SKU. */
  variants?: MockVariant[];
}

export type MockPromoType = "percent" | "fixed";

export interface MockPromoCode {
  code: string;
  type: MockPromoType;
  /** Percent (0-100) if type is "percent", or USD cents off if type is "fixed". */
  value: number;
}

export const mockCategories: MockCategory[] = [
  { id: "drinks", labelKm: "ភេសជ្ជៈ", labelEn: "Drinks" },
  { id: "bakery", labelKm: "នំបុ័ង", labelEn: "Bakery" },
];

export const mockBrands: MockBrand[] = [{ id: "own-brand", nameKm: "ម៉ាកផ្ទាល់ខ្លួន", nameEn: "Own brand" }];

export const mockUoms: MockUom[] = DEFAULT_UNITS.map((unit) => ({ id: unit.key, labelKm: unit.nameKm, labelEn: unit.nameEn }));

// Starting defaults per business type, applied once at the end of
// onboarding. The real version seeds these server-side when a store is created.
export const mockBusinessTypeDefaults = Object.fromEntries(
  BUSINESS_TYPES.map((type) => [
    type,
    {
      uomId: BUSINESS_TYPE_DEFAULTS[type].unitKey,
      categories: BUSINESS_TYPE_DEFAULTS[type].categories.map((category) => ({ id: category.key, labelKm: category.nameKm, labelEn: category.nameEn })),
    },
  ]),
) as Record<BusinessType, { uomId: string; categories: MockCategory[] }>;

export const mockWarehouses: MockWarehouse[] = [{ id: "main-wh", nameKm: "ឃ្លាំងសំខាន់", nameEn: "Main warehouse" }];

export const mockBranches: MockBranch[] = [
  { id: "main-branch", nameKm: "សាខាសំខាន់", nameEn: "Main branch", warehouseId: "main-wh" },
];

// A short, representative stock ledger for the Advance-tier stock screen —
// stands in for a real purchase/sale transaction history.
export const mockStockTransactions: MockStockTransaction[] = [
  { id: "st1", type: "purchase", productId: "p1", variantId: "p1-s", locationType: "warehouse", locationId: "main-wh", quantity: 50, minutesAgo: 4320 },
  { id: "st2", type: "purchase", productId: "p1", variantId: "p1-m", locationType: "warehouse", locationId: "main-wh", quantity: 50, minutesAgo: 4320 },
  { id: "st3", type: "purchase", productId: "p1", variantId: "p1-l", locationType: "warehouse", locationId: "main-wh", quantity: 30, minutesAgo: 4320 },
  // The branch is stocked from the warehouse: each move is an out/in pair, so the store's total stays the same.
  { id: "st4a", type: "transfer_out", productId: "p1", variantId: "p1-s", locationType: "warehouse", locationId: "main-wh", quantity: 20, transferId: "tr1", minutesAgo: 1440 },
  { id: "st4b", type: "transfer_in", productId: "p1", variantId: "p1-s", locationType: "branch", locationId: "main-branch", quantity: 20, transferId: "tr1", minutesAgo: 1440 },
  { id: "st5a", type: "transfer_out", productId: "p1", variantId: "p1-m", locationType: "warehouse", locationId: "main-wh", quantity: 20, transferId: "tr2", minutesAgo: 1440 },
  { id: "st5b", type: "transfer_in", productId: "p1", variantId: "p1-m", locationType: "branch", locationId: "main-branch", quantity: 20, transferId: "tr2", minutesAgo: 1440 },
  { id: "st6", type: "sale", productId: "p1", variantId: "p1-m", locationType: "branch", locationId: "main-branch", quantity: 5, minutesAgo: 90 },
  // A supplier can also deliver straight to a branch.
  { id: "st7", type: "purchase", productId: "p4", locationType: "branch", locationId: "main-branch", quantity: 40, minutesAgo: 1440 },
  { id: "st8", type: "sale", productId: "p4", locationType: "branch", locationId: "main-branch", quantity: 12, minutesAgo: 60 },
  { id: "st9", type: "adjust_out", productId: "p4", locationType: "branch", locationId: "main-branch", quantity: 2, reason: "damaged", minutesAgo: 30 },
  // Enough variety for the buyer shop on Pro/Advance: plenty, "only a few left", and sold out (Lemonade has none).
  { id: "st10", type: "purchase", productId: "p2", locationType: "branch", locationId: "main-branch", quantity: 30, minutesAgo: 1440 },
  { id: "st11", type: "purchase", productId: "p3", locationType: "branch", locationId: "main-branch", quantity: 4, minutesAgo: 1440 },
  { id: "st12", type: "purchase", productId: "p5", locationType: "branch", locationId: "main-branch", quantity: 12, minutesAgo: 1440 },
];

/** Current quantity at a location — the sum of every movement recorded against it. */
export function getStockLevel(
  transactions: MockStockTransaction[],
  params: { productId: string; variantId?: string; locationType: MockStockLocationType; locationId: string },
): number {
  return transactions.reduce((sum, tx) => {
    if (tx.productId !== params.productId) return sum;
    if ((tx.variantId ?? null) !== (params.variantId ?? null)) return sum;
    if (tx.locationType !== params.locationType || tx.locationId !== params.locationId) return sum;
    return sum + stockMovementSign(tx.type) * tx.quantity;
  }, 0);
}

export const mockPromoCodes: MockPromoCode[] = [
  { code: "SAVE10", type: "percent", value: 10 },
  { code: "WELCOME1", type: "fixed", value: 100 },
];

export type MockPaymentMethodCode = "khqr" | "aba_payway" | "cod";

export interface MockPaymentMethod {
  code: MockPaymentMethodCode;
  labelKm: string;
  labelEn: string;
}

export const mockPaymentMethods: MockPaymentMethod[] = [
  { code: "khqr", labelKm: "KHQR", labelEn: "KHQR" },
  { code: "aba_payway", labelKm: "ABA PayWay", labelEn: "ABA PayWay" },
  { code: "cod", labelKm: "បង់ប្រាក់ពេលទទួលទំនិញ", labelEn: "Cash on delivery" },
];

/** Unit price after the product's master-data discount, for the product itself or one of its variants. */
export function getUnitUsdCents(product: MockProduct, variant?: MockVariant): number | undefined {
  const base = variant ? variant.retailPriceUsdCents : product.retailPriceUsdCents;
  if (base == null) return undefined;
  if (!product.discountPercent) return base;
  return Math.round(base * (1 - product.discountPercent / 100));
}

export function getUnitKhr(product: MockProduct, variant?: MockVariant): number | undefined {
  const base = variant ? variant.retailPriceKhr : product.retailPriceKhr;
  if (base == null) return undefined;
  if (!product.discountPercent) return base;
  return Math.round(base * (1 - product.discountPercent / 100));
}

/** The cheapest variant, for the grid card's "From $X" price. Real code would
 * pick the cheapest in the buyer's selected currency; this mock assumes every
 * variant has a USD price. */
export function getStartingVariant(product: MockProduct): MockVariant | undefined {
  if (!product.variants?.length) return undefined;
  return product.variants.reduce((cheapest, variant) =>
    (variant.retailPriceUsdCents ?? Infinity) < (cheapest.retailPriceUsdCents ?? Infinity) ? variant : cheapest,
  );
}

/**
 * Unit price in the buyer's chosen order currency (before the master-data
 * discount). If the product has no native price in that currency, convert
 * from whichever price it does have, using the store's checkout-time rate —
 * see docs/blueprint.md "Multi-currency pricing and totals".
 */
export function getUnitAmount(
  product: MockProduct,
  currency: Currency,
  rate: number,
  variant?: MockVariant,
): number | undefined {
  const native =
    currency === "USD"
      ? (variant ? variant.retailPriceUsdCents : product.retailPriceUsdCents)
      : (variant ? variant.retailPriceKhr : product.retailPriceKhr);
  if (native != null) return native;

  const other =
    currency === "USD"
      ? (variant ? variant.retailPriceKhr : product.retailPriceKhr)
      : (variant ? variant.retailPriceUsdCents : product.retailPriceUsdCents);
  if (other == null) return undefined;

  return currency === "USD" ? convertKhrToUsdCents(other, rate) : convertUsdCentsToKhr(other, rate);
}

/** Unit price in the chosen currency, after the master-data discount. */
export function getDiscountedUnitAmount(
  product: MockProduct,
  currency: Currency,
  rate: number,
  variant?: MockVariant,
): number | undefined {
  const base = getUnitAmount(product, currency, rate, variant);
  if (base == null) return undefined;
  if (!product.discountPercent) return base;
  return Math.round(base * (1 - product.discountPercent / 100));
}

/** The biggest active discount in the catalog, for the storefront banner ribbon. */
export function getStoreMaxDiscountPercent(products: MockProduct[]): number {
  return products.reduce((max, product) => Math.max(max, product.discountPercent ?? 0), 0);
}

/** `${productId}::${variantId}`, or `${productId}::_base` for a product with no variants. */
export function lineKey(productId: string, variantId?: string): string {
  return `${productId}::${variantId ?? "_base"}`;
}

/** The reverse of lineKey. */
export function parseLineKey(key: string): { productId: string; variantId?: string } {
  const [productId = "", variantId] = key.split("::");
  return { productId, variantId: variantId && variantId !== "_base" ? variantId : undefined };
}

/** A mock order number, e.g. "SC-482913" for "sokha-coffee". Real orders get a sequential/DB-generated one. */
export function generateOrderNumber(store: MockStore): string {
  const prefix = store.slug
    .split("-")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${suffix}`;
}

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Slugs already in use by other stores, for the onboarding screen's live
// availability check (mocks a real uniqueness lookup against the DB).
export const mockTakenSlugs = ["sokha-coffee", "queen-bee", "phnom-penh-mart"];

/** Every priceable line in the catalog: a variant, or the product itself if it has none. */
export function getAllLineContexts(products: MockProduct[]) {
  return products.flatMap((product) => {
    if (product.variants?.length) {
      return product.variants.map((variant) => ({
        key: lineKey(product.id, variant.id),
        baseUsdCents: variant.retailPriceUsdCents,
        unitUsdCents: getUnitUsdCents(product, variant),
      }));
    }
    return [
      {
        key: lineKey(product.id),
        baseUsdCents: product.retailPriceUsdCents,
        unitUsdCents: getUnitUsdCents(product),
      },
    ];
  });
}

/** What the store owes the platform — not a buyer order. */
export interface MockSubscriptionInvoice {
  id: string;
  plan: PlanId;
  /** new = leaving the Free trial, upgrade = prorated difference, renewal = next month. */
  reason: "new" | "upgrade" | "renewal";
  currency: Currency;
  amountMinor: number;
  status: "open" | "paid";
  createdDaysAgo: number;
}

export interface MockSubscription {
  plan: PlanId;
  status: SubscriptionStatus;
  /**
   * Trial days left (trialing), days until the period ends (active), or
   * grace days left before pausing (grace). Always 0 when paused.
   */
  daysLeft: number;
  /** A downgrade waiting for the current period to end. */
  pendingPlan: PlanId | null;
  billingCurrency: Currency;
  invoices: MockSubscriptionInvoice[];
}

// A brand-new store: on the Free trial, nothing billed yet. Stands in for
// the subscriptions/subscription_invoices tables in docs/blueprint.md.
export const mockSubscription: MockSubscription = {
  plan: "free",
  status: "trialing",
  daysLeft: 9,
  pendingPlan: null,
  billingCurrency: "USD",
  invoices: [],
};

export type MockKycStatus = KycStatus;

/**
 * What a store sent for its identity check, and why it was turned down if it
 * was. Stands in for the kyc_submissions table. Photos are data URLs from
 * the merchant's own upload; the example stores have none (the admin screen
 * shows a "sample" placeholder instead).
 */
export interface MockKycRecord {
  submission?: {
    idType: KycIdType;
    fullName: string;
    idNumber: string;
    frontPhoto?: string;
    backPhoto?: string;
    submittedMinutesAgo: number;
  };
  rejection?: { reason: KycRejectReason; note: string };
}

/** One store as the super admin sees it (screen 12). */
export interface MockAdminStore {
  id: string;
  nameKm: string;
  nameEn: string;
  ownerName: string;
  telegramUsername: string;
  businessType: BusinessType;
  plan: PlanId;
  status: SubscriptionStatus;
  daysLeft: number;
  kycStatus: MockKycStatus;
  kyc?: MockKycRecord;
  productCount: number;
  joinedDaysAgo: number;
}

// Fictional example stores covering every plan, status, KYC state and business type.
// The admin panel also shows the demo store you run in the merchant
// dashboard, linked live to its subscription.
export const mockAdminStores: MockAdminStore[] = [
  { id: "s-queen-bee", nameKm: "ហាងឃ្វីនប៊ី", nameEn: "Queen Bee Fashion", ownerName: "Srey Pov", telegramUsername: "queenbee_kh", businessType: "shop", plan: "pro", status: "active", daysLeft: 12, kycStatus: "approved", productCount: 64, joinedDaysAgo: 120 },
  { id: "s-pp-mart", nameKm: "ភ្នំពេញម៉ាត", nameEn: "Phnom Penh Mart", ownerName: "Vuthy Lim", telegramUsername: "ppmart_owner", businessType: "shop", plan: "advance", status: "active", daysLeft: 21, kycStatus: "approved", productCount: 412, joinedDaysAgo: 210 },
  { id: "s-lucky-noodle", nameKm: "គុយទាវឡាក់គី", nameEn: "Lucky Noodle House", ownerName: "Chenda Ouk", telegramUsername: "luckynoodle", businessType: "restaurant", plan: "basic", status: "grace", daysLeft: 3, kycStatus: "approved", productCount: 18, joinedDaysAgo: 95 },
  { id: "s-bright-smile", nameKm: "ហាងកាត់សក់ប្រាយស្មាយ", nameEn: "Bright Smile Salon", ownerName: "Nary Heng", telegramUsername: "brightsmile_pp", businessType: "service", plan: "basic", status: "active", daysLeft: 5, kycStatus: "approved", productCount: 9, joinedDaysAgo: 60 },
  { id: "s-mekong-repair", nameKm: "ជួសជុលទូរស័ព្ទមេគង្គ", nameEn: "Mekong Phone Repair", ownerName: "Rotha San", telegramUsername: "mekongfix", businessType: "service", plan: "free", status: "trialing", daysLeft: 11, kycStatus: "pending", kyc: { submission: { idType: "national_id", fullName: "San Rotha", idNumber: "010234567", submittedMinutesAgo: 4200 } }, productCount: 4, joinedDaysAgo: 3 },
  { id: "s-kampot-pepper", nameKm: "ម្រេចកំពត", nameEn: "Kampot Pepper Shop", ownerName: "Sophal Keo", telegramUsername: "kampotpepper", businessType: "shop", plan: "pro", status: "paused", daysLeft: 0, kycStatus: "approved", productCount: 23, joinedDaysAgo: 150 },
  { id: "s-angkor-bakery", nameKm: "នំអង្គរ", nameEn: "Angkor Bakery", ownerName: "Dalin Chea", telegramUsername: "angkorbakery", businessType: "restaurant", plan: "free", status: "trialing", daysLeft: 2, kycStatus: "pending", kyc: { submission: { idType: "passport", fullName: "Chea Dalin", idNumber: "N0845123", submittedMinutesAgo: 16000 } }, productCount: 7, joinedDaysAgo: 12 },
  { id: "s-siem-reap-crafts", nameKm: "សិប្បកម្មសៀមរាប", nameEn: "Siem Reap Crafts", ownerName: "Bunthoeun Pich", telegramUsername: "srcrafts", businessType: "other", plan: "free", status: "paused", daysLeft: 0, kycStatus: "not_submitted", productCount: 10, joinedDaysAgo: 20 },
];

// Platform health for the admin overview. Stands in for the Bakong token
// renewal job; payments and failed checks are counted from mock-admin-billing.ts.
export const mockPlatformHealth = {
  bakongTokenDaysLeft: 23,
};

export interface MockMerchant {
  firstName: string;
  lastName: string;
  telegramUsername: string;
}

export interface MockDailyStat {
  /** 0 = today, 1 = yesterday, etc. */
  daysAgo: number;
  orders: number;
  revenueUsdCents: number;
}

// A deterministic 30-day trend (no Math.random — that would render
// differently on the server vs. the client and break hydration) for the
// dashboard's date-filtered chart — stands in for a real daily rollup query.
// 60 days, so "last 30 days" can be compared with the 30 before (the sales overview).
export const mockDailyStats: MockDailyStat[] = Array.from({ length: 60 }, (_, i) => {
  const daysAgo = 59 - i;
  const wave = 6 + Math.round(3 * Math.sin(daysAgo / 3));
  const weekendBoost = daysAgo % 7 < 2 ? 2 : 0;
  const orders = Math.max(1, wave + weekendBoost);
  const revenueUsdCents = orders * 650 + (daysAgo % 5) * 80;
  return { daysAgo, orders, revenueUsdCents };
});

// The person who owns the store below — separate from mockStore, matching
// the merchants/stores split in docs/blueprint.md's schema.
export const mockMerchant: MockMerchant = {
  firstName: "Sokha",
  lastName: "Chan",
  telegramUsername: "sokha_coffee_owner",
};

export const mockStore: MockStore = {
  slug: "sokha-coffee",
  nameKm: "កាហ្វេសុខា",
  nameEn: "Sokha Coffee",
  bannerColor: "bg-gradient-to-br from-amber-300 to-orange-400",
  phone: "85512345678",
};

/**
 * What the sample seller wrote under "On your invoices" (design/screens.md
 * S10), shown on the invoice mockup (B7).
 */
export const mockInvoiceDetails: InvoiceDetails = {
  taxNumber: "K009-901234567",
  telegramLink: "t.me/sokhacoffee",
  facebookLink: "fb.com/sokhacoffee",
  invoiceNote: "សូមអរគុណ! អាចប្តូរទំនិញបានក្នុងរយៈពេល 3 ថ្ងៃ ដោយភ្ជាប់បង្កាន់ដៃនេះ។",
};

/** A stand-in tracking code: 8 characters made from the order number, the same every time for one order. */
export function mockTrackingCode(orderNumber: string): string {
  let hash = 2166136261;
  let code = "";
  for (let i = 0; i < TRACKING_CODE_LENGTH; i++) {
    for (const char of `${orderNumber}:${i}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    code += TRACKING_CODE_ALPHABET[hash % TRACKING_CODE_ALPHABET.length];
  }
  return code;
}

export const mockProducts: MockProduct[] = [
  {
    id: "p1",
    categoryId: "drinks",
    brandId: "own-brand",
    uomId: "cup",
    titleKm: "កាហ្វេទឹកកក",
    titleEn: "Iced Coffee",
    descriptionKm: "កាហ្វេខ្មែរឆុងថ្មីៗ ជាមួយទឹកដោះគោខាប់ និងទឹកកក។ អាចប្រាប់កម្រិតផ្អែមនៅក្នុងកំណត់ចំណាំពេលបញ្ជាទិញ។",
    descriptionEn: "Freshly brewed Khmer coffee with condensed milk over ice. Tell us how sweet you like it in the order note.",
    photoColor: "bg-amber-200",
    discountPercent: 15,
    variants: [
      { id: "p1-s", sku: "ICE-COF-S", labelKm: "តូច", labelEn: "Small", retailPriceUsdCents: 125, retailPriceKhr: 5125 },
      { id: "p1-m", sku: "ICE-COF-M", labelKm: "មធ្យម", labelEn: "Medium", retailPriceUsdCents: 150, retailPriceKhr: 6150 },
      { id: "p1-l", sku: "ICE-COF-L", labelKm: "ធំ", labelEn: "Large", retailPriceUsdCents: 175, retailPriceKhr: 7150 },
    ],
  },
  {
    id: "p2",
    categoryId: "drinks",
    brandId: "own-brand",
    uomId: "cup",
    titleKm: "កាហ្វេទឹកដោះគោ",
    titleEn: "Iced Latte",
    descriptionKm: "អេសប្រេសូពីរស៊ុត ជាមួយទឹកដោះគោស្រស់ត្រជាក់។",
    descriptionEn: "A double shot of espresso with cold fresh milk.",
    photoColor: "bg-amber-300",
    retailPriceUsdCents: 200,
    retailPriceKhr: 8200,
  },
  {
    id: "p3",
    categoryId: "drinks",
    uomId: "cup",
    titleKm: "តែទឹកដោះគោ",
    titleEn: "Milk Tea",
    photoColor: "bg-orange-200",
    retailPriceUsdCents: 175,
    retailPriceKhr: 7150,
  },
  {
    id: "p4",
    categoryId: "bakery",
    uomId: "piece",
    titleKm: "ខូគីសូកូឡា",
    titleEn: "Chocolate Cookie",
    photoColor: "bg-yellow-800/30",
    retailPriceUsdCents: 100,
  },
  {
    id: "p5",
    categoryId: "bakery",
    uomId: "piece",
    titleKm: "ក្រូឆ្សង់",
    titleEn: "Croissant",
    descriptionKm: "ដុតថ្មីរៀងរាល់ព្រឹក ដោយប្រើប៊ឺសុទ្ធ។\nល្អបំផុតពេលញ៉ាំក្តៅៗ។",
    descriptionEn: "Baked fresh every morning with real butter.\nBest eaten warm.",
    photoColor: "bg-yellow-200",
    retailPriceUsdCents: 125,
    retailPriceKhr: 5150,
    discountPercent: 10,
  },
  {
    id: "p6",
    categoryId: "drinks",
    uomId: "cup",
    titleKm: "ទឹកម្សៅម្រះ",
    titleEn: "Lemonade",
    photoColor: "bg-lime-200",
    retailPriceKhr: 6000,
  },
];
