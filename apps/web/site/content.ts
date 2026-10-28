import type { PlatformProductId, SitePage, SiteSolution } from "@khmio/shared";
import { startFree } from "./content-parts";
import type { SitePageKey } from "./pages";
import { SOLUTION_PAGES } from "./solution-pages";

// The platform website's content (design/screens.md "Platform website"):
// what khmio.com shows. Shaped exactly like the content the admin will edit
// (A10–A12) and checked against the site kit's schemas by content.test.ts,
// so moving it into the database (docs/platform-launch-plan.md Stage 3)
// changes only where it comes from. Until then, changing the website's words
// means changing these files. Khmio is the main brand: every part of a small
// business in one app (the app list, site/content-apps.ts), for each kind of
// business (the industries below: the garage the most tested, the others in
// beta — docs/blueprint.md "Garage first").
// Khmer text: to be checked by a native reader before it goes live.

/** The platform's product names (brand names, the same in every language), for sign-ups made for any of them. */
export const PLATFORM_PRODUCT_NAMES: Record<PlatformProductId, string> = { shop: "Khmio Shop", class: "Khmio Class", rent: "Khmio Rent" };

/** Khmio for each kind of business (the Industries), in the order of docs/blueprint.md "Business roadmap". */
export const SITE_SOLUTIONS: SiteSolution[] = [
  {
    id: "garage",
    name: { km: "យានដ្ឋាន និងជួសជុលរថយន្ត", en: "Garage & auto repair" },
    line: {
      km: "ប័ណ្ណការងារសម្រាប់រថយន្តនីមួយៗ គ្រឿងបន្លាស់ និងថ្លៃជាងក្នុងវិក្កយបត្រតែមួយ ស្តុក និងអតិថិជន។",
      en: "A job card for every car, parts and labour on one bill, stock and customers.",
    },
    covers: [
      { km: "ជួសជុលរថយន្ត", en: "Car repair" },
      { km: "ជួសជុលម៉ូតូ", en: "Motorbike repair" },
      { km: "លាងរថយន្ត", en: "Car wash" },
      { km: "សំបកកង់ និងប្រេង", en: "Tyres & oil" },
    ],
    status: "live",
    icon: "wrench",
  },
  {
    id: "auto_parts",
    name: { km: "ហាងគ្រឿងបន្លាស់", en: "Auto parts shop" },
    line: { km: "គ្រឿងបន្លាស់តាមទំហំ និងម៉ូដែល ស្តុក និងការទិញចូលជាមួយតម្លៃដើម។", en: "Parts by size and model, stock, and purchases with their cost." },
    covers: [
      { km: "គ្រឿងបន្លាស់", en: "Spare parts" },
      { km: "គ្រឿងតុបតែង", en: "Accessories" },
      { km: "អាគុយ", en: "Batteries" },
    ],
    status: "beta",
    icon: "car",
  },
  {
    id: "phone",
    name: { km: "ហាងទូរស័ព្ទ និងជួសជុល", en: "Phone shop & repair" },
    line: { km: "IMEI និងការធានាលើទូរស័ព្ទនីមួយៗ និងប័ណ្ណជួសជុលសម្រាប់ឧបករណ៍។", en: "IMEI and warranty on every phone, and repair job cards for devices." },
    covers: [
      { km: "ទូរស័ព្ទ", en: "Phones" },
      { km: "គ្រឿងបន្ថែម", en: "Accessories" },
      { km: "ជួសជុល", en: "Repairs" },
    ],
    status: "beta",
    icon: "smartphone",
  },
  {
    id: "cafe",
    name: { km: "ហាងកាហ្វេ និងភោជនីយដ្ឋាន", en: "Café & restaurant" },
    line: { km: "កម្រិតស្ករ និងទឹកកក ជម្រើសបន្ថែម តុ និងសំបុត្រផ្ទះបាយ។", en: "Sugar and ice levels, add-ons, tables and kitchen tickets." },
    covers: [
      { km: "កាហ្វេ", en: "Café" },
      { km: "តែគុជ", en: "Bubble tea" },
      { km: "ភោជនីយដ្ឋាន", en: "Restaurant" },
    ],
    status: "beta",
    icon: "coffee",
  },
  {
    id: "salon",
    name: { km: "សាឡន និងសេវាកម្ម", en: "Salon & services" },
    line: { km: "ការកក់ជាមួយពេលវេលា សេវាកម្មគ្មានស្តុក និងដំណឹងនៅលើ Telegram។", en: "Bookings with a time, services without stock, and Telegram alerts." },
    covers: [
      { km: "សាឡន", en: "Salon" },
      { km: "កាត់សក់", en: "Barber" },
      { km: "ស្ប៉ា", en: "Spa" },
      { km: "បោកអ៊ុត", en: "Laundry" },
    ],
    status: "beta",
    icon: "scissors",
  },
  {
    id: "retail",
    name: { km: "ហាងលក់រាយ និងអ្នកលក់អនឡាញ", en: "Retail & online sellers" },
    line: { km: "ទំហំ × ពណ៌ ស្តុក និងតំណហាងសម្រាប់ Facebook និង TikTok។", en: "Size × colour, stock, and a shop link for Facebook and TikTok." },
    covers: [
      { km: "សម្លៀកបំពាក់", en: "Clothing" },
      { km: "គ្រឿងសំអាង", en: "Cosmetics" },
      { km: "ហាងទំនិញ", en: "Mini-mart" },
      { km: "អ្នកលក់អនឡាញ", en: "Online sellers" },
    ],
    status: "beta",
    icon: "shirt",
  },
];

