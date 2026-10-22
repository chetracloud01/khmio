import { createSystemDb, type SystemDb } from "@khmio/db";
import {
  applyOrderAction,
  BUSINESS_TYPE_DEFAULTS,
  computeOrderTotal,
  getDeliveryQuote,
  getDispatchRoute,
  getInitialOrderStatus,
  type Currency,
  type DeliverySettings,
  type Fulfilment,
  type OrderAction,
  type OrderStatus,
} from "@khmio/shared";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { findOrCreateTelegramMerchant } from "../auth/accounts";
import { DEV_MERCHANTS } from "../auth/dev-merchants";
import { getEnv } from "../config";
import { detectPhotoType, newPhotoKey } from "../files/photos";
import { createFileStorage } from "../files/storage";
import { newOrderToken } from "../orders/place-order";
import { createStore } from "../stores/create-store";

// pnpm demo:garage [-- --reset | --remove] [--telegram-id <id>] [--photos <folder>]
//
// Makes one complete, made-up garage shop to show a customer: cars, engine
// oil, tyres, batteries, parts, accessories and workshop services, with
// delivery set up and a dozen orders at every stage, so the dashboard has
// real numbers. Development only. The shop belongs to the development login
// "Demo garage" unless --telegram-id gives your own Telegram account.
//
// --reset deletes the demo shop and makes it again; --remove only deletes it.
// --photos <folder> (default sample/garage): <product key>.jpg|png|webp, and
// <key>-2.jpg … <key>-6.jpg for more photos, logo.png for the shop's logo.
// Products without one show none.

const SLUG = "mekong-auto-garage";
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_PHOTOS = 6;
const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

type CategoryKey = (typeof BUSINESS_TYPE_DEFAULTS.garage.categories)[number]["key"];
type UnitKey = "piece" | "litre" | "set" | "vehicle" | "service";

interface Price {
  usd?: number;
  khr?: number;
}
interface DemoOption extends Price {
  km: string;
  en: string;
}
interface DemoProduct {
  key: string;
  category: CategoryKey;
  brand?: string;
  unit: UnitKey;
  km: string;
  en: string;
  descKm: string;
  descEn: string;
  discount?: number;
  /** Either one price, or options each with their own. */
  price?: Price;
  options?: DemoOption[];
}

const usd = (dollars: number): number => Math.round(dollars * 100);

