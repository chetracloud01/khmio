// Sample orders for the seller's order screens and the buyer's order page.
// Stands in for the orders / order_items / delivery_dispatches tables in
// docs/blueprint.md. Each sample is built by replaying real actions through
// the shared order rules, so its status and history are always a valid path.

import {
  applyOrderAction,
  getInitialOrderStatus,
  type Currency,
  type DispatchRoute,
  type Fulfilment,
  type OrderAction,
  type OrderCancellation,
  type OrderStatus,
  type PaymentMethod,
} from "@khmio/shared";
import { mockProducts, parseLineKey, type MockProduct } from "./mock-data";

export interface OrderLine {
  /** lineKey(productId, variantId) — lets the name follow the viewer's language. */
  key: string;
  /** The name as the buyer saw it, kept in case the product is later renamed or deleted. */
  label: string;
  qty: number;
  lineTotal: number;
}

export interface OrderDispatch {
  route: DispatchRoute;
  driverName?: string;
  /** 855XXXXXXXX(X) */
  driverPhone?: string;
  busCompany?: string;
  ticketNumber?: string;
}

export interface OrderRecord {
  orderNumber: string;
  placedAtIso: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  currency: Currency;
  /** All amounts are in `currency`: cents or riel. */
  total: number;
  deliveryFee: number;
  vat: number;
  vatPercent: number;
  lines: OrderLine[];
  name: string;
  /** 855XXXXXXXX(X) */
  phone: string;
  fulfilment: Fulfilment;
  area: "phnom_penh" | "province";
  districtId?: string;
  provinceId?: string;
  landmark: string;
  /** Pickup orders: where and when, copied from the shop's settings at order time. */
  pickupAddress?: string;
  pickupHours?: string;
  dispatch?: OrderDispatch;
  cancellation?: OrderCancellation;
  /** Stock has left the shelf for this order, so cancelling must put it back. */
  stockTaken: boolean;
  /** Placed through the shop's checkout (not a sample) — the setup checklist's "test order". */
  fromShop?: boolean;
  /** Every status the order has been in, oldest first. */
  timeline: { status: OrderStatus; atIso: string }[];
}

/** A line's name in the viewer's language, falling back to what was saved with the order. */
export function orderLineLabel(line: OrderLine, locale: string, products: MockProduct[] = mockProducts): string {
  const { productId, variantId } = parseLineKey(line.key);
  const product = products.find((item) => item.id === productId);
  if (!product) return line.label;
  const title = locale === "km" ? product.titleKm : product.titleEn;
  const variant = product.variants?.find((item) => item.id === variantId);
  return variant ? `${title} – ${locale === "km" ? variant.labelKm : variant.labelEn}` : title;
}

interface OrderSeed
  extends Omit<OrderRecord, "placedAtIso" | "status" | "timeline" | "stockTaken" | "landmark" | "vatPercent"> {
  placedMinutesAgo: number;
  /** Replayed from the starting status to reach the sample's current one. */
  actions: OrderAction[];
  landmark?: string;
}

