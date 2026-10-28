import { solutionPath, type LocalizedText, type SitePage, type SiteSectionOf, type SiteSolutionId } from "@khmio/shared";
import { seePricing, startFree } from "./content-parts";

// The industry pages (design/screens.md "Platform website"; docs/blueprint.md
// "Business roadmap"): the garage's, the most tested, and one beta page per
// other industry — all of those from the same sections: what works today,
// what's still coming, and "Start free". Khmer text: to be checked by a
// native reader before it goes live.

/** What a garage gets today. The first one leads the bento grid. */
const GARAGE_FEATURES: SiteSectionOf<"features">["features"] = [
  {
    icon: "wrench",
    title: { km: "ប័ណ្ណការងារ សម្រាប់រថយន្តនីមួយៗ", en: "A job card for every car" },
    line: {
      km: "កត់ផ្លាកលេខ បញ្ហា និងគីឡូម៉ែត្រ បន្ថែមគ្រឿងបន្លាស់ និងថ្លៃជាង ហើយប្រគល់រថយន្តជាមួយវិក្កយបត្រតែមួយ។",
      en: "Note the plate, the problem and the mileage, add parts and labour, and hand the car back with one bill.",
    },
  },
  {
    icon: "boxes",
    title: { km: "ស្តុកគ្រឿងបន្លាស់", en: "Parts in stock" },
    line: { km: "ប្រេង សំបកកង់ អាគុយ — ដឹងថានៅសល់ប៉ុន្មាន ហើយការលក់នីមួយៗកាត់ចេញដោយស្វ័យប្រវត្តិ (Pro)។", en: "Oil, tyres, batteries — see what's left, and each sale takes it off by itself (Pro)." },
  },
  {
    icon: "users",
    title: { km: "អតិថិជន និងប្រវត្តិ", en: "Customers and history" },
    line: { km: "អតិថិជនម្នាក់ៗ ជាមួយការបញ្ជាទិញ ទឹកប្រាក់ដែលបានចំណាយ និងពេលមកចុងក្រោយ។", en: "Every customer with their orders, what they spent and when they last came." },
  },
  {
    icon: "receipt",
    title: { km: "លក់នៅហាង", en: "Sell at the counter" },
    line: { km: "សាច់ប្រាក់ ឬ QR ផ្ទាល់ខ្លួនរបស់ហាង ជាមួយការអាប់ និងបង្កាន់ដៃ។", en: "Cash or your shop's own QR, with change and a receipt." },
  },
  {
    icon: "chart",
    title: { km: "ប្រាក់ចំណេញពិត", en: "Your real profit" },
    line: { km: "តម្លៃដើមលើទំនិញនីមួយៗ និងរបាយការណ៍ប្រាក់ចំណេញ (Pro)។", en: "A cost on every part, and a profit report (Pro)." },
  },
  {
    icon: "bell",
    title: { km: "ដំណឹង Telegram", en: "Telegram alerts" },
    line: { km: "ការបញ្ជាទិញថ្មីនីមួយៗមកដល់ Telegram របស់អ្នកភ្លាមៗ។", en: "Every new order reaches your Telegram right away." },
  },
];