const PRODUCTS: DemoProduct[] = [
  // Cars: priced in dollars, as cars are in Cambodia; riel is converted at checkout.
  {
    key: "toyota-prius-2012",
    category: "cars",
    brand: "Toyota",
    unit: "vehicle",
    km: "Toyota Prius 2012 ហាយប្រ៊ីដ",
    en: "Toyota Prius 2012 Hybrid",
    descKm: "ពណ៌ស • ម៉ាស៊ីន 1.8L ហាយប្រ៊ីដ • ដើរ 98,000 គ.ម • ពន្ធគយរួច • ប្លង់ឈ្មោះផ្ទាល់ • អាគុយហាយប្រ៊ីដពិនិត្យរួច",
    descEn: "White • 1.8L hybrid • 98,000 km • tax paid • title in owner's name • hybrid battery checked",
    price: { usd: usd(14_800) },
  },
  {
    key: "toyota-camry-2018",
    category: "cars",
    brand: "Toyota",
    unit: "vehicle",
    km: "Toyota Camry 2018",
    en: "Toyota Camry 2018",
    descKm: "ម៉ាស៊ីន 2.5L • ដើរ 62,000 គ.ម • កៅអីស្បែក • កាមេរ៉ាថយក្រោយ • ពន្ធគយរួច",
    descEn: "2.5L engine • 62,000 km • leather seats • reversing camera • tax paid",
    options: [
      { km: "LE ពណ៌ប្រាក់", en: "LE, silver", usd: usd(27_900) },
      { km: "SE ពណ៌ខ្មៅ", en: "SE, black", usd: usd(29_500) },
    ],
  },
  {
    key: "lexus-rx350-2016",
    category: "cars",
    brand: "Lexus",
    unit: "vehicle",
    km: "Lexus RX 350 2016",
    en: "Lexus RX 350 2016",
    descKm: "ពណ៌ខ្មៅ • 3.5L V6 • ដើរ 75,000 គ.ម • ដំបូលកញ្ចក់ • ពន្ធគយរួច",
    descEn: "Black • 3.5L V6 • 75,000 km • sunroof • tax paid",
    price: { usd: usd(46_500) },
  },
  {
    key: "ford-ranger-2020",
    category: "cars",
    brand: "Ford",
    unit: "vehicle",
    km: "Ford Ranger Wildtrak 2020",
    en: "Ford Ranger Wildtrak 2020",
    descKm: "ម៉ាស៊ីនម៉ាស៊ូត 2.0L Bi-Turbo • 4x4 • ដើរ 41,000 គ.ម • គម្របធុងក្រោយ",
    descEn: "2.0L Bi-Turbo diesel • 4x4 • 41,000 km • tonneau cover",
    price: { usd: usd(38_900) },
  },
  {
    key: "toyota-highlander-2015",
    category: "cars",
    brand: "Toyota",
    unit: "vehicle",
    km: "Toyota Highlander 2015",
    en: "Toyota Highlander 2015",
    descKm: "7 កៅអី • 3.5L V6 • ដើរ 88,000 គ.ម • ពន្ធគយរួច",
    descEn: "7 seats • 3.5L V6 • 88,000 km • tax paid",
    price: { usd: usd(33_500) },
  },
  {
    key: "hyundai-tucson-2019",
    category: "cars",
    brand: "Hyundai",
    unit: "vehicle",
    km: "Hyundai Tucson 2019",
    en: "Hyundai Tucson 2019",
    descKm: "ពណ៌ក្រហម • 2.0L • ដើរ 54,000 គ.ម • បញ្ចុះតម្លៃខែនេះ",
    descEn: "Red • 2.0L • 54,000 km • this month's offer",
    discount: 5,
    price: { usd: usd(24_800) },
  },

  // Engine oil
  {
    key: "castrol-edge-5w30",
    category: "engine-oil",
    brand: "Castrol",
    unit: "piece",
    km: "ប្រេងម៉ាស៊ីន Castrol EDGE 5W-30",
    en: "Castrol EDGE 5W-30 engine oil",
    descKm: "ប្រេងសំយោគពេញលេញ សម្រាប់ឡានសាំង និងហាយប្រ៊ីដ",
    descEn: "Fully synthetic, for petrol and hybrid cars",
    options: [
      { km: "1 លីត្រ", en: "1 litre", usd: usd(12.5), khr: 51_000 },
      { km: "4 លីត្រ", en: "4 litres", usd: usd(42), khr: 172_000 },
    ],
  },
  {
    key: "shell-helix-hx7",
    category: "engine-oil",
    brand: "Shell",
    unit: "piece",
    km: "ប្រេងម៉ាស៊ីន Shell Helix HX7 10W-40",
    en: "Shell Helix HX7 10W-40 engine oil",
    descKm: "ប្រេងពាក់កណ្តាលសំយោគ សម្រាប់ការប្រើប្រាស់ប្រចាំថ្ងៃ",
    descEn: "Semi-synthetic, for everyday driving",
    options: [
      { km: "1 លីត្រ", en: "1 litre", usd: usd(8.5), khr: 35_000 },
      { km: "4 លីត្រ", en: "4 litres", usd: usd(29), khr: 119_000 },
    ],
  },
  {
    key: "toyota-genuine-0w20",
    category: "engine-oil",
    brand: "Toyota",
    unit: "piece",
    km: "ប្រេងម៉ាស៊ីន Toyota ពិតប្រាកដ 0W-20 (4 លីត្រ)",
    en: "Toyota Genuine 0W-20 engine oil (4 litres)",
    descKm: "ណែនាំសម្រាប់ Prius, Camry ហាយប្រ៊ីដ និង Lexus",
    descEn: "Recommended for Prius, Camry Hybrid and Lexus",
    price: { usd: usd(38), khr: 156_000 },
  },
  {
    key: "engine-oil-by-litre",
    category: "engine-oil",
    unit: "litre",
    km: "ប្រេងម៉ាស៊ីនចាក់ពីធុង (គិតជាលីត្រ)",
    en: "Engine oil from the drum (per litre)",
    descKm: "10W-40 សម្រាប់ឡានដឹកទំនិញ និងឡានចាស់",
    descEn: "10W-40 for trucks and older cars",
    price: { usd: usd(4.5), khr: 18_000 },
  },

  // Tyres
  {
    key: "michelin-primacy-4",
    category: "tyres",
    brand: "Michelin",
    unit: "piece",
    km: "កង់ Michelin Primacy 4",
    en: "Michelin Primacy 4 tyre",
    descKm: "កង់ស្ងាត់ សម្រាប់ឡានតូច • ធានា 2 ឆ្នាំ • តម្លៃក្នុងមួយគ្រាប់",
    descEn: "Quiet tyre for sedans • 2-year warranty • price per tyre",
    options: [
      { km: "195/65R15", en: "195/65R15", usd: usd(98), khr: 402_000 },
      { km: "205/55R16", en: "205/55R16", usd: usd(115), khr: 472_000 },
      { km: "215/60R16", en: "215/60R16", usd: usd(125), khr: 513_000 },
    ],
  },
  {
    key: "bridgestone-dueler-at",
    category: "tyres",
    brand: "Bridgestone",
    unit: "piece",
    km: "កង់ Bridgestone Dueler A/T",
    en: "Bridgestone Dueler A/T tyre",
    descKm: "សម្រាប់ឡានភីកអាប់ និង SUV ផ្លូវក្រាលកៅស៊ូ និងផ្លូវដី",
    descEn: "For pickups and SUVs, on and off road",
    options: [
      { km: "265/65R17", en: "265/65R17", usd: usd(165), khr: 677_000 },
      { km: "265/60R18", en: "265/60R18", usd: usd(185), khr: 759_000 },
    ],
  },
  {
    key: "bridgestone-ecopia-set",
    category: "tyres",
    brand: "Bridgestone",
    unit: "set",
    km: "ឈុតកង់ Bridgestone Ecopia 185/65R15 (4 គ្រាប់)",
    en: "Bridgestone Ecopia 185/65R15, set of 4",
    descKm: "រួមទាំងការដំឡើង និងថ្លឹងកង់ឥតគិតថ្លៃ",
    descEn: "Free fitting and balancing included",
    discount: 10,
    price: { usd: usd(340), khr: 1_394_000 },
  },

  // Batteries
  {
    key: "amaron-hi-life",
    category: "batteries",
    brand: "Amaron",
    unit: "piece",
    km: "អាគុយ Amaron Hi Life",
    en: "Amaron Hi Life battery",
    descKm: "មិនបាច់ថែទាំ • ធានា 12 ខែ • ដំឡើងឥតគិតថ្លៃនៅយានដ្ឋាន",
    descEn: "Maintenance free • 12-month warranty • free fitting at the garage",
    options: [
      { km: "45Ah", en: "45Ah", usd: usd(78), khr: 320_000 },
      { km: "70Ah", en: "70Ah", usd: usd(115), khr: 472_000 },
      { km: "100Ah", en: "100Ah", usd: usd(165), khr: 677_000 },
    ],
  },
  {
    key: "gs-battery",
    category: "batteries",
    brand: "GS",
    unit: "piece",
    km: "អាគុយ GS មិនបាច់ថែទាំ",
    en: "GS maintenance-free battery",
    descKm: "ផលិតនៅជប៉ុន • ធានា 18 ខែ",
    descEn: "Made in Japan • 18-month warranty",
    options: [
      { km: "NS60", en: "NS60", usd: usd(85), khr: 349_000 },
      { km: "N70", en: "N70", usd: usd(120), khr: 492_000 },
    ],
  },

  // Parts
  {
    key: "bosch-wiper-blade",
    category: "parts",
    brand: "Bosch",
    unit: "piece",
    km: "ជ័រជូតកញ្ចក់ Bosch",
    en: "Bosch wiper blade",
    descKm: "ជ័រទន់ ជូតស្អាតពេលភ្លៀង • តម្លៃក្នុងមួយដើម",
    descEn: "Soft rubber, clean wipe in the rain • price per blade",
    options: [
      { km: "16 អ៊ីញ", en: "16 inch", usd: usd(9.5), khr: 39_000 },
      { km: "18 អ៊ីញ", en: "18 inch", usd: usd(10.5), khr: 43_000 },
      { km: "20 អ៊ីញ", en: "20 inch", usd: usd(11.5), khr: 47_000 },
      { km: "24 អ៊ីញ", en: "24 inch", usd: usd(13), khr: 53_000 },
    ],
  },
  {
    key: "toyota-oil-filter",
    category: "parts",
    brand: "Toyota",
    unit: "piece",
    km: "តម្រងប្រេង Toyota ពិតប្រាកដ",
    en: "Toyota Genuine oil filter",
    descKm: "សម្រាប់ Prius, Camry, Corolla",
    descEn: "Fits Prius, Camry, Corolla",
    price: { usd: usd(6.5), khr: 26_000 },
  },
  {
    key: "bosch-brake-pads",
    category: "parts",
    brand: "Bosch",
    unit: "set",
    km: "ឈុតបន្ទះហ្វ្រាំងមុខ Bosch",
    en: "Bosch front brake pads (set)",
    descKm: "ជ្រើសរើសតាមម៉ូដែលឡាន • ដំឡើង 30 នាទី",
    descEn: "Choose your car model • fitted in 30 minutes",
    options: [
      { km: "Prius", en: "Prius", usd: usd(35), khr: 144_000 },
      { km: "Camry", en: "Camry", usd: usd(42), khr: 172_000 },
      { km: "Highlander", en: "Highlander", usd: usd(55), khr: 226_000 },
    ],
  },
  {
    key: "air-filter",
    category: "parts",
    brand: "Bosch",
    unit: "piece",
    km: "តម្រងខ្យល់ម៉ាស៊ីន",
    en: "Engine air filter",
    descKm: "គួរប្តូររៀងរាល់ 20,000 គ.ម",
    descEn: "Change every 20,000 km",
    price: { usd: usd(12), khr: 49_000 },
  },
  {
    key: "ngk-iridium-plug",
    category: "parts",
    brand: "NGK",
    unit: "piece",
    km: "ប៊ូហ្ស៊ី NGK Iridium",
    en: "NGK Iridium spark plug",
    descKm: "ប្រើបាន 100,000 គ.ម • តម្លៃក្នុងមួយដើម",
    descEn: "Lasts 100,000 km • price per plug",
    price: { usd: usd(11), khr: 45_000 },
  },

  // Accessories
  {
    key: "70mai-dash-cam",
    category: "accessories",
    brand: "70mai",
    unit: "piece",
    km: "កាមេរ៉ាឡាន 70mai A500S",
    en: "70mai A500S dash cam",
    descKm: "មុខ និងក្រោយ • GPS • ថតពេលយប់ច្បាស់",
    descEn: "Front and rear • GPS • clear night video",
    price: { usd: usd(89), khr: 365_000 },
  },
  {
    key: "car-perfume",
    category: "accessories",
    unit: "piece",
    km: "ទឹកអប់ឡាន ក្លិនផ្កាម្លិះ",
    en: "Car perfume, jasmine",
    descKm: "ក្លិនស្រាល ប្រើបាន 2 ខែ",
    descEn: "Light scent, lasts 2 months",
    price: { khr: 25_000 },
  },
  {
    key: "floor-mats",
    category: "accessories",
    unit: "set",
    km: "កំរាលឡាន 5D",
    en: "5D car floor mats",
    descKm: "កាត់តាមម៉ូដែលឡាន • លាងទឹកបាន",
    descEn: "Cut to fit your model • washable",
    options: [
      { km: "Prius", en: "Prius", usd: usd(45), khr: 185_000 },
      { km: "Camry", en: "Camry", usd: usd(49), khr: 201_000 },
      { km: "Ford Ranger", en: "Ford Ranger", usd: usd(55), khr: 226_000 },
    ],
  },

  // Workshop services
  {
    key: "oil-change-service",
    category: "services",
    unit: "service",
    km: "សេវាប្តូរប្រេងម៉ាស៊ីន (ឈ្នួល)",
    en: "Oil change (labour)",
    descKm: "ប្រហែល 30 នាទី • ពិនិត្យសម្ពាធកង់ និងទឹកត្រជាក់ឥតគិតថ្លៃ • ប្រេងគិតដាច់ដោយឡែក",
    descEn: "About 30 minutes • free tyre-pressure and coolant check • oil charged separately",
    options: [
      { km: "ឡានតូច", en: "Sedan", usd: usd(10), khr: 41_000 },
      { km: "SUV / ភីកអាប់", en: "SUV / pickup", usd: usd(15), khr: 62_000 },
    ],
  },
  {
    key: "full-car-check",
    category: "services",
    unit: "service",
    km: "ពិនិត្យឡានទូទៅ 40 ចំណុច",
    en: "Full car check, 40 points",
    descKm: "ហ្វ្រាំង ម៉ាស៊ីន ភ្លើង ម៉ាស៊ីនត្រជាក់ និងកង់ • ទទួលរបាយការណ៍តាម Telegram",
    descEn: "Brakes, engine, lights, AC and tyres • report sent on Telegram",
    price: { usd: usd(25), khr: 103_000 },
  },
  {
    key: "car-wash",
    category: "services",
    unit: "service",
    km: "លាងឡាន",
    en: "Car wash",
    descKm: "លាងខាងក្រៅ និងបូមធូលីខាងក្នុង",
    descEn: "Outside wash and inside vacuum",
    options: [
      { km: "លាងធម្មតា", en: "Wash", usd: usd(5), khr: 20_000 },
      { km: "លាង + ក្រេម", en: "Wash + wax", usd: usd(15), khr: 60_000 },
    ],
  },
  {
    key: "ac-service",
    category: "services",
    unit: "service",
    km: "បញ្ចូលហ្គាស និងលាងម៉ាស៊ីនត្រជាក់",
    en: "AC gas refill and clean",
    descKm: "ត្រជាក់ដូចថ្មី • ធានា 3 ខែ",
    descEn: "Cold like new • 3-month warranty",
    price: { usd: usd(35), khr: 144_000 },
  },
  {
    key: "wheel-alignment",
    category: "services",
    unit: "service",
    km: "តម្រង់កង់ និងថ្លឹងកង់",
    en: "Wheel alignment and balancing",
    descKm: "ម៉ាស៊ីនកុំព្យូទ័រ 3D",
    descEn: "3D computer alignment",
    price: { usd: usd(20), khr: 82_000 },
  },
  {
    key: "hybrid-battery-check",
    category: "services",
    unit: "service",
    km: "ពិនិត្យអាគុយហាយប្រ៊ីដ",
    en: "Hybrid battery check",
    descKm: "វាស់កោសិកានីមួយៗ សម្រាប់ Prius និង Camry ហាយប្រ៊ីដ",
    descEn: "Every cell measured, for Prius and Camry Hybrid",
    price: { usd: usd(30), khr: 123_000 },
  },
];

