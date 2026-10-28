import { countsAsSale, DAY_MS, type Currency, type DeliveryArea, type OrderStatus } from "@khmio/shared";
import type { CustomerDetail, CustomerRow, SellerOrder } from "@/lib/api";

// Sample customers for the Customers mockup (design/screens.md S14), in the
// exact shape GET /customers/:id answers, so the mockup can't show anything
// the API can't send. Each one's numbers are worked out from their sample
// orders with the same rule as the API (countsAsSale), and dates are counted
// back from now so "2 days ago" reads true.

const HOUR_MS = DAY_MS / 24;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

interface SampleOrder {
  number: number;
  status: OrderStatus;
  currency: Currency;
  totalMinor: number;
  items: number;
  /** How long ago it was placed. */
  ageMs: number;
  /** At the counter (cash) instead of online (cash on delivery). */
  inStore?: boolean;
}

interface SampleCustomer {
  id: string;
  name: string;
  phone: string;
  area: DeliveryArea | null;
  districtId: string | null;
  provinceId: string | null;
  landmark: string;
  orders: SampleOrder[];
}

function toSellerOrder(customer: SampleCustomer, order: SampleOrder): SellerOrder {
  return {
    id: `${customer.id}-order-${order.number}`,
    orderNumber: order.number,
    trackingCode: `MOCK-${order.number}`,
    status: order.status,
    channel: order.inStore ? "in_store" : "online",
    paymentMethod: order.inStore ? "cash" : "cod",
    currency: order.currency,
    totalMinor: order.totalMinor,
    buyerName: customer.name,
    buyerPhone: customer.phone,
    fulfilment: order.inStore ? "in_store" : "delivery",
    area: customer.area ?? "phnom_penh",
    districtId: order.inStore ? null : customer.districtId,
    provinceId: order.inStore ? null : customer.provinceId,
    createdAt: ago(order.ageMs),
    itemCount: order.items,
  };
}

function toDetail(customer: SampleCustomer): CustomerDetail {
  const orders = customer.orders.map((order) => toSellerOrder(customer, order)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const sales = orders.filter((order) => countsAsSale(order.status));
  const spent: Record<Currency, number> = { USD: 0, KHR: 0 };
  for (const order of sales) spent[order.currency] += order.totalMinor;
  const oldestFirst = [...orders].reverse();
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    orderCount: sales.length,
    spent,
    firstOrderAt: sales.at(-1)?.createdAt ?? null,
    lastOrderAt: sales[0]?.createdAt ?? null,
    createdAt: oldestFirst[0]?.createdAt ?? ago(0),
    area: customer.area,
    districtId: customer.districtId,
    provinceId: customer.provinceId,
    landmark: customer.landmark,
    orders,
  };
}

const SAMPLE_CUSTOMERS: SampleCustomer[] = [
  {
    id: "c-dara",
    name: "Sok Dara",
    phone: "85512345678",
    area: "phnom_penh",
    districtId: "chamkar-mon",
    provinceId: null,
    landmark: "Near Aeon Mall 1, gate 2",
    orders: [
      { number: 128, status: "delivered", currency: "USD", totalMinor: 2450, items: 3, ageMs: 2 * HOUR_MS },
      { number: 117, status: "completed", currency: "USD", totalMinor: 1200, items: 1, ageMs: 4 * DAY_MS },
      { number: 96, status: "completed", currency: "KHR", totalMinor: 48000, items: 2, ageMs: 19 * DAY_MS },
      { number: 71, status: "cancelled", currency: "USD", totalMinor: 900, items: 1, ageMs: 33 * DAY_MS },
      { number: 64, status: "completed", currency: "USD", totalMinor: 3100, items: 4, ageMs: 41 * DAY_MS },
    ],
  },
  {
    id: "c-sreymom",
    name: "Chan Sreymom",
    phone: "855971234567",
    area: "phnom_penh",
    districtId: "tuol-kouk",
    provinceId: null,
    landmark: "",
    orders: [
      { number: 125, status: "packing", currency: "KHR", totalMinor: 62000, items: 2, ageMs: 5 * HOUR_MS },
      { number: 101, status: "completed", currency: "KHR", totalMinor: 35500, items: 1, ageMs: 12 * DAY_MS },
    ],
  },
  {
    id: "c-lina",
    name: "Kim Lina",
    phone: "85516555012",
    area: "province",
    districtId: null,
    provinceId: "battambang",
    landmark: "Virak Buntham office, Battambang",
    orders: [{ number: 122, status: "out_for_delivery", currency: "USD", totalMinor: 5800, items: 5, ageMs: 1 * DAY_MS }],
  },
  {
    id: "c-rithy",
    name: "Vann Rithy",
    phone: "85510888123",
    area: null,
    districtId: null,
    provinceId: null,
    landmark: "",
    orders: [
      { number: 119, status: "completed", currency: "USD", totalMinor: 750, items: 1, ageMs: 3 * DAY_MS, inStore: true },
      { number: 88, status: "completed", currency: "USD", totalMinor: 1500, items: 2, ageMs: 25 * DAY_MS, inStore: true },
    ],
  },
  {
    id: "c-sophea",
    name: "Meas Sophea",
    phone: "85569777456",
    area: "phnom_penh",
    districtId: "sen-sok",
    provinceId: null,
    landmark: "Street 1986, pink gate",
    orders: [{ number: 110, status: "cancelled", currency: "USD", totalMinor: 1990, items: 1, ageMs: 8 * DAY_MS }],
  },
  {
    id: "c-pisey",
    name: "Heng Pisey",
    phone: "85512777888",
    area: "phnom_penh",
    districtId: "daun-penh",
    provinceId: null,
    landmark: "Central Market, row C",
    orders: [
      { number: 127, status: "confirmed", currency: "USD", totalMinor: 4200, items: 2, ageMs: 3 * HOUR_MS },
      { number: 113, status: "completed", currency: "USD", totalMinor: 2600, items: 3, ageMs: 6 * DAY_MS },
      { number: 99, status: "completed", currency: "USD", totalMinor: 1800, items: 1, ageMs: 15 * DAY_MS },
      { number: 80, status: "completed", currency: "KHR", totalMinor: 24000, items: 1, ageMs: 28 * DAY_MS },
    ],
  },
];

export const mockCustomerDetails: CustomerDetail[] = SAMPLE_CUSTOMERS.map(toDetail);

/** The list's rows: each customer without their address and orders. */
export const mockCustomerRows: CustomerRow[] = mockCustomerDetails.map(({ id, name, phone, orderCount, spent, firstOrderAt, lastOrderAt, createdAt }) => ({
  id,
  name,
  phone,
  orderCount,
  spent,
  firstOrderAt,
  lastOrderAt,
  createdAt,
}));