/** The questions every garage asks. */
const GARAGE_QUESTIONS: SiteSectionOf<"questions">["items"] = [
  {
    question: { km: "តើវាឥតគិតថ្លៃទេ?", en: "Is it free?" },
    answer: {
      km: "ឥតគិតថ្លៃក្នុងអំឡុងពេលបេតា។ ក្រោយមក បង់វិក្កយបត្រ KHQR មួយក្នុងមួយខែ — គ្មានកាត គ្មានការកាត់លុយដោយស្វ័យប្រវត្តិ។",
      en: "Free during the beta. Later, one KHQR bill a month — no card, nothing charged automatically.",
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
  {
    question: { km: "តើវាសម្រាប់ជួសជុលម៉ូតូ ឬលាងរថយន្តដែរទេ?", en: "Is it for motorbike repair or car washes too?" },
    answer: {
      km: "បាទ/ចាស។ ប័ណ្ណការងារដំណើរការសម្រាប់យានយន្តគ្រប់ប្រភេទ ហើយសេវាកម្មដូចជាលាងរថយន្ត ឬប្តូរប្រេង គ្មានស្តុក។",
      en: "Yes. Job cards work for any vehicle, and services like a wash or an oil change need no stock.",
    },
  },
];

const garagePage: SitePage = {
  slug: "solutions/garage",
  seo: {
    title: { km: "Khmio សម្រាប់យានដ្ឋាន — ប័ណ្ណការងារ គ្រឿងបន្លាស់ និងការបង់ប្រាក់", en: "Khmio for garages — job cards, parts and payments" },
    description: {
      km: "ប័ណ្ណការងារសម្រាប់រថយន្តនីមួយៗ ស្តុកគ្រឿងបន្លាស់ អតិថិជន និងការលក់នៅហាង — ពីទូរស័ព្ទរបស់អ្នក។",
      en: "A job card for every car, parts in stock, customers and counter sales — from your phone.",
    },
  },
  sections: [
    {
      id: "hero",
      type: "hero",
      visible: true,
      eyebrow: { km: "យានដ្ឋាន និងជួសជុលរថយន្ត · មានហើយ", en: "Garage & auto repair · Available" },
      headline: { km: "យានដ្ឋានរបស់អ្នក នៅក្នុងហោប៉ៅ", en: "Your whole garage, in your pocket" },
      sentence: {
        km: "ពីរថយន្តចូលដល់រថយន្តចេញ៖ ប័ណ្ណការងារ គ្រឿងបន្លាស់ ថ្លៃជាង វិក្កយបត្រ និងការបង់ប្រាក់ — សម្រាប់ជួសជុលរថយន្ត ម៉ូតូ លាងរថយន្ត និងប្តូរប្រេង។",
        en: "From car in to car out: job cards, parts, labour, the bill and the payment — for car and motorbike repair, car washes and oil changes.",
      },
      art: { kind: "mio", pose: "face" },
      primary: startFree,
      secondary: seePricing,
      highlights: [
        { km: "ប័ណ្ណការងារ #24 · Toyota Camry", en: "Job card #24 · Toyota Camry" },
        { km: "ប្តូរប្រេង · រួចរាល់", en: "Oil change · Done" },
        { km: "សំបកកង់ · នៅសល់ ៦", en: "Tyres · 6 left" },
      ],
    },
    { id: "features", type: "features", visible: true, layout: "bento", title: { km: "អ្វីដែលយានដ្ឋានរបស់អ្នកទទួលបាន", en: "What your garage gets" }, features: GARAGE_FEATURES },
    {
      id: "steps",
      type: "steps",
      visible: true,
      title: { km: "ថ្ងៃមួយនៅយានដ្ឋាន", en: "A day at the garage" },
      steps: [
        {
          icon: "car",
          title: { km: "រថយន្តមកដល់", en: "A car comes in" },
          line: { km: "បើកប័ណ្ណការងារ ជាមួយផ្លាកលេខ និងបញ្ហា។", en: "Open a job card with the plate and the problem." },
        },
        {
          icon: "wrench",
          title: { km: "ជាងធ្វើការ", en: "The work gets done" },
          line: { km: "បន្ថែមគ្រឿងបន្លាស់ និងថ្លៃជាង — ស្តុកកាត់ចេញដោយខ្លួនឯង។", en: "Add parts and labour — the stock comes off by itself." },
        },
        {
          icon: "receipt",
          title: { km: "ប្រគល់ និងទទួលលុយ", en: "Hand over, get paid" },
          line: { km: "វិក្កយបត្រតែមួយ សាច់ប្រាក់ ឬ QR ហើយអតិថិជនចូលក្នុងបញ្ជីរបស់អ្នក។", en: "One bill, cash or QR, and the customer joins your list." },
        },
      ],
    },
    { id: "plans", type: "plans", visible: true, title: { km: "ជ្រើសរើសគម្រោង", en: "Pick a plan" }, highlight: "basic", link: { label: { km: "ប្រៀបធៀបគម្រោងទាំងអស់", en: "Compare all plans" }, href: "/pricing" } },
    { id: "questions", type: "questions", visible: true, title: { km: "សំណួរញឹកញាប់", en: "Questions" }, items: GARAGE_QUESTIONS },
    {
      id: "closing",
      type: "closing",
      visible: true,
      headline: { km: "បើកយានដ្ឋានរបស់អ្នកនៅលើ Khmio ថ្ងៃនេះ", en: "Put your garage on Khmio today" },
      line: { km: "ឥតគិតថ្លៃក្នុងអំឡុងពេលបេតា — មិនត្រូវការកាតធនាគារ។", en: "Free during the beta — no card needed." },
      button: startFree,
    },
  ],
};

interface BetaCopy {
  title: LocalizedText;
  description: LocalizedText;
  headline: LocalizedText;
  sentence: LocalizedText;
  /** What works today, then (last) what's still coming. */
  features: SiteSectionOf<"features">["features"];
}

/** One page for an industry in beta: what works today and what's coming, and "Start free". */
function betaPage(solution: Exclude<SiteSolutionId, "garage">, copy: BetaCopy): SitePage {
  return {
    slug: solutionPath(solution).slice(1),
    seo: { title: copy.title, description: copy.description },
    sections: [
      {
        id: "hero",
        type: "hero",
        visible: true,
        eyebrow: { km: "បេតា · សាកល្បងឥតគិតថ្លៃ", en: "Beta · Free to try" },
        headline: copy.headline,
        sentence: copy.sentence,
        art: { kind: "apps" },
        primary: startFree,
        secondary: seePricing,
      },
      { id: "features", type: "features", visible: true, title: { km: "អ្វីដែលអ្នកទទួលបានថ្ងៃនេះ", en: "What you get today" }, features: copy.features },
      {
        id: "closing",
        type: "closing",
        visible: true,
        headline: { km: "សាកល្បងវាជាមួយអាជីវកម្មរបស់អ្នក", en: "Try it with your business" },
        line: { km: "ឥតគិតថ្លៃក្នុងអំឡុងពេលបេតា។ ប្រាប់យើងពីអ្វីដែលខ្វះ — យើងកំពុងកសាងវាជាមួយអ្នក។", en: "Free during the beta. Tell us what's missing — we're building it with you." },
        button: startFree,
      },
    ],
  };
}

export const SOLUTION_PAGES: Record<SiteSolutionId, SitePage> = {
  garage: garagePage,
  auto_parts: betaPage("auto_parts", {
    title: { km: "Khmio សម្រាប់ហាងគ្រឿងបន្លាស់ (បេតា)", en: "Khmio for auto parts shops (beta)" },
    description: { km: "គ្រឿងបន្លាស់តាមទំហំ និងម៉ូដែល ស្តុក ការលក់អនឡាញ និងនៅហាង។", en: "Parts by size and model, stock, and sales online and at the counter." },
    headline: { km: "ហាងគ្រឿងបន្លាស់ ដែលដឹងស្តុករបស់ខ្លួន", en: "A parts shop that knows its stock" },
    sentence: { km: "គ្រឿងបន្លាស់គ្រប់ទំហំ និងម៉ូដែល ការលក់អនឡាញ និងនៅហាង ហើយស្តុកកាត់ចេញដោយខ្លួនឯង។", en: "Every part by size and model, sold online and at the counter, with stock that keeps itself up to date." },
    features: [
      { icon: "layers", title: { km: "ទំហំ និងម៉ូដែល", en: "Size and fit" }, line: { km: "ជម្រើសនីមួយៗ មានតម្លៃ លេខកូដ និងស្តុកផ្ទាល់ខ្លួន។", en: "Each size or fit with its own price, code and stock." } },
      { icon: "receipt", title: { km: "លក់នៅហាង និងអនឡាញ", en: "Counter and online" }, line: { km: "សាច់ប្រាក់ QR ឬតំណហាង — ការលក់ទាំងអស់ក្នុងបញ្ជីតែមួយ។", en: "Cash, QR or your shop link — every sale in one list." } },
      { icon: "truck", title: { km: "មកដល់ឆាប់ៗ៖ ការទិញចូល", en: "Coming: purchases" }, line: { km: "កត់ការទិញចូល ហើយតម្លៃដើមមធ្យមគណនាដោយខ្លួនឯង។", en: "Record what you buy in, and the average cost works itself out." } },
    ],
  }),
  phone: betaPage("phone", {
    title: { km: "Khmio សម្រាប់ហាងទូរស័ព្ទ (បេតា)", en: "Khmio for phone shops (beta)" },
    description: { km: "IMEI និងការធានាលើទូរស័ព្ទនីមួយៗ ស្តុក និងអតិថិជន។", en: "IMEI and warranty on every phone, stock and customers." },
    headline: { km: "លក់ទូរស័ព្ទ ដោយគ្មានក្រដាស", en: "Sell phones, paper-free" },
    sentence: { km: "IMEI និងការធានានៅលើទូរស័ព្ទនីមួយៗដែលលក់ ហើយរកឃើញវិញភ្លាមៗ។", en: "IMEI and warranty on every phone you sell, found again in seconds." },
    features: [
      { icon: "smartphone", title: { km: "IMEI និងការធានា", en: "IMEI and warranty" }, line: { km: "វាលផ្ទាល់ខ្លួនលើទំនិញនីមួយៗដែលលក់ — នៅលើបង្កាន់ដៃ។", en: "Your own fields on every item sold — on the receipt." } },
      { icon: "users", title: { km: "អតិថិជនត្រឡប់មកវិញ", en: "Customers who return" }, line: { km: "ប្រវត្តិរបស់អតិថិជនម្នាក់ៗ ក្នុងកន្លែងតែមួយ។", en: "Every customer's history in one place." } },
      { icon: "wrench", title: { km: "មកដល់ឆាប់ៗ៖ ការជួសជុល", en: "Coming: repairs" }, line: { km: "ប័ណ្ណជួសជុលសម្រាប់ឧបករណ៍នីមួយៗ។", en: "A repair job card for every device." } },
    ],
  }),
  cafe: betaPage("cafe", {
    title: { km: "Khmio សម្រាប់ហាងកាហ្វេ និងភោជនីយដ្ឋាន (បេតា)", en: "Khmio for cafés and restaurants (beta)" },
    description: { km: "កម្រិតស្ករ និងទឹកកក ជម្រើសបន្ថែម តុ និងផ្ទះបាយ។", en: "Sugar and ice levels, add-ons, tables and the kitchen." },
    headline: { km: "ការកុម្ម៉ង់លឿន ពីតុ ដល់ផ្ទះបាយ", en: "Fast orders, from table to kitchen" },
    sentence: { km: "ស្ករតិច ទឹកកកច្រើន +១ shot — ដាក់នៅលើការកុម្ម៉ង់នីមួយៗ ហើយផ្ទះបាយឃើញភ្លាមៗ។", en: "Less sugar, more ice, +1 shot — on every order, and the kitchen sees it at once." },
    features: [
      { icon: "coffee", title: { km: "ជម្រើស និងបន្ថែម", en: "Choices and add-ons" }, line: { km: "ជ្រើសមួយ ឬច្រើន ជាមួយតម្លៃបន្ថែម។", en: "Pick one or many, with an extra price." } },
      { icon: "utensils", title: { km: "តុ និងផ្ទះបាយ", en: "Tables and kitchen" }, line: { km: "ការកុម្ម៉ង់តាមតុ ហើយសំបុត្រទៅផ្ទះបាយ។", en: "Orders by table, and tickets to the kitchen." } },
      { icon: "boxes", title: { km: "មកដល់ឆាប់ៗ៖ រូបមន្ត", en: "Coming: recipes" }, line: { km: "គ្រឿងផ្សំកាត់ចេញពីស្តុក ពេលលក់ភេសជ្ជៈនីមួយៗ។", en: "Ingredients come off the stock with every drink sold." } },
    ],
  }),
  salon: betaPage("salon", {
    title: { km: "Khmio សម្រាប់សាឡន និងសេវាកម្ម (បេតា)", en: "Khmio for salons and services (beta)" },
    description: { km: "សេវាកម្មគ្មានស្តុក ការកក់ជាមួយពេលវេលា និងដំណឹង Telegram។", en: "Services without stock, bookings with a time, and Telegram alerts." },
    headline: { km: "ការកក់ ដោយមិនបាត់ការហៅទូរស័ព្ទ", en: "Bookings without missed calls" },
    sentence: { km: "អតិថិជនជ្រើសសេវាកម្ម និងពេលវេលាដែលចង់បាន ហើយអ្នកបញ្ជាក់ពីទូរស័ព្ទ។", en: "Customers pick a service and the time they'd like, and you confirm from your phone." },
    features: [
      { icon: "scissors", title: { km: "សេវាកម្ម", en: "Services" }, line: { km: "កាត់សក់ ស្ប៉ា បោកអ៊ុត — គ្មានស្តុក គ្មានការដឹក។", en: "Haircuts, spa, laundry — no stock, no delivery." } },
      { icon: "clock", title: { km: "ពេលវេលាដែលចង់បាន", en: "A preferred time" }, line: { km: "អតិថិជនស្នើពេល ហើយអ្នកបញ្ជាក់។", en: "The customer asks for a time; you confirm it." } },
      { icon: "calendar", title: { km: "មកដល់ឆាប់ៗ៖ ប្រតិទិនបុគ្គលិក", en: "Coming: a staff calendar" }, line: { km: "បុគ្គលិកម្នាក់ៗ និងម៉ោងទំនេររបស់ពួកគេ។", en: "Each staff member and the hours they're free." } },
    ],
  }),
  retail: betaPage("retail", {
    title: { km: "Khmio សម្រាប់ហាងលក់រាយ (បេតា)", en: "Khmio for retail and online sellers (beta)" },
    description: { km: "ទំហំ × ពណ៌ ស្តុក និងតំណហាងសម្រាប់ Facebook និង TikTok។", en: "Size × colour, stock, and a shop link for Facebook and TikTok." },
    headline: { km: "ហាងអនឡាញរបស់អ្នក ក្នុង ១០ នាទី", en: "Your online shop in 10 minutes" },
    sentence: { km: "ចែករំលែកតំណតែមួយ។ អតិថិជនកុម្ម៉ង់ដោយខ្លួនឯង ហើយអ្នកគ្រប់គ្រងការបញ្ជាទិញទាំងអស់ពីទូរស័ព្ទ។", en: "Share one link. Buyers order on their own, and you run every order from your phone." },
    features: [
      { icon: "shirt", title: { km: "ទំហំ × ពណ៌", en: "Size × colour" }, line: { km: "ការផ្សំនីមួយៗ មានតម្លៃ និងស្តុកផ្ទាល់ខ្លួន។", en: "Each combination with its own price and stock." } },
      { icon: "share", title: { km: "តំណហាងតែមួយ", en: "One shop link" }, line: { km: "សម្រាប់ Facebook, TikTok និង Telegram — ជាមួយការដឹកជញ្ជូន។", en: "For Facebook, TikTok and Telegram — with delivery." } },
      { icon: "percent", title: { km: "មកដល់ឆាប់ៗ៖ ការបញ្ចុះតម្លៃ", en: "Coming: discounts" }, line: { km: "លេខកូដបញ្ចុះតម្លៃ ជាមួយកាលបរិច្ឆេទ និងដែនកំណត់។", en: "Promo codes with dates and limits." } },
    ],
  }),
};