const PICKUP_ADDRESS = "ផ្ទះលេខ 25 ផ្លូវ 271 ទួលគោក ភ្នំពេញ / No. 25, Street 271, Tuol Kouk, Phnom Penh";
const PICKUP_HOURS = "ច័ន្ទ–សៅរ៍ 7:30–17:30 / Mon–Sat 7:30–17:30";

const DELIVERY: DeliverySettings = {
  zones: [
    { id: "near", name: "Near the garage", districtIds: ["tuol-kouk", "daun-penh", "prampir-makara", "boeng-keng-kang", "chamkar-mon", "sen-sok"], feeUsdCents: usd(1.5), feeKhr: 6_000 },
    { id: "far", name: "Further out", districtIds: ["russey-keo", "chroy-changvar", "mean-chey", "chbar-ampov", "pou-senchey", "dangkao"], feeUsdCents: usd(2.5), feeKhr: 10_000 },
  ],
  pickup: { enabled: true, address: PICKUP_ADDRESS, hours: PICKUP_HOURS },
  province: { enabled: false, note: "" },
  drivers: [{ id: "dara", name: "Dara", phone: "85512777888", kind: "own" }],
};

interface DemoOrder {
  buyer: { name: string; phone: string };
  /** Product key, with the option's English label when it has options. */
  lines: { product: string; option?: string; quantity: number }[];
  currency: Currency;
  /** Absent = picked up at the garage. */
  districtId?: string;
  landmark?: string;
  /** Seller steps after the order is placed, in order. */
  actions: OrderAction[];
  hoursAgo: number;
}

