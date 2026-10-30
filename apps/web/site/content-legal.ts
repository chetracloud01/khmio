import type { LocalizedText, SitePage } from "@khmio/shared";
import { startFree } from "./content-parts";

// Help, the terms and the privacy policy (docs/blueprint.md "Launch
// checklist"). The terms and the privacy policy are DRAFTS until an advisor
// in Cambodia has checked them: their "draft" mark shows on the page, and the
// operator is a placeholder until the company is registered. Every fact here
// must match what the system really does (what it stores, where, for how
// long) — change the text when the system changes. Khmer text: to be checked
// by a native reader before it goes live.

/** Who runs Khmio: filled in once the company is registered. */
const OPERATOR: LocalizedText = { km: "[ឈ្មោះក្រុមហ៊ុន កំពុងរង់ចាំការចុះបញ្ជី]", en: "[Company name, pending registration]" };
const SUPPORT = "t.me/khmio_support";
const UPDATED_ON = "2026-10-28";

const contactSupport = { label: { km: "សរសេរមកយើងនៅលើ Telegram", en: "Write to us on Telegram" }, href: `https://${SUPPORT}` };

export const helpPage: SitePage = {
  slug: "help",
  seo: {
    title: { km: "ជំនួយ Khmio — សំណួរញឹកញាប់", en: "Khmio help — common questions" },
    description: { km: "របៀបចាប់ផ្តើម បន្ថែមទំនិញ ទទួលការបញ្ជាទិញ និងទាក់ទងយើង។", en: "How to start, add products, get orders and reach us." },
  },
  sections: [
    {
      id: "questions",
      type: "questions",
      visible: true,
      title: { km: "តើយើងអាចជួយអ្វីបាន?", en: "How can we help?" },
      items: [
        {
          question: { km: "តើខ្ញុំចាប់ផ្តើមយ៉ាងដូចម្តេច?", en: "How do I start?" },
          answer: {
            km: "ចុច «ចាប់ផ្តើមឥតគិតថ្លៃ» ចូលជាមួយ Telegram ជ្រើសប្រភេទអាជីវកម្ម ហើយដាក់ឈ្មោះហាង។ បញ្ជីការងារនៅលើទំព័រដើមណែនាំអ្នកពីជំហានបន្ទាប់។",
            en: "Tap \"Start free\", sign in with Telegram, pick your kind of business and name your shop. The checklist on your home page shows the next steps.",
          },
        },
        {
          question: { km: "តើខ្ញុំបន្ថែមទំនិញ ឬសេវាកម្មយ៉ាងដូចម្តេច?", en: "How do I add a product or a service?" },
          answer: {
            km: "ទំនិញ › បន្ថែម៖ ឈ្មោះ តម្លៃ (ដុល្លារ រៀល ឬទាំងពីរ) និងរូបថតរហូតដល់ ៦។ ទំហំ ពណ៌ ឬជម្រើសបន្ថែម អាចបើកនៅក្នុង «មុខងារសម្រាប់អាជីវកម្មខ្ញុំ»។",
            en: "Products › Add: a name, a price (dollars, riel or both) and up to 6 photos. Sizes, colours or add-ons can be switched on in \"Features for my business\".",
          },
        },
        {
          question: { km: "តើអតិថិជនបញ្ជាទិញយ៉ាងដូចម្តេច?", en: "How do customers order?" },
          answer: {
            km: "ចែករំលែកតំណហាងរបស់អ្នក (ទំព័រដើម › ចែករំលែក)។ អតិថិជនដាក់ទំនិញក្នុងកន្ត្រក ហើយបញ្ជាទិញដោយឈ្មោះ និងលេខទូរស័ព្ទ — មិនចាំបាច់បង្កើតគណនីទេ។",
            en: "Share your shop link (Home › Share). Customers fill a cart and order with their name and phone — no account needed.",
          },
        },
        {
          question: { km: "តើខ្ញុំទទួលដំណឹងការបញ្ជាទិញនៅលើ Telegram យ៉ាងដូចម្តេច?", en: "How do I get order alerts on Telegram?" },
          answer: {
            km: "ហាងរបស់ខ្ញុំ › ដំណឹង Telegram។ អ្នកក៏អាចបន្ថែម bot ទៅក្រុមបុគ្គលិករបស់អ្នក ដើម្បីឲ្យក្រុមទាំងមូលទទួលបាន។",
            en: "My shop › Telegram alerts. You can also add the bot to your staff group so the whole team gets them.",
          },
        },
        {
          question: { km: "តើអតិថិជនបង់ប្រាក់យ៉ាងដូចម្តេច?", en: "How do customers pay?" },
          answer: {
            km: "សាច់ប្រាក់ពេលទទួលទំនិញ ឬនៅហាង ឬ QR ផ្ទាល់របស់ហាងអ្នក។ KHQR ដែលពិនិត្យដោយស្វ័យប្រវត្តិ មកដល់ឆាប់ៗ។ លុយចូលគណនីរបស់អ្នកផ្ទាល់ជានិច្ច។",
            en: "Cash on delivery or at your counter, or your shop's own QR. KHQR that checks itself is coming soon. The money always goes to your own account.",
          },
        },
        {
          question: { km: "តើខ្ញុំបោះពុម្ពបង្កាន់ដៃយ៉ាងដូចម្តេច?", en: "How do I print a receipt?" },
          answer: {
            km: "បើកការបញ្ជាទិញ › វិក្កយបត្រ៖ បោះពុម្ព (A4 ឬ 80 mm) ឬចែករំលែកជារូបភាព ឬ PDF។",
            en: "Open the order › Invoice: print it (A4 or 80 mm) or share it as a picture or PDF.",
          },
        },
        {
          question: { km: "តើតម្លៃប៉ុន្មាន?", en: "How much does it cost?" },
          answer: {
            km: "ឥតគិតថ្លៃក្នុងអំឡុងពេលបេតា។ ក្រោយមក វិក្កយបត្រ KHQR មួយក្នុងមួយខែ — មើលទំព័រតម្លៃ។ គ្មានអ្វីត្រូវបានកាត់ដោយស្វ័យប្រវត្តិទេ។",
            en: "Free during the beta. Later, one KHQR bill a month — see the pricing page. Nothing is ever charged automatically.",
          },
        },
        {
          question: { km: "ខ្ញុំត្រូវការជំនួយបន្ថែម", en: "I need more help" },
          answer: {
            km: `សរសេរមកយើងនៅលើ Telegram (${SUPPORT}) ជាភាសាខ្មែរ ឬអង់គ្លេស។`,
            en: `Write to us on Telegram (${SUPPORT}) in Khmer or English.`,
          },
        },
      ],
    },
    {
      id: "closing",
      type: "closing",
      visible: true,
      headline: { km: "នៅតែមានសំណួរ?", en: "Still have a question?" },
      line: { km: "យើងឆ្លើយជាភាសាខ្មែរ ឬអង់គ្លេស។", en: "We answer in Khmer or English." },
      button: contactSupport,
    },
  ],
};

