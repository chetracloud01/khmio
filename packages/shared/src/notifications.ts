import { formatKhr, formatUsd, type Currency } from "./money";
import { PHNOM_PENH_DISTRICTS, PROVINCES } from "./locations";

// The Telegram messages the worker sends (docs/blueprint.md "Workflows from
// start to end", workflow 4). Khmer first, then English, in one message: the
// bot doesn't know which language each seller reads. Never the buyer's phone
// — a Telegram message can be forwarded, and the dashboard has it.

export interface OrderAlertFacts {
  orderNumber: number;
  totalMinor: number;
  currency: Currency;
  paymentMethod: "khqr" | "aba_payway" | "cod";
  fulfilment: "delivery" | "pickup";
  districtId: string | null;
  provinceId: string | null;
  itemCount: number;
  /** As printed, MEK-7K4P-9QXR: the seller can search the orders list by it. */
  trackingCode?: string;
}

const money = (amount: number, currency: Currency) => (currency === "USD" ? formatUsd(amount) : formatKhr(amount));

function place(facts: OrderAlertFacts): { km: string; en: string } {
  if (facts.fulfilment === "pickup") return { km: "មកយកផ្ទាល់", en: "Pickup" };
  const district = PHNOM_PENH_DISTRICTS.find((entry) => entry.id === facts.districtId);
  if (district) return { km: district.nameKm, en: district.nameEn };
  const province = PROVINCES.find((entry) => entry.id === facts.provinceId);
  return province ? { km: province.nameKm, en: province.nameEn } : { km: "", en: "" };
}

function payment(facts: OrderAlertFacts): { km: string; en: string } {
  if (facts.paymentMethod === "cod") return { km: "បង់ពេលទទួល", en: "Cash on delivery" };
  return { km: "បានបង់តាម KHQR", en: "Paid by KHQR" };
}

/** The tracking code in a message: with the buyer's phone it opens the order on "Track my order", no Telegram needed. */
function trackingLine(code: string): string {
  return `🔎 លេខកូដតាមដាន · Tracking code: ${code}`;
}

/** "New order #12" for the seller, with the total, how it's paid, where it goes and how many items. */
export function newOrderAlert(facts: OrderAlertFacts): string {
  const where = place(facts);
  const pay = payment(facts);
  const total = money(facts.totalMinor, facts.currency);
  return [
    `🛒 ការបញ្ជាទិញថ្មី #${facts.orderNumber} · ${total}`,
    `${pay.km} · ${where.km} · ${facts.itemCount} មុខ`,
    "",
    `New order #${facts.orderNumber} · ${total}`,
    `${pay.en} · ${where.en} · ${facts.itemCount} item${facts.itemCount === 1 ? "" : "s"}`,
    ...(facts.trackingCode ? ["", trackingLine(facts.trackingCode)] : []),
  ].join("\n");
}

/** The buyer cancelled before anything was packed. */
export function buyerCancelledAlert(facts: Pick<OrderAlertFacts, "orderNumber">): string {
  return [`❌ អ្នកទិញបានបោះបង់ការបញ្ជាទិញ #${facts.orderNumber}`, "", `The buyer cancelled order #${facts.orderNumber}`].join("\n");
}

/** Button labels, both languages, short enough for a phone. */
export const ALERT_BUTTONS = {
  confirm: "✅ បញ្ជាក់ · Confirm",
  open: "📋 បើក · Open",
  confirmed: "✅ បានបញ្ជាក់ · Confirmed",
} as const;

/** What a Telegram button carries: the action and the order, nothing else (64 bytes at most). */
export function confirmButtonData(orderId: string): string {
  return `confirm:${orderId}`;
}

/** What the "Confirmed" button carries once an order is confirmed: pressing it again only says so. */
export const CONFIRMED_BUTTON_DATA = "confirmed";

export function parseButtonData(data: string): { action: "confirm"; orderId: string } | null {
  const match = /^confirm:([0-9a-f-]{36})$/.exec(data);
  return match ? { action: "confirm", orderId: match[1]! } : null;
}

/** Something only a person can fix, for the platform's alert chat (admin Settings). */
export type AdminAlert =
  | { reason: "message_gave_up"; kind: string; orderNumber: number | null; attempts: number }
  | { reason: "worker_failing"; detail: string }
  | { reason: "admin_locked"; adminName: string }
  | { reason: "backup_failed"; detail: string };

export function adminAlertText(alert: AdminAlert): string {
  switch (alert.reason) {
    case "message_gave_up":
      return [
        `⚠️ សារមួយមិនអាចផ្ញើបានទេ បន្ទាប់ពីព្យាយាម ${alert.attempts} ដង`,
        "",
        `A message could not be sent after ${alert.attempts} tries (${alert.kind}${alert.orderNumber ? `, order #${alert.orderNumber}` : ""}). Check the bot and the shop's Telegram.`,
      ].join("\n");
    case "worker_failing":
      return ["🔥 Worker មានបញ្ហា", "", `The worker is failing: ${alert.detail}`].join("\n");
    case "admin_locked":
      return ["🔒 គណនីអ្នកគ្រប់គ្រងត្រូវបានចាក់សោ ១៥ នាទី", "", `Admin login locked for 15 minutes after 5 wrong codes: ${alert.adminName}`].join("\n");
    case "backup_failed":
      return ["💾 ការបម្រុងទុកទិន្នន័យប្រចាំថ្ងៃមិនបានសម្រេច", "", `Tonight's database backup failed: ${alert.detail}. The earlier backups are kept; check the worker's log and the backup bucket.`].join("\n");
  }
}