const DELIVERED: OrderAction[] = ["confirm", "start_packing", "dispatch", "driver_picked_up", "mark_delivered"];
const PICKED_UP: OrderAction[] = ["confirm", "start_packing", "dispatch", "mark_delivered", "settle_cash"];

const ORDERS: DemoOrder[] = [
  { buyer: { name: "Sokha Chan", phone: "85512456789" }, lines: [{ product: "toyota-prius-2012", quantity: 1 }], currency: "USD", actions: PICKED_UP, hoursAgo: 12 * 24 },
  {
    buyer: { name: "Vanna Kim", phone: "85597123456" },
    lines: [{ product: "oil-change-service", option: "Sedan", quantity: 1 }, { product: "castrol-edge-5w30", option: "4 litres", quantity: 1 }, { product: "toyota-oil-filter", quantity: 1 }],
    currency: "KHR",
    actions: PICKED_UP,
    hoursAgo: 10 * 24,
  },
  {
    buyer: { name: "Dara Meas", phone: "85511223344" },
    lines: [{ product: "michelin-primacy-4", option: "205/55R16", quantity: 4 }, { product: "wheel-alignment", quantity: 1 }],
    currency: "USD",
    actions: PICKED_UP,
    hoursAgo: 8 * 24,
  },
  {
    buyer: { name: "Srey Neang", phone: "85516888999" },
    lines: [{ product: "amaron-hi-life", option: "70Ah", quantity: 1 }],
    currency: "KHR",
    districtId: "chamkar-mon",
    landmark: "Near Aeon Mall 1",
    actions: [...DELIVERED, "settle_cash"],
    hoursAgo: 6 * 24,
  },
  {
    buyer: { name: "Pisey Long", phone: "85570555123" },
    lines: [{ product: "floor-mats", option: "Camry", quantity: 1 }],
    currency: "USD",
    districtId: "boeng-keng-kang",
    actions: ["cancel"],
    hoursAgo: 5 * 24,
  },
  {
    buyer: { name: "Rithy Sam", phone: "85589777666" },
    lines: [{ product: "bosch-wiper-blade", option: "18 inch", quantity: 2 }, { product: "car-perfume", quantity: 2 }],
    currency: "KHR",
    districtId: "sen-sok",
    landmark: "Street 1986, next to the pagoda",
    actions: DELIVERED,
    hoursAgo: 3 * 24,
  },
  { buyer: { name: "Bopha Ly", phone: "85512987654" }, lines: [{ product: "toyota-camry-2018", option: "SE, black", quantity: 1 }], currency: "USD", actions: ["confirm", "start_packing"], hoursAgo: 2 * 24 },
  { buyer: { name: "Chenda Ouk", phone: "85515246810" }, lines: [{ product: "car-wash", option: "Wash + wax", quantity: 1 }], currency: "KHR", actions: ["confirm"], hoursAgo: 26 },
  {
    buyer: { name: "Kosal Heng", phone: "85593321654" },
    lines: [{ product: "70mai-dash-cam", quantity: 1 }],
    currency: "USD",
    districtId: "tuol-kouk",
    landmark: "Toul Kork market, gate 2",
    actions: ["confirm", "start_packing", "dispatch", "driver_picked_up"],
    hoursAgo: 5,
  },
  {
    buyer: { name: "Malis Touch", phone: "85510654321" },
    lines: [{ product: "bosch-brake-pads", option: "Prius", quantity: 1 }],
    currency: "USD",
    districtId: "russey-keo",
    actions: ["confirm", "start_packing", "dispatch"],
    hoursAgo: 3,
  },
  { buyer: { name: "Sophea Nhem", phone: "85577112233" }, lines: [{ product: "full-car-check", quantity: 1 }, { product: "hybrid-battery-check", quantity: 1 }], currency: "USD", actions: [], hoursAgo: 2 },
  { buyer: { name: "Visal Prak", phone: "85581445566" }, lines: [{ product: "ford-ranger-2020", quantity: 1 }], currency: "USD", actions: [], hoursAgo: 0.5 },
];

