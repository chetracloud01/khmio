// The seller home page's numbers end to end (GET /orders/summary): only for a
// signed-in shop, only that shop's orders, dollars and riel kept apart, and
// a new cash order moving "to handle", "cash to collect", today's sales,
// the week and the best sellers. PASS/FAIL lines.
// Usage: node tests/e2e/home.mjs <api url>    (after step2/3/4 on the same database)
import { randomUUID } from "node:crypto";

const B = process.argv[2] ?? "http://localhost:4105";
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
};
async function call(path, { method = "GET", body, cookie } = {}) {
  const r = await fetch(B + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: r.status, json, raw: text };
}
const login = async (who) => (await fetch(B + "/auth/dev-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ as: who }) })).headers.get("set-cookie").split(";")[0];
const WAITING = (status) => !["awaiting_payment", "completed", "cancelled"].includes(status);

check("the numbers need a signed-in shop", (await call("/orders/summary")).status === 401);

const a = await login("a");
const b = await login("b");
const slugA = (await call("/auth/me", { cookie: a })).json.store.slug;

/** Days of history the home's numbers carry (apps/api orders/summary.ts SUMMARY_DAYS). */
const SUMMARY_DAYS = 60;
const before = (await call("/orders/summary", { cookie: a })).json;
check(
  "A's numbers come back in their shape: 60 days, both currencies kept apart",
  before?.days?.length === SUMMARY_DAYS && typeof before.salesToday?.USD === "number" && typeof before.salesToday?.KHR === "number" && typeof before.cashToCollect?.KHR === "number",
  JSON.stringify(before)?.slice(0, 200),
);
const listA = (await call("/orders", { cookie: a })).json;
check("'to handle' matches A's own order list", before.waiting === listA.filter((order) => WAITING(order.status)).length, `${before.waiting} vs ${listA.length} orders`);

// A new cash order today, in dollars.
const shop = (await call(`/public/stores/${slugA}`)).json;
const product = shop.products.find((p) => !p.hasOptions);
const variant = product?.variants[0];
const placed = await call(`/public/stores/${slugA}/orders`, {
  method: "POST",
  body: { idempotencyKey: randomUUID(), lines: [{ variantId: variant.id, quantity: 2 }], checkout: { name: "Dara", phone: "097 555 0101", currency: "USD", fulfilment: "pickup", area: "phnom_penh", landmark: "", paymentMethod: "cod" } },
});
check("a cash order is placed", placed.status === 201, placed.raw);
const order = (await call("/orders", { cookie: a })).json.find((o) => o.orderNumber === placed.json?.orderNumber);

const after = (await call("/orders/summary", { cookie: a })).json;
check("the new order is one more to handle", after.waiting === before.waiting + 1, `${before.waiting} → ${after.waiting}`);
check("its total joins today's sales in dollars, riel untouched", after.salesToday.USD === before.salesToday.USD + order.totalMinor && after.salesToday.KHR === before.salesToday.KHR);
check("and the cash to collect", after.cashToCollect.USD === before.cashToCollect.USD + order.totalMinor && after.cashToCollect.KHR === before.cashToCollect.KHR);
check("today's bar and the week both count it", after.days.at(-1).orders === before.days.at(-1).orders + 1 && after.ordersLast7Days === before.ordersLast7Days + 1);
check("today's bar counts it in dollars", after.days.at(-1).ordersUSD === before.days.at(-1).ordersUSD + 1 && after.days.length === 60);
const soldToday = after.topProducts.today.find((item) => item.nameKm === product.titleKm && item.nameEn === product.titleEn);
check(
  "the product is among today's top products, with what it earned in dollars",
  ["today", "week", "month"].every((period) => after.topProducts[period].length > 0 && after.topProducts[period].length <= 5) && soldToday && soldToday.quantity >= 2 && soldToday.USD > 0,
  JSON.stringify(after.topProducts.today),
);

// B's numbers are made only of B's own orders (today = Phnom Penh, UTC+7).
const forB = (await call("/orders/summary", { cookie: b })).json;
const listB = (await call("/orders", { cookie: b })).json;
const todayPP = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const bToday = listB.filter((o) => !["cancelled", "awaiting_payment"].includes(o.status) && new Date(Date.parse(o.createdAt) + 7 * 3600_000).toISOString().slice(0, 10) === todayPP);
check(
  "another shop's numbers are only its own orders",
  forB.waiting === listB.filter((o) => WAITING(o.status)).length && forB.days.at(-1).orders === bToday.length && forB.salesToday.USD === bToday.filter((o) => o.currency === "USD").reduce((sum, o) => sum + o.totalMinor, 0),
  JSON.stringify({ waiting: forB.waiting, today: forB.days.at(-1), bOrders: listB.length }),
);

// Cancelled: no longer a sale, nothing to collect.
const cancelled = await call(`/orders/${order.id}/actions`, { method: "POST", cookie: a, body: { action: "cancel", cancellation: { reason: "out_of_stock", note: "" } } });
const afterCancel = (await call("/orders/summary", { cookie: a })).json;
check(
  "a cancelled order leaves 'to handle', today's sales and the cash to collect",
  cancelled.status === 200 && afterCancel.waiting === before.waiting && afterCancel.salesToday.USD === before.salesToday.USD && afterCancel.cashToCollect.USD === before.cashToCollect.USD,
  cancelled.raw.slice(0, 200),
);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