const seeds: OrderSeed[] = [
  {
    orderNumber: "SC-481800",
    placedMinutesAgo: 3,
    actions: [],
    paymentMethod: "khqr",
    currency: "USD",
    lines: [{ key: "p3::_base", label: "Milk Tea", qty: 2, lineTotal: 350 }],
    deliveryFee: 100,
    vat: 35,
    total: 485,
    name: "Malis Tep",
    phone: "85510223344",
    fulfilment: "delivery",
    area: "phnom_penh",
    districtId: "boeng-keng-kang",
  },
  {
    orderNumber: "SC-482913",
    placedMinutesAgo: 8,
    actions: ["pay"],
    paymentMethod: "khqr",
    currency: "USD",
    lines: [
      { key: "p2::_base", label: "Iced Latte", qty: 2, lineTotal: 400 },
      { key: "p5::_base", label: "Croissant", qty: 1, lineTotal: 113 },
    ],
    deliveryFee: 100,
    vat: 51,
    total: 664,
    name: "Dara Sok",
    phone: "85512345678",
    fulfilment: "delivery",
    area: "phnom_penh",
    districtId: "daun-penh",
    landmark: "Opposite Wat Phnom, blue gate",
  },
  {
    orderNumber: "SC-482788",
    placedMinutesAgo: 35,
    actions: [],
    paymentMethod: "cod",
    currency: "USD",
    lines: [{ key: "p3::_base", label: "Milk Tea", qty: 1, lineTotal: 175 }],
    deliveryFee: 0,
    vat: 18,
    total: 193,
    name: "Sopheak Chan",
    phone: "855971234567",
    fulfilment: "pickup",
    area: "phnom_penh",
    pickupAddress: "ផ្លូវ ២៤០ ដូនពេញ · St. 240, Daun Penh",
    pickupHours: "7:00 – 19:00",
  },
  {
    orderNumber: "SC-482655",
    placedMinutesAgo: 90,
    actions: ["pay", "confirm", "start_packing"],
    paymentMethod: "khqr",
    currency: "USD",
    lines: [
      { key: "p1::p1-m", label: "Iced Coffee – Medium", qty: 2, lineTotal: 256 },
      { key: "p4::_base", label: "Chocolate Cookie", qty: 3, lineTotal: 300 },
    ],
    deliveryFee: 200,
    vat: 56,
    total: 812,
    name: "Vanna Kim",
    phone: "85511889900",
    fulfilment: "delivery",
    area: "province",
    provinceId: "kampot",
    landmark: "Near Kampot market",
  },
  {
    orderNumber: "SC-482530",
    placedMinutesAgo: 150,
    actions: ["confirm", "start_packing", "dispatch"],
    paymentMethod: "cod",
    currency: "KHR",
    lines: [{ key: "p6::_base", label: "Lemonade", qty: 2, lineTotal: 12000 }],
    deliveryFee: 6000,
    vat: 1200,
    total: 19200,
    name: "Bopha Nov",
    phone: "85516778899",
    fulfilment: "delivery",
    area: "phnom_penh",
    districtId: "sen-sok",
    dispatch: { route: "driver", driverName: "Bong Rith", driverPhone: "85512345678" },
  },
  {
    orderNumber: "SC-482410",
    placedMinutesAgo: 200,
    actions: ["pay", "confirm", "start_packing", "dispatch", "driver_picked_up"],
    paymentMethod: "khqr",
    currency: "USD",
    lines: [
      { key: "p1::p1-l", label: "Iced Coffee – Large", qty: 4, lineTotal: 596 },
      { key: "p5::_base", label: "Croissant", qty: 2, lineTotal: 226 },
    ],
    deliveryFee: 100,
    vat: 82,
    total: 1004,
    name: "Rithy Heng",
    phone: "85515667788",
    fulfilment: "delivery",
    area: "phnom_penh",
    districtId: "chamkar-mon",
    dispatch: { route: "driver", driverName: "Sok Delivery", driverPhone: "855971234567" },
  },
  {
    orderNumber: "SC-482301",
    placedMinutesAgo: 300,
    actions: ["confirm", "start_packing", "dispatch", "driver_picked_up", "mark_delivered"],
    paymentMethod: "cod",
    currency: "USD",
    lines: [{ key: "p2::_base", label: "Iced Latte", qty: 3, lineTotal: 600 }],
    deliveryFee: 100,
    vat: 60,
    total: 760,
    name: "Sreyleak Mao",
    phone: "85517334455",
    fulfilment: "delivery",
    area: "phnom_penh",
    districtId: "tuol-kouk",
    dispatch: { route: "driver", driverName: "Bong Rith", driverPhone: "85512345678" },
  },
  {
    orderNumber: "SC-481990",
    placedMinutesAgo: 400,
    actions: ["confirm", "start_packing", "dispatch", "driver_picked_up", "fail_delivery"],
    paymentMethod: "cod",
    currency: "USD",
    lines: [{ key: "p4::_base", label: "Chocolate Cookie", qty: 5, lineTotal: 500 }],
    deliveryFee: 150,
    vat: 50,
    total: 700,
    name: "Chantha Ros",
    phone: "85512998877",
    fulfilment: "delivery",
    area: "phnom_penh",
    districtId: "mean-chey",
    dispatch: { route: "driver", driverName: "Sok Delivery", driverPhone: "855971234567" },
  },
  {
    orderNumber: "SC-482188",
    placedMinutesAgo: 1500,
    actions: ["pay", "confirm", "start_packing", "dispatch", "mark_delivered"],
    paymentMethod: "khqr",
    currency: "USD",
    lines: [{ key: "p1::p1-s", label: "Iced Coffee – Small", qty: 2, lineTotal: 212 }],
    deliveryFee: 0,
    vat: 21,
    total: 233,
    name: "Kimheng Ly",
    phone: "85510556677",
    fulfilment: "pickup",
    area: "phnom_penh",
    pickupAddress: "ផ្លូវ ២៤០ ដូនពេញ · St. 240, Daun Penh",
    pickupHours: "7:00 – 19:00",
    dispatch: { route: "pickup" },
  },
  {
    orderNumber: "SC-482050",
    placedMinutesAgo: 1700,
    actions: ["cancel"],
    paymentMethod: "cod",
    currency: "USD",
    lines: [{ key: "p6::_base", label: "Lemonade", qty: 6, lineTotal: 878 }],
    deliveryFee: 100,
    vat: 88,
    total: 1066,
    name: "Pisey Oum",
    phone: "85517112233",
    fulfilment: "delivery",
    area: "phnom_penh",
    districtId: "russey-keo",
    cancellation: { reason: "out_of_stock", note: "" },
  },
];

/**
 * The sample orders as of `now`. Called in the browser only (it reads the
 * clock), so the times stay "8 min ago" whenever the mockup is opened.
 */
export function buildSampleOrders(now: Date): OrderRecord[] {
  return seeds.map(({ placedMinutesAgo, actions, landmark, ...seed }) => {
    const placedAt = now.getTime() - placedMinutesAgo * 60_000;
    // Spread the steps evenly between "placed" and now.
    const stepMs = (placedMinutesAgo * 60_000) / (actions.length + 1);
    let status = getInitialOrderStatus(seed.paymentMethod);
    const timeline = [{ status, atIso: new Date(placedAt).toISOString() }];
    actions.forEach((action, index) => {
      const next = applyOrderAction({ ...seed, status }, action);
      if (!next) throw new Error(`Sample order ${seed.orderNumber}: "${action}" is not allowed from "${status}"`);
      status = next;
      timeline.push({ status, atIso: new Date(placedAt + stepMs * (index + 1)).toISOString() });
    });
    return {
      ...seed,
      landmark: landmark ?? "",
      vatPercent: 10,
      placedAtIso: timeline[0]!.atIso,
      status,
      timeline,
      // Samples don't touch the stock ledger, so there's nothing to put back.
      stockTaken: false,
    };
  });
}