async function main() {
  const args = process.argv.slice(2);
  const { values } = parseArgs({
    args: args[0] === "--" ? args.slice(1) : args,
    options: { reset: { type: "boolean" }, remove: { type: "boolean" }, "telegram-id": { type: "string" }, photos: { type: "string" } },
  });
  if (process.env.NODE_ENV === "production") fail("demo:garage is for development only.");
  const telegramId = values["telegram-id"]?.trim();
  if (telegramId !== undefined && !/^\d{5,20}$/.test(telegramId)) fail("--telegram-id must be digits.");
  const ownerUrl = process.env.DATABASE_OWNER_URL;
  if (!ownerUrl) fail("DATABASE_OWNER_URL is not set (see .env.example)");

  const db = createSystemDb(ownerUrl);
  try {
    const existing = await db.store.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (existing && !values.reset && !values.remove) fail(`The demo garage already exists. Run with --reset to make it again, or --remove to delete it.`);
    if (existing) {
      await removeStore(db, existing.id);
      process.stdout.write("Demo garage removed.\n");
    }
    if (values.remove) return;

    const owner = telegramId ? { telegramId, firstName: "Garage owner" } : DEV_MERCHANTS.garage;
    const merchantId = await findOrCreateTelegramMerchant(db, owner);
    const created = await createStore(db, merchantId, { businessType: "garage", shopName: "Mekong Auto Garage", slug: SLUG });
    if (!created.ok) {
      fail(created.reason === "already_has_store" ? "That Telegram account already has a shop (one shop per account). Use another --telegram-id." : "The demo link is taken.");
    }
    const { photos, logo } = await loadPhotos(values.photos);
    await fillStore(db, created.storeId, photos, logo);
    const photoCount = [...photos.values()].reduce((sum, list) => sum + list.length, 0);
    process.stdout.write(
      `Demo garage ready: ${PRODUCTS.length} products, ${ORDERS.length} orders, ${photoCount} photos.\n` +
        `  Shop:      /km/s/${SLUG}\n` +
        `  Dashboard: /km/m (log in with ${telegramId ? "your Telegram account" : '"Demo garage" under Development login'})\n`,
    );
  } finally {
    await db.$disconnect();
  }
}