const homePage: SitePage = {
  slug: "",
  seo: {
    title: { km: "Khmio — គ្រប់ផ្នែកនៃអាជីវកម្មរបស់អ្នក ក្នុងកម្មវិធីសាមញ្ញមួយ", en: "Khmio — every part of your business, in one simple app" },
    description: {
      km: "លក់អនឡាញ និងនៅហាង ស្តុក អតិថិជន និងប្រាក់ចំណេញ — ពីទូរស័ព្ទ ជាភាសាខ្មែរ ជាមួយ KHQR រៀល និង Telegram។",
      en: "Sell online and in your shop, keep stock, serve customers and see your profit — from your phone, in Khmer, with KHQR, riel and Telegram.",
    },
  },
  sections: [
    {
      id: "hero",
      type: "hero",
      visible: true,
      eyebrow: { km: "សម្រាប់អាជីវកម្មខ្នាតតូចនៅកម្ពុជា", en: "For Cambodia's small businesses" },
      headline: { km: "គ្រប់ផ្នែកនៃអាជីវកម្មរបស់អ្នក ក្នុងកម្មវិធីសាមញ្ញមួយ", en: "Every part of your business, in one simple app" },
      sentence: {
        km: "លក់អនឡាញ និងនៅហាង គ្រប់គ្រងស្តុក បម្រើអតិថិជន និងមើលប្រាក់ចំណេញ — ពីទូរស័ព្ទរបស់អ្នក ជាភាសាខ្មែរ ឬអង់គ្លេស ជាមួយរៀល និងដុល្លារ។",
        en: "Sell online and in your shop, keep stock, serve customers and see your profit — from your phone, in Khmer or English, with riel and dollars.",
      },
      art: { kind: "apps" },
      primary: startFree,
      secondary: { label: { km: "មើលកម្មវិធីទាំងអស់", en: "See all apps" }, href: "#apps" },
      trust: [
        { icon: "language", text: { km: "ខ្មែរ និងអង់គ្លេស", en: "Khmer & English" } },
        { icon: "qr", text: { km: "រៀល ដុល្លារ និង KHQR", en: "Riel, dollars & KHQR" } },
        { icon: "bell", text: { km: "ដំណឹង Telegram", en: "Telegram alerts" } },
        { icon: "shield", text: { km: "ឥតគិតថ្លៃក្នុងពេលបេតា", en: "Free during the beta" } },
      ],
    },
    {
      id: "apps",
      type: "apps",
      visible: true,
      title: { km: "កម្មវិធីមួយ ឧបករណ៍គ្រប់យ៉ាងដែលអ្នកត្រូវការ", en: "One app, every tool you need" },
      intro: {
        km: "បើកតែអ្វីដែលអាជីវកម្មរបស់អ្នកប្រើ។ អ្វីៗទាំងអស់ដំណើរការជាមួយគ្នា នៅលើទូរស័ព្ទរបស់អ្នក។",
        en: "Switch on only what your business uses. Everything works together, on your phone.",
      },
    },
    {
      id: "why",
      type: "comparison",
      visible: true,
      title: { km: "កម្មវិធីអាជីវកម្មធំ ធ្វើឲ្យតូច និងសាមញ្ញ", en: "Big business software, made small and simple" },
      intro: {
        km: "អ្វីៗដែលអ្នកត្រូវការពីប្រព័ន្ធអាជីវកម្ម — ដោយគ្មានថ្លៃខ្ពស់ និងអ្នកប្រឹក្សា។",
        en: "What you need from a business system — without the high cost and the consultants.",
      },
      them: { km: "កម្មវិធីអាជីវកម្មធំៗ", en: "Big business software" },
      us: { km: "Khmio", en: "Khmio" },
      rows: [
        { label: { km: "ការរៀបចំ", en: "Set-up" }, them: { km: "ច្រើនសប្តាហ៍ ជាមួយអ្នកប្រឹក្សា", en: "Weeks, with a consultant" }, us: { km: "ប៉ុន្មាននាទី ពីទូរស័ព្ទរបស់អ្នក", en: "Minutes, from your phone" } },
        { label: { km: "ប្រើលើ", en: "Works on" }, them: { km: "កុំព្យូទ័រជាមុន", en: "A computer first" }, us: { km: "ទូរស័ព្ទជាមុន", en: "Your phone first" } },
        { label: { km: "ភាសា", en: "Language" }, them: { km: "ភាគច្រើនអង់គ្លេស", en: "Mostly English" }, us: { km: "ខ្មែរ និងអង់គ្លេស", en: "Khmer and English" } },
        { label: { km: "ការបង់ប្រាក់", en: "Payments" }, them: { km: "កាត និងធនាគារបរទេស", en: "Cards and foreign banks" }, us: { km: "KHQR សាច់ប្រាក់ រៀល និងដុល្លារ", en: "KHQR, cash, riel and dollars" } },
        { label: { km: "ដំណឹង", en: "Alerts" }, them: { km: "អ៊ីមែល", en: "Email" }, us: { km: "Telegram", en: "Telegram" } },
        { label: { km: "តម្លៃ", en: "Price" }, them: { km: "តាមអ្នកប្រើ តាមកម្មវិធី", en: "Per user, per app" }, us: { km: "តម្លៃតូចមួយក្នុងមួយខែ — ឥតគិតថ្លៃក្នុងពេលបេតា", en: "One small monthly price — free in the beta" } },
      ],
    },
    {
      id: "industries",
      type: "solutions",
      visible: true,
      title: { km: "រៀបចំសម្រាប់អាជីវកម្មរបស់អ្នក", en: "Made for your kind of business" },
      intro: {
        km: "យានដ្ឋានរួចរាល់ហើយ ហើយអាជីវកម្មផ្សេងទៀតកំពុងសាកល្បង — ឥតគិតថ្លៃថ្ងៃនេះ។",
        en: "Garages are ready; the others are in beta — free to try today.",
      },
    },
    {
      id: "steps",
      type: "steps",
      visible: true,
      title: { km: "ចាប់ផ្តើមក្នុង ៣ ជំហាន", en: "Start in 3 steps" },
      steps: [
        {
          icon: "store",
          title: { km: "បើកហាងរបស់អ្នក", en: "Open your shop" },
          line: { km: "ចូលជាមួយ Telegram ជ្រើសប្រភេទអាជីវកម្ម ហើយដាក់ឈ្មោះ។", en: "Sign in with Telegram, pick your kind of business and name it." },
        },
        {
          icon: "boxes",
          title: { km: "បន្ថែមទំនិញ ឬសេវាកម្ម", en: "Add products or services" },
          line: { km: "ពីទូរស័ព្ទរបស់អ្នក ជាមួយរូបថត និងតម្លៃ។", en: "From your phone, with photos and prices." },
        },
        {
          icon: "share",
          title: { km: "លក់ និងទទួលលុយ", en: "Sell and get paid" },
          line: { km: "នៅហាង ឬតាមតំណហាងរបស់អ្នក — ការបញ្ជាទិញនីមួយៗមកដល់ Telegram។", en: "At your counter or through your shop link — every order reaches Telegram." },
        },
      ],
    },
    { id: "plans", type: "plans", visible: true, title: { km: "តម្លៃសាមញ្ញ", en: "Simple prices" }, highlight: "basic", link: { label: { km: "ប្រៀបធៀបគម្រោងទាំងអស់", en: "Compare all plans" }, href: "/pricing" } },
    {
      id: "questions",
      type: "questions",
      visible: true,
      title: { km: "សំណួរញឹកញាប់", en: "Questions" },
      items: [
        {
          question: { km: "តើវាឥតគិតថ្លៃទេ?", en: "Is it free?" },
          answer: {
            km: "ឥតគិតថ្លៃក្នុងអំឡុងពេលបេតា។ ក្រោយមក បង់វិក្កយបត្រ KHQR មួយក្នុងមួយខែ — គ្មានកាត គ្មានការកាត់លុយដោយស្វ័យប្រវត្តិ។",
            en: "Free during the beta. Later, one KHQR bill a month — no card, nothing charged automatically.",
          },
        },
        {
          question: { km: "តើវាសម្រាប់អាជីវកម្មប្រភេទណា?", en: "Which businesses is it for?" },
          answer: {
            km: "យានដ្ឋាន ហាងគ្រឿងបន្លាស់ ហាងទូរស័ព្ទ ហាងកាហ្វេ សាឡន និងហាងលក់រាយ។ យានដ្ឋានត្រូវបានសាកល្បងច្រើនជាងគេ ហើយផ្សេងទៀតកំពុងសាកល្បងជាមួយអ្នកលក់ពិត។",
            en: "Garages, auto parts and phone shops, cafés, salons and retail. Garages are the most tested; the others are in beta with real sellers.",
          },
        },
        {
          question: { km: "តើខ្ញុំត្រូវការកុំព្យូទ័រទេ?", en: "Do I need a computer?" },
          answer: { km: "ទេ។ អ្វីៗទាំងអស់ដំណើរការលើទូរស័ព្ទ។ កុំព្យូទ័រក៏ប្រើបានដែរ ពេលអ្នកចង់បាន។", en: "No. Everything works on a phone. A computer works too, whenever you want one." },
        },
        {
          question: { km: "តើអតិថិជនបង់ប្រាក់យ៉ាងដូចម្តេច?", en: "How do customers pay?" },
          answer: {
            km: "សាច់ប្រាក់ ឬ QR របស់ហាងអ្នក។ KHQR ដែលពិនិត្យដោយស្វ័យប្រវត្តិ មកដល់ឆាប់ៗ។ លុយចូលគណនីរបស់អ្នកផ្ទាល់ — Khmio មិនកាន់លុយរបស់អ្នកទេ។",
            en: "Cash or your shop's own QR. KHQR that checks itself is coming soon. The money goes to your own account — Khmio never holds it.",
          },
        },
      ],
    },
    {
      id: "closing",
      type: "closing",
      visible: true,
      headline: { km: "ដំណើរការអាជីវកម្មរបស់អ្នកនៅលើ Khmio", en: "Run your business on Khmio" },
      line: { km: "ឥតគិតថ្លៃក្នុងអំឡុងពេលបេតា — មិនត្រូវការកាតធនាគារ។", en: "Free during the beta — no card needed." },
      button: startFree,
    },
  ],
};