export const privacyPage: SitePage = {
  slug: "privacy",
  seo: {
    title: { km: "គោលការណ៍ឯកជនភាព Khmio", en: "Khmio privacy policy" },
    description: { km: "ព័ត៌មានដែល Khmio រក្សាទុក មូលហេតុ ទីកន្លែង និងរយៈពេល។", en: "What Khmio keeps, why, where and for how long." },
  },
  sections: [
    {
      id: "privacy",
      type: "document",
      visible: true,
      title: { km: "គោលការណ៍ឯកជនភាព", en: "Privacy policy" },
      updatedOn: UPDATED_ON,
      draft: true,
      intro: {
        km: `Khmio ដំណើរការដោយ ${OPERATOR.km}។ ទំព័រនេះពន្យល់ជាភាសាសាមញ្ញថា យើងរក្សាទុកព័ត៌មានអ្វីខ្លះ ហេតុអ្វី ទីណា និងរយៈពេលប៉ុន្មាន។`,
        en: `Khmio is run by ${OPERATOR.en}. This page explains, in plain words, what we keep, why, where and for how long.`,
      },
      parts: [
        {
          heading: { km: "ព័ត៌មានរបស់អ្នកលក់", en: "What we keep about sellers" },
          paragraphs: [
            {
              km: "លេខសម្គាល់ Telegram ឈ្មោះ និងឈ្មោះអ្នកប្រើ Telegram ដែលអ្នកប្រើដើម្បីចូល។ ព័ត៌មានហាង៖ ឈ្មោះ លេខទូរស័ព្ទ អាសយដ្ឋាន តំណផែនទី ឡូហ្គោ QR ការបង់ប្រាក់ ទំនិញ រូបថត តម្លៃ និងស្តុក។",
              en: "The Telegram ID, name and username you sign in with. Your shop's details: name, phone, address, map link, logo, payment QR, products, photos, prices and stock.",
            },
          ],
        },
        {
          heading: { km: "ព័ត៌មានរបស់អតិថិជន", en: "What we keep about customers" },
          paragraphs: [
            {
              km: "នៅពេលអតិថិជនបញ្ជាទិញ៖ ឈ្មោះ លេខទូរស័ព្ទ តំបន់ដឹកជញ្ជូន ចំណុចសម្គាល់ និងការបញ្ជាទិញ។ លេខសម្គាល់ Telegram តែនៅពេលពួកគេជ្រើសទទួលដំណឹងនៅលើ Telegram ប៉ុណ្ណោះ។ អតិថិជនមិនចាំបាច់បង្កើតគណនីទេ។",
              en: "When a customer orders: their name, phone, delivery area, landmark and the order. Their Telegram ID only if they choose to get updates on Telegram. Customers never need an account.",
            },
            {
              km: "ហាងនីមួយៗឃើញតែអតិថិជន និងការបញ្ជាទិញរបស់ខ្លួនប៉ុណ្ណោះ — ទិន្នន័យដាច់ដោយឡែកពីគ្នា នៅក្នុងមូលដ្ឋានទិន្នន័យ។",
              en: "Each shop sees only its own customers and orders — the database keeps every shop's data apart.",
            },
          ],
        },
        {
          heading: { km: "ហេតុអ្វីយើងរក្សាទុកវា", en: "Why we keep it" },
          paragraphs: [
            {
              km: "ដើម្បីដំណើរការហាងរបស់អ្នក៖ បង្ហាញទំនិញ ទទួល និងដឹកការបញ្ជាទិញ ផ្ញើដំណឹង និងបង្កាន់ដៃ។ យើងមិនលក់ព័ត៌មានរបស់អ្នក ឬរបស់អតិថិជនអ្នក ហើយមិនប្រើវាសម្រាប់ការផ្សាយពាណិជ្ជកម្មទេ។",
              en: "To run your shop: show products, take and deliver orders, send alerts and receipts. We never sell your data or your customers' data, and never use it for advertising.",
            },
          ],
        },
        {
          heading: { km: "លុយ", en: "Money" },
          paragraphs: [
            {
              km: "អតិថិជនបង់ប្រាក់ដោយផ្ទាល់ទៅអ្នកលក់ — ជាសាច់ប្រាក់ ឬចូលគណនីធនាគាររបស់អ្នកលក់។ Khmio មិនកាន់លុយរបស់អ្នកទេ ហើយមិនរក្សាទុកព័ត៌មានកាតធនាគារទេ។",
              en: "Customers pay the seller directly — in cash or into the seller's own bank account. Khmio never holds your money and never keeps card details.",
            },
          ],
        },
        {
          heading: { km: "ទីកន្លែង និងរយៈពេល", en: "Where, and for how long" },
          paragraphs: [
            {
              km: "ទិន្នន័យស្ថិតនៅលើម៉ាស៊ីនមេនៅសិង្ហបុរី (Railway) រូបថតនៅលើ Cloudflare R2 ហើយគេហទំព័រដំណើរការដោយ Vercel។ ការបម្រុងទុករៀងរាល់យប់ត្រូវបានរក្សាទុក ១៤ ថ្ងៃ។ កំណត់ត្រាប្រព័ន្ធមិនដែលរក្សាទុកលេខទូរស័ព្ទ ឬពាក្យសម្ងាត់ទេ។",
              en: "Data is kept on servers in Singapore (Railway), photos on Cloudflare R2, and the website runs on Vercel. Nightly backups are kept for 14 days. System logs never hold phone numbers or secrets.",
            },
            {
              km: "នៅពេលអ្នកឈប់បង់ប្រាក់ ឬប្តូរគម្រោង ទិន្នន័យរបស់អ្នកត្រូវបានចាក់សោ មិនលុបទេ ដូច្នេះអ្នកអាចត្រឡប់មកវិញបាន។",
              en: "If you stop paying or change plan, your data is locked, not deleted, so you can come back.",
            },
          ],
        },
        {
          heading: { km: "ខូគី និងទូរស័ព្ទរបស់អ្នក", en: "Cookies and your phone" },
          paragraphs: [
            {
              km: "ខូគីមួយរក្សាអ្នកលក់ឲ្យនៅតែចូល។ កន្ត្រក និងសេចក្តីព្រាងត្រូវបានរក្សាទុកនៅលើទូរស័ព្ទរបស់អ្នក។ ការពិនិត្យថាអ្នកមិនមែនជារ៉ូបូត (Cloudflare Turnstile) ដំណើរការនៅពេលទូទាត់។ យើងមិនប្រើខូគីតាមដាន ឬផ្សាយពាណិជ្ជកម្មទេ។",
              en: "One cookie keeps a seller signed in. Carts and drafts are kept on your own phone. A check that you're not a robot (Cloudflare Turnstile) runs at checkout. We use no tracking or advertising cookies.",
            },
          ],
        },
        {
          heading: { km: "សិទ្ធិរបស់អ្នក", en: "Your rights" },
          paragraphs: [
            {
              km: `អ្នកអាចសុំមើល កែ ឬលុបព័ត៌មានរបស់អ្នក ឬរបស់អតិថិជនម្នាក់ពីហាងរបស់អ្នក។ សរសេរមកយើងនៅលើ Telegram (${SUPPORT}) — យើងឆ្លើយក្នុងរយៈពេល ៣០ ថ្ងៃ លើកលែងតែព័ត៌មានដែលច្បាប់តម្រូវឲ្យរក្សាទុក។`,
              en: `You can ask to see, correct or delete your data, or a customer's data from your shop. Write to us on Telegram (${SUPPORT}) — we answer within 30 days, except for what the law requires us to keep.`,
            },
          ],
        },
        {
          heading: { km: "ការផ្លាស់ប្តូរ", en: "Changes" },
          paragraphs: [
            {
              km: "នៅពេលគោលការណ៍នេះផ្លាស់ប្តូរ យើងប្តូរកាលបរិច្ឆេទខាងលើ ហើយប្រាប់អ្នកលក់នៅលើ Telegram ជាមុន។",
              en: "When this policy changes, we change the date above and tell sellers on Telegram beforehand.",
            },
          ],
        },
      ],
    },
  ],
};