// ---------------------------------------------------------------- buyer updates

/** What a status message to a buyer says, both languages; null = no message for this status. */
const BUYER_STATUS_TEXT: Partial<Record<string, { km: string; en: string }>> = {
  confirmed: { km: "ហាងបានទទួលការបញ្ជាទិញរបស់អ្នក", en: "The shop accepted your order" },
  packing: { km: "ការបញ្ជាទិញរបស់អ្នកកំពុងវេចខ្ចប់", en: "Your order is being packed" },
  out_for_delivery: { km: "ការបញ្ជាទិញរបស់អ្នកកំពុងមកដល់", en: "Your order is on the way" },
  delivered: { km: "បានប្រគល់ — អរគុណ!", en: "Delivered — thank you!" },
  completed: { km: "ការបញ្ជាទិញបានបញ្ចប់ — អរគុណ!", en: "Order complete — thank you!" },
  cancelled: { km: "ការបញ្ជាទិញត្រូវបានបោះបង់", en: "Order cancelled" },
  failed_delivery: { km: "មិនអាចដឹកជញ្ជូនបាន — ហាងនឹងទាក់ទងអ្នក", en: "We couldn't deliver — the shop will contact you" },
};

export interface BuyerUpdateFacts {
  orderNumber: number;
  shopName: string;
  status: string;
  fulfilment: "delivery" | "pickup";
  /** How it was sent, once sent: the driver's name or the bus ticket — never a phone number. */
  dispatch: { route: "driver" | "bus" | "pickup"; driverName: string; busCompany: string; ticketNumber: string } | null;
  /** As printed, MEK-7K4P-9QXR. */
  trackingCode?: string;
}

/** A buyer's status message, or null when this status isn't worth a message (e.g. waiting for a driver). */
export function buyerUpdateText(facts: BuyerUpdateFacts): string | null {
  const pickupReady = facts.status === "out_for_delivery" && facts.fulfilment === "pickup";
  const line = pickupReady ? { km: "ការបញ្ជាទិញរបស់អ្នករួចរាល់សម្រាប់មកយក", en: "Your order is ready for pickup" } : BUYER_STATUS_TEXT[facts.status];
  if (!line) return null;
  const extra =
    facts.status === "out_for_delivery" && facts.dispatch?.route === "driver" && facts.dispatch.driverName
      ? [`🛵 ${facts.dispatch.driverName}`]
      : facts.status === "out_for_delivery" && facts.dispatch?.route === "bus"
        ? [`🚌 ${facts.dispatch.busCompany} · ${facts.dispatch.ticketNumber}`]
        : [];
  const tracking = facts.trackingCode ? [trackingLine(facts.trackingCode)] : [];
  return [`📦 ${facts.shopName} · #${facts.orderNumber}`, line.km, line.en, ...extra, ...tracking].join("\n");
}

/** "Stop updates" under each buyer message; carries only the order id. */
export const STOP_BUTTON_LABEL = "🔕 ឈប់ទទួល · Stop updates";
export function stopButtonData(orderId: string): string {
  return `stop:${orderId}`;
}
export function parseStopButton(data: string): string | null {
  const match = /^stop:([0-9a-f-]{36})$/.exec(data);
  return match ? match[1]! : null;
}

// ---------------------------------------------------------------- t.me link codes

/**
 * The code in a t.me/<bot>?start= (or startgroup=) link: "g_" for a staff
 * group, "f_" for a buyer following an order, then 24 random URL-safe
 * characters (Telegram allows A–Z a–z 0–9 _ - and up to 64).
 */
export const TELEGRAM_LINK_CODE_PATTERN = /^(g|f)_[A-Za-z0-9_-]{24}$/;
export const TELEGRAM_LINK_MINUTES = 15;

export function telegramStartLink(botUsername: string, code: string, group: boolean): string {
  return `https://t.me/${botUsername}?${group ? "startgroup" : "start"}=${code}`;
}

/** What the bot says when it links a group or a follower, or can't. */
export const LINK_REPLIES = {
  groupLinked: (shopName: string) => `✅ ក្រុមនេះនឹងទទួលការជូនដំណឹងការបញ្ជាទិញពី ${shopName}\n\nThis group will now get order alerts for ${shopName}.`,
  following: (shopName: string, orderNumber: number) =>
    `✅ អ្នកនឹងទទួលព័ត៌មានថ្មីៗសម្រាប់ការបញ្ជាទិញ #${orderNumber} ពី ${shopName}\n\nYou'll get updates for order #${orderNumber} from ${shopName}.`,
  stopped: "🔕 បានឈប់ផ្ញើព័ត៌មានថ្មីៗ។\n\nUpdates stopped.",
  badCode: "⚠️ តំណនេះផុតកំណត់ ឬបានប្រើរួចហើយ។ សូមយកតំណថ្មីពីគេហទំព័រ។\n\nThis link has expired or was already used. Get a new one from the website.",
  hello: "👋 សួស្តី! បូតនេះផ្ញើការជូនដំណឹងពី Khmio។\n\nHello! This bot sends Khmio notifications.",
} as const;