/** Prices are never typed here — the Plans section reads plans.ts. */
const pricingPage: SitePage = {
  slug: "pricing",
  seo: {
    title: { km: "តម្លៃ Khmio — គម្រោងសាមញ្ញ ជាដុល្លារ ឬរៀល", en: "Khmio pricing — simple plans in dollars or riel" },
    description: {
      km: "ឥតគិតថ្លៃក្នុងអំឡុងពេលបេតា។ ក្រោយមក បង់វិក្កយបត្រ KHQR មួយក្នុងមួយខែ គ្មានកាត គ្មានការកាត់លុយដោយស្វ័យប្រវត្តិ។",
      en: "Free during the beta. Later, pay one KHQR bill a month — no card, nothing charged automatically.",
    },
  },
  sections: [
    {
      id: "hero",
      type: "hero",
      visible: true,
      eyebrow: { km: "តម្លៃ", en: "Pricing" },
      headline: { km: "តម្លៃសាមញ្ញ គ្មានការភ្ញាក់ផ្អើល", en: "Simple prices, no surprises" },
      sentence: {
        km: "ឥតគិតថ្លៃក្នុងអំឡុងពេលបេតា។ ក្រោយមក បង់វិក្កយបត្រ KHQR មួយក្នុងមួយខែ — ជាដុល្លារ ឬរៀល។",
        en: "Free during the beta. Later, pay one KHQR bill a month — in dollars or riel.",
      },
      art: { kind: "mio", pose: "coin" },
      primary: startFree,
      trust: [
        { icon: "shield", text: { km: "គ្មានកាតធនាគារ", en: "No card needed" } },
        { icon: "clock", text: { km: "ឈប់ពេលណាក៏បាន", en: "Stop any time" } },
      ],
    },
    { id: "plans", type: "plans", visible: true, title: { km: "គម្រោង Khmio", en: "Khmio plans" }, highlight: "basic", compare: true },
    {
      id: "how-paying-works",
      type: "features",
      visible: true,
      title: { km: "របៀបបង់ប្រាក់", en: "How paying works" },
      features: [
        {
          icon: "qr",
          title: { km: "វិក្កយបត្រ KHQR មួយក្នុងមួយខែ", en: "One KHQR bill a month" },
          line: { km: "វិក្កយបត្ររបស់អ្នកមកដល់ Telegram មុនខែបញ្ចប់។ បង់ជាមួយកម្មវិធីធនាគារណាមួយ។", en: "Your bill arrives on Telegram before the month ends. Pay it with any bank app." },
        },
        {
          icon: "shield",
          title: { km: "គ្មានកាត គ្មានការកាត់លុយដោយស្វ័យប្រវត្តិ", en: "No card, nothing automatic" },
          line: { km: "គ្មានអ្វីត្រូវបានកាត់ដោយគ្មានអ្នកទេ។ មិនត្រូវការកាតធនាគារ។", en: "Nothing is ever charged without you, and no card is needed." },
        },
        {
          icon: "clock",
          title: { km: "ពេលអនុគ្រោះ", en: "A grace period" },
          line: { km: "ភ្លេចបង់? អ្វីៗនៅតែដំណើរការមួយរយៈ ខណៈដែលអ្នកបង់ ហើយ Telegram រំលឹកអ្នក។", en: "Missed a bill? Everything keeps working for a while as you pay, and Telegram reminds you." },
        },
        {
          icon: "boxes",
          title: { km: "ទិន្នន័យរបស់អ្នកនៅដដែល", en: "Your data is kept" },
          line: {
            km: "ប្តូរគម្រោង ឬឈប់ពេលណាក៏បាន។ ទំនិញ និងការបញ្ជាទិញត្រូវបានចាក់សោ មិនលុបទេ ហើយត្រឡប់មកវិញនៅពេលអ្នកត្រឡប់មក។",
            en: "Change plan or stop any time. Your products and orders are locked, never deleted, and come back when you do.",
          },
        },
      ],
    },
    {
      id: "closing",
      type: "closing",
      visible: true,
      headline: { km: "សាកល្បងមុន បង់ក្រោយ", en: "Try it first, pay later" },
      line: { km: "ចាប់ផ្តើមដោយឥតគិតថ្លៃ — មិនត្រូវការកាតធនាគារ។", en: "Start free — no card needed." },
      button: startFree,
    },
  ],
};

/** A picture in the website's picture library (A12). Pages point to it as "library:<id>". */
export interface SitePicture {
  id: string;
  /** The file itself: a path under public/, or a data URL for an upload. */
  file: string;
  alt: { km: string; en: string };
  width: number;
  height: number;
  bytes: number;
  /** ISO time it was added. */
  addedAt: string;
}

/** The picture library: empty until the garage's own pictures are added (A12). */
export const SITE_PICTURES: SitePicture[] = [];

/** Every page of the website, by key (site/pages.ts). */
export const SITE_PAGES: Record<SitePageKey, SitePage> = {
  home: homePage,
  pricing: pricingPage,
  ...SOLUTION_PAGES,
};