export const termsPage: SitePage = {
  slug: "terms",
  seo: {
    title: { km: "លក្ខខណ្ឌប្រើប្រាស់ Khmio", en: "Khmio terms of service" },
    description: { km: "ច្បាប់សម្រាប់ប្រើ Khmio ជាភាសាសាមញ្ញ។", en: "The rules for using Khmio, in plain words." },
  },
  sections: [
    {
      id: "terms",
      type: "document",
      visible: true,
      title: { km: "លក្ខខណ្ឌប្រើប្រាស់", en: "Terms of service" },
      updatedOn: UPDATED_ON,
      draft: true,
      intro: {
        km: `Khmio ជាកម្មវិធីសម្រាប់អាជីវកម្មខ្នាតតូច ដំណើរការដោយ ${OPERATOR.km}។ ដោយប្រើ Khmio អ្នកយល់ព្រមនឹងលក្ខខណ្ឌទាំងនេះ។`,
        en: `Khmio is an app for small businesses, run by ${OPERATOR.en}. By using Khmio you agree to these terms.`,
      },
      parts: [
        {
          heading: { km: "បេតា", en: "The beta" },
          paragraphs: [
            {
              km: "Khmio កំពុងស្ថិតក្នុងបេតា៖ ឥតគិតថ្លៃ ហើយនៅតែកំពុងកែលម្អ។ មុខងារអាចផ្លាស់ប្តូរ ហើយពេលខ្លះអាចមានកំហុស — ប្រាប់យើង ហើយយើងនឹងជួសជុល។",
              en: "Khmio is in beta: free, and still improving. Features may change and things can sometimes go wrong — tell us and we fix them.",
            },
          ],
        },
        {
          heading: { km: "គណនី និងហាងរបស់អ្នក", en: "Your account and shop" },
          paragraphs: [
            {
              km: "អ្នកចូលជាមួយ Telegram ហើយទទួលខុសត្រូវចំពោះអ្វីដែលធ្វើនៅក្នុងគណនីរបស់អ្នក។ គណនីមួយ ហាងមួយ។",
              en: "You sign in with Telegram and are responsible for what happens in your account. One account, one shop.",
            },
            {
              km: "អ្នកទទួលខុសត្រូវចំពោះទំនិញ តម្លៃ ការដឹកជញ្ជូន ពន្ធ និងការអនុញ្ញាតរបស់អ្នក។ ការលក់គឺរវាងអ្នក និងអតិថិជនរបស់អ្នក — Khmio មិនមែនជាអ្នកលក់ទេ។",
              en: "You are responsible for your products, prices, delivery, taxes and permits. A sale is between you and your customer — Khmio is not the seller.",
            },
          ],
        },
        {
          heading: { km: "អ្វីដែលមិនអនុញ្ញាត", en: "What isn't allowed" },
          paragraphs: [
            {
              km: "ទំនិញ ឬសេវាកម្មខុសច្បាប់នៅកម្ពុជា ការបោកប្រាស់ ការក្លែងខ្លួនជាអ្នកដទៃ ឬការរំខានដល់ប្រព័ន្ធ។ យើងអាចផ្អាកហាងដែលធ្វើដូច្នេះ បន្ទាប់ពីប្រាប់ម្ចាស់ហាង លើកលែងតែពេលបន្ទាន់។",
              en: "Goods or services that are illegal in Cambodia, fraud, pretending to be someone else, or harming the system. We may pause a shop that does this, after telling its owner except when it's urgent.",
            },
          ],
        },
        {
          heading: { km: "តម្លៃ", en: "Prices" },
          paragraphs: [
            {
              km: "ក្រោយបេតា គម្រោងនីមួយៗមានតម្លៃប្រចាំខែ ដែលបង្ហាញនៅលើទំព័រតម្លៃ។ អ្នកបង់វិក្កយបត្រ KHQR មួយក្នុងមួយខែ — គ្មានការកាត់លុយដោយស្វ័យប្រវត្តិទេ។ បើមិនបង់ ហាងត្រូវផ្អាកក្រោយពេលអនុគ្រោះ ហើយទិន្នន័យនៅដដែល។ យើងប្រាប់មុន ៣០ ថ្ងៃ មុនពេលតម្លៃផ្លាស់ប្តូរ។",
              en: "After the beta, each plan has a monthly price shown on the pricing page. You pay one KHQR bill a month — nothing is charged automatically. If a bill isn't paid, the shop pauses after a grace period and its data is kept. We give 30 days' notice before a price changes.",
            },
          ],
        },
        {
          heading: { km: "លុយរបស់អ្នក", en: "Your money" },
          paragraphs: [
            {
              km: "អតិថិជនបង់ប្រាក់ដោយផ្ទាល់ទៅអ្នក។ Khmio មិនកាន់ មិនបង្វិល ហើយមិនកាត់ភាគរយពីការលក់របស់អ្នកទេ។",
              en: "Customers pay you directly. Khmio never holds, forwards or takes a cut of your sales.",
            },
          ],
        },
        {
          heading: { km: "ទិន្នន័យរបស់អ្នក", en: "Your data" },
          paragraphs: [
            {
              km: "ទិន្នន័យហាងរបស់អ្នកជារបស់អ្នក។ របៀបដែលយើងរក្សាទុក និងការពារវា មាននៅក្នុងគោលការណ៍ឯកជនភាព។",
              en: "Your shop's data is yours. How we keep and protect it is in the privacy policy.",
            },
          ],
        },
        {
          heading: { km: "ការទទួលខុសត្រូវ", en: "Responsibility" },
          paragraphs: [
            {
              km: "យើងខិតខំឲ្យ Khmio ដំណើរការជានិច្ច និងបម្រុងទុកទិន្នន័យរៀងរាល់យប់ ប៉ុន្តែមិនអាចសន្យាថាគ្មានការរំខានទេ។ យើងមិនទទួលខុសត្រូវចំពោះការខាតបង់ដោយប្រយោល រួមទាំងការលក់ដែលបាត់បង់ ក្នុងកម្រិតដែលច្បាប់អនុញ្ញាត។",
              en: "We work to keep Khmio running and back up the data every night, but can't promise it will never be interrupted. To the extent the law allows, we aren't responsible for indirect losses, including lost sales.",
            },
          ],
        },
        {
          heading: { km: "ការឈប់ប្រើ និងការផ្លាស់ប្តូរ", en: "Stopping and changes" },
          paragraphs: [
            {
              km: `អ្នកអាចឈប់ប្រើពេលណាក៏បាន។ នៅពេលលក្ខខណ្ឌទាំងនេះផ្លាស់ប្តូរ យើងប្តូរកាលបរិច្ឆេទខាងលើ ហើយប្រាប់អ្នកលក់នៅលើ Telegram ជាមុន។ លក្ខខណ្ឌទាំងនេះអនុវត្តតាមច្បាប់នៃព្រះរាជាណាចក្រកម្ពុជា។ សំណួរ៖ ${SUPPORT}។`,
              en: `You can stop any time. When these terms change, we change the date above and tell sellers on Telegram beforehand. These terms follow the law of the Kingdom of Cambodia. Questions: ${SUPPORT}.`,
            },
          ],
        },
      ],
    },
    {
      id: "closing",
      type: "closing",
      visible: true,
      headline: { km: "រួចរាល់ដើម្បីចាប់ផ្តើម?", en: "Ready to start?" },
      line: { km: "ឥតគិតថ្លៃក្នុងអំឡុងពេលបេតា — មិនត្រូវការកាតធនាគារ។", en: "Free during the beta — no card needed." },
      button: startFree,
    },
  ],
};