/** Orders first: an order's customer can't be deleted under it (RESTRICT), so the store's cascade would stop there. */
async function removeStore(db: SystemDb, storeId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.order.deleteMany({ where: { storeId } });
    await tx.outboxEvent.deleteMany({ where: { storeId } });
    await tx.store.delete({ where: { id: storeId } });
  });
}

/** Photo files by product key, in display order, and the logo, from the folder (relative to where pnpm was run). */
async function loadPhotos(folder: string | undefined): Promise<{ photos: Map<string, Buffer[]>; logo: Buffer | null }> {
  const dir = resolve(process.env.INIT_CWD ?? process.cwd(), folder ?? "sample/garage");
  const photos = new Map<string, Buffer[]>();
  if (!existsSync(dir)) {
    if (folder) fail(`Photo folder not found: ${dir}`);
    return { photos, logo: null };
  }
  for (const product of PRODUCTS) {
    const list: Buffer[] = [];
    for (let n = 1; n <= MAX_PHOTOS; n++) {
      const base = n === 1 ? product.key : `${product.key}-${n}`;
      const file = PHOTO_EXTENSIONS.map((ext) => join(dir, `${base}.${ext}`)).find((path) => existsSync(path));
      if (file) list.push(await readFile(file));
    }
    if (list.length) photos.set(product.key, list);
  }
  const logoFile = PHOTO_EXTENSIONS.map((ext) => join(dir, `logo.${ext}`)).find((path) => existsSync(path));
  return { photos, logo: logoFile ? await readFile(logoFile) : null };
}

async function fillStore(db: SystemDb, storeId: string, photos: Map<string, Buffer[]>, logo: Buffer | null): Promise<void> {
  const now = Date.now();
  const storage = photos.size || logo ? createFileStorage(getEnv()) : null;
  let logoKey: string | null = null;
  if (logo) {
    const type = detectPhotoType(logo);
    if (!type) fail("The logo is not a JPEG, PNG or WebP");
    logoKey = newPhotoKey(storeId, type);
    await storage!.put(logoKey, logo, type);
  }
  const photoKeys = new Map<string, string[]>();
  for (const [productKey, files] of photos) {
    const keys: string[] = [];
    for (const data of files) {
      const type = detectPhotoType(data);
      if (!type) fail(`Not a JPEG, PNG or WebP: a photo for ${productKey}`);
      const key = newPhotoKey(storeId, type);
      await storage!.put(key, data, type);
      keys.push(key);
    }
    photoKeys.set(productKey, keys);
  }

  await db.$transaction(
    async (tx) => {
      await tx.store.update({
        where: { id: storeId },
        data: {
          phone: "85512345678",
          description:
            "រថយន្តជួញដូរ គ្រឿងបន្លាស់ពិតប្រាកដ និងសេវាជួសជុលគ្រប់ប្រភេទ នៅទួលគោក។\nUsed cars, genuine parts and full workshop services in Tuol Kouk.",
          defaultCurrency: "USD",
          allowCod: true,
          pickupEnabled: DELIVERY.pickup.enabled,
          pickupAddress: DELIVERY.pickup.address,
          pickupHours: DELIVERY.pickup.hours,
          provinceDeliveryEnabled: false,
          deliveryConfiguredAt: new Date(now - 14 * DAY_MS),
          linkSharedAt: new Date(now - 13 * DAY_MS),
          logoKey,
          // "On your invoices" (made up, like the rest of the shop).
          taxNumber: "K001-900112233",
          telegramLink: "t.me/mekongautogarage",
          facebookLink: "fb.com/mekongautogarage",
          invoiceNote:
            "ធានាអាគុយ 12 ខែ និងកង់ 2 ឆ្នាំ។ សេវាជួសជុលធានា 3 ខែ។ សូមរក្សាបង្កាន់ដៃនេះ។\nWarranty: batteries 12 months, tyres 2 years, workshop work 3 months. Please keep this receipt.",
        },
      });
      for (const [index, zone] of DELIVERY.zones.entries()) {
        await tx.deliveryZone.create({
          data: {
            storeId,
            name: zone.name,
            feeUsdCents: zone.feeUsdCents ?? null,
            feeKhr: zone.feeKhr ?? null,
            sortOrder: index,
            districts: { create: zone.districtIds.map((districtId) => ({ storeId, districtId })) },
          },
        });
      }
      const driver = DELIVERY.drivers[0]!;
      const savedDriver = await tx.storeDriver.create({ data: { storeId, name: driver.name, phone: driver.phone, kind: driver.kind } });

      const categories = await tx.category.findMany({ where: { storeId } });
      const categoryId = (key: CategoryKey): string => {
        const name = BUSINESS_TYPE_DEFAULTS.garage.categories.find((category) => category.key === key)!.nameEn;
        return categories.find((category) => category.nameEn === name)!.id;
      };
      const units = await tx.unit.findMany({ where: { storeId } });
      const unitId = (key: UnitKey): string => units.find((unit) => unit.key === key)!.id;
      const brandIds = new Map<string, string>();
      for (const name of new Set(PRODUCTS.flatMap((product) => (product.brand ? [product.brand] : [])))) {
        brandIds.set(name, (await tx.brand.create({ data: { storeId, nameKm: name, nameEn: name } })).id);
      }

      /** Variant rows by product key and option label ("" for a product without options). */
      const variants = new Map<string, { id: string; isDefault: boolean; labelKm: string; labelEn: string; priceUsdCents: number | null; priceKhr: number | null }>();
      for (const [index, product] of PRODUCTS.entries()) {
        const options: (DemoOption & { isDefault: boolean })[] = product.options
          ? product.options.map((option) => ({ ...option, isDefault: false }))
          : [{ km: "", en: "", ...product.price, isDefault: true }];
        const saved = await tx.product.create({
          data: {
            storeId,
            categoryId: categoryId(product.category),
            brandId: product.brand ? brandIds.get(product.brand)! : null,
            unitId: unitId(product.unit),
            titleKm: product.km,
            titleEn: product.en,
            descriptionKm: product.descKm,
            descriptionEn: product.descEn,
            discountPercent: product.discount ?? null,
            // Newest first in the dashboard: the first products here were "added" last.
            createdAt: new Date(now - 14 * DAY_MS + (PRODUCTS.length - index) * 60_000),
            photos: { create: (photoKeys.get(product.key) ?? []).map((fileKey, sortOrder) => ({ storeId, fileKey, sortOrder })) },
          },
        });
        for (const [sortOrder, option] of options.entries()) {
          const sku = (option.isDefault ? product.key : `${product.key}-${option.en}`).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
          const variant = await tx.productVariant.create({
            data: {
              storeId,
              productId: saved.id,
              sku,
              labelKm: option.km,
              labelEn: option.en,
              isDefault: option.isDefault,
              priceUsdCents: option.usd ?? null,
              priceKhr: option.khr ?? null,
              sortOrder,
            },
          });
          variants.set(`${product.key}|${option.en}`, variant);
        }
      }

      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { usdToKhrRate: true, vatPercent: true } });
      const customers = new Map<string, string>();
      for (const [index, demo] of ORDERS.entries()) {
        const placedAt = now - demo.hoursAgo * HOUR_MS;
        const fulfilment: Fulfilment = demo.districtId ? "delivery" : "pickup";
        const facts = { paymentMethod: "cod" as const, fulfilment, area: "phnom_penh" as const };
        const quote = getDeliveryQuote(DELIVERY, { fulfilment, area: "phnom_penh", districtId: demo.districtId });
        if (quote.status !== "ok") fail(`Demo order ${index + 1}: delivery unavailable`);
        const lines = demo.lines.map((line) => {
          const variant = variants.get(`${line.product}|${line.option ?? ""}`);
          if (!variant) fail(`Demo order ${index + 1}: no product ${line.product} ${line.option ?? ""}`);
          const product = PRODUCTS.find((entry) => entry.key === line.product)!;
          return { variant, product, quantity: line.quantity };
        });
        const total = computeOrderTotal({
          lines: lines.map((line) => ({
            key: line.variant.id,
            quantity: line.quantity,
            priceUsdCents: line.variant.priceUsdCents,
            priceKhr: line.variant.priceKhr,
            discountPercent: line.product.discount ?? null,
          })),
          currency: demo.currency,
          usdToKhrRate: store.usdToKhrRate,
          vatPercent: store.vatPercent,
          deliveryFee: quote.fee,
        });

        let customerId = customers.get(demo.buyer.phone);
        if (!customerId) {
          customerId = (
            await tx.customer.create({
              data: { storeId, phone: demo.buyer.phone, name: demo.buyer.name, area: "phnom_penh", districtId: demo.districtId ?? null, landmark: demo.landmark ?? "" },
            })
          ).id;
          customers.set(demo.buyer.phone, customerId);
        }

        // Walk the order through the real status rules, an hour or so between steps.
        const statuses: { status: OrderStatus; at: Date }[] = [{ status: getInitialOrderStatus("cod"), at: new Date(placedAt) }];
        const stepMs = Math.min(3 * HOUR_MS, (demo.hoursAgo * HOUR_MS) / (demo.actions.length + 1));
        for (const action of demo.actions) {
          const previous = statuses[statuses.length - 1]!;
          const next = applyOrderAction({ ...facts, status: previous.status }, action);
          if (!next) fail(`Demo order ${index + 1}: "${action}" isn't allowed after "${previous.status}"`);
          statuses.push({ status: next, at: new Date(previous.at.getTime() + stepMs) });
        }
        const last = statuses[statuses.length - 1]!;

        const order = await tx.order.create({
          data: {
            storeId,
            customerId,
            orderNumber: index + 1,
            publicToken: newOrderToken(),
            status: last.status,
            paymentMethod: "cod",
            currency: demo.currency,
            subtotalMinor: total.subtotal,
            discountMinor: total.discount,
            deliveryFeeMinor: total.deliveryFee,
            vatPercent: store.vatPercent,
            vatMinor: total.vat,
            totalMinor: total.total,
            exchangeRateUsed: store.usdToKhrRate,
            fulfilment,
            area: "phnom_penh",
            districtId: demo.districtId ?? null,
            landmark: demo.landmark ?? "",
            pickupAddress: fulfilment === "pickup" ? PICKUP_ADDRESS : "",
            pickupHours: fulfilment === "pickup" ? PICKUP_HOURS : "",
            buyerName: demo.buyer.name,
            buyerPhone: demo.buyer.phone,
            cancelReason: last.status === "cancelled" ? "buyer_cancelled" : null,
            idempotencyKey: randomUUID(),
            createdAt: new Date(placedAt),
            updatedAt: last.at,
          },
        });
        await tx.orderItem.createMany({
          data: total.lines.map((line, lineIndex) => {
            const { variant, product } = lines[lineIndex]!;
            return {
              storeId,
              orderId: order.id,
              variantId: variant.id,
              titleKm: product.km,
              titleEn: product.en,
              variantLabelKm: variant.isDefault ? "" : variant.labelKm,
              variantLabelEn: variant.isDefault ? "" : variant.labelEn,
              unitPriceMinor: line.unitPrice,
              quantity: line.quantity,
              lineTotalMinor: line.lineTotal,
            };
          }),
        });
        await tx.orderStatusEvent.createMany({
          data: statuses.map((step, stepIndex) => ({ storeId, orderId: order.id, status: step.status, actor: stepIndex === 0 ? ("buyer" as const) : ("merchant" as const), actorMerchantId: null, at: step.at })),
        });
        // Sent orders carry how they left the garage, as the dispatch step records it.
        const dispatched = statuses.find((step) => step.status === "waiting_for_driver" || step.status === "out_for_delivery");
        if (dispatched) {
          const route = getDispatchRoute(facts);
          const pickedUp = statuses.find((step, stepIndex) => step.status === "out_for_delivery" && stepIndex > 0);
          const delivered = statuses.find((step) => step.status === "delivered" || step.status === "completed");
          await tx.deliveryDispatch.create({
            data: {
              storeId,
              orderId: order.id,
              route,
              driverId: route === "driver" ? savedDriver.id : null,
              driverName: route === "driver" ? savedDriver.name : "",
              driverPhone: route === "driver" ? savedDriver.phone : "",
              dispatchedAt: dispatched.at,
              pickedUpAt: route === "driver" ? (pickedUp?.at ?? null) : null,
              deliveredAt: delivered?.at ?? null,
            },
          });
        }
      }
      await tx.store.update({ where: { id: storeId }, data: { lastOrderNumber: ORDERS.length } });
    },
    { timeout: 60_000 },
  );
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

main().catch((error: unknown) => {
  process.stderr.write(`demo:garage failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exit(1);
});
