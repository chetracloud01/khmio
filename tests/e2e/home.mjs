// The seller's dashboard end to end (GET /orders/summary and GET /dashboard): only for a
// signed-in shop, only that shop's orders, dollars and riel kept apart, and
// a new cash order moving "to handle", "cash to collect", today's sales,
// the week and the best sellers. PASS/FAIL lines.
// Usage: node tests/e2e/home.mjs <api url>    (after step2/3/4 on the same database)
import { randomUUID } from "node:crypto";
import { psql } from "./lib.mjs";

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

const before = (await call("/orders/summary", { cookie: a })).json;
check("A's numbers come back in their shape, both currencies kept apart", typeof before?.waiting === "number" && typeof before.cashToCollect?.USD === "number" && typeof before.cashToCollect?.KHR === "number", JSON.stringify(before)?.slice(0, 200));
// The dashboard (GET /dashboard): today beside yesterday, from the sales report's own sums.
const dashboard = async (period = "today", cookie = a) => (await call(`/dashboard?period=${period}`, { cookie })).json;
check("the dashboard needs a signed-in shop, and refuses a period it doesn't offer", (await call("/dashboard?period=today")).status === 401 && (await call("/dashboard?period=year", { cookie: a })).status === 400);
const dayBefore = await dashboard();
check("the dashboard compares today with yesterday", dayBefore?.period === "today" && dayBefore.days.from === dayBefore.days.to && dayBefore.previousDays.to < dayBefore.days.from, JSON.stringify(dayBefore?.days));
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
check("and the cash to collect, in dollars, riel untouched", after.cashToCollect.USD === before.cashToCollect.USD + order.totalMinor && after.cashToCollect.KHR === before.cashToCollect.KHR);
const dayAfter = await dashboard();
check("its total joins today's sales on the dashboard, online, riel untouched", dayAfter.sales.now.sales.USD === dayBefore.sales.now.sales.USD + order.totalMinor && dayAfter.sales.now.online.USD === dayBefore.sales.now.online.USD + order.totalMinor && dayAfter.sales.now.sales.KHR === dayBefore.sales.now.sales.KHR && dayAfter.sales.now.orders === dayBefore.sales.now.orders + 1);
check("yesterday, the period it's compared with, doesn't move", JSON.stringify(dayAfter.sales.before) === JSON.stringify(dayBefore.sales.before));
// Today by hour (Phnom Penh): the order lands in this hour, and the hours add up to today's sales.
const hourPP = String(new Date(Date.now() + 7 * 3600_000).getUTCHours());
const hourOf = (brief) => brief.sales.points.find((point) => point.key === hourPP);
const sumHours = (brief) => brief.sales.points.reduce((sum, point) => sum + point.shop.USD + point.online.USD, 0);
check("today by hour: the order in this hour, the hours adding up to today's sales", hourOf(dayAfter)?.online.USD - (hourOf(dayBefore)?.online.USD ?? 0) === order.totalMinor && sumHours(dayAfter) === dayAfter.sales.now.sales.USD, JSON.stringify(hourOf(dayAfter)));
const soldToday = dayAfter.sales.products.find((item) => item.nameKm === product.titleKm && item.nameEn === product.titleEn);
check("the product is among today's best sellers (five at most), with what it earned in dollars", dayAfter.sales.products.length <= 5 && soldToday && soldToday.quantity >= 2 && soldToday.money.USD > 0, JSON.stringify(dayAfter.sales.products));
check("7 and 30 days, day by day beside the period before", (await dashboard("week")).sales.points.length === 7 && (await dashboard("month")).sales.points.length === 30);
const reportToday = (await call("/orders/report?period=today", { cookie: a })).json;
check("the dashboard's today is the sales report's today", JSON.stringify(dayAfter.sales.now.sales) === JSON.stringify(reportToday.figures.all.sales) && dayAfter.sales.now.orders === reportToday.figures.all.orders);

// B's numbers are made only of B's own orders (today = Phnom Penh, UTC+7).
const forB = (await call("/orders/summary", { cookie: b })).json;
const dashboardB = await dashboard("today", b);
const listB = (await call("/orders", { cookie: b })).json;
const todayPP = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const bToday = listB.filter((o) => !["cancelled", "awaiting_payment"].includes(o.status) && new Date(Date.parse(o.createdAt) + 7 * 3600_000).toISOString().slice(0, 10) === todayPP);
check(
  "another shop's numbers are only its own orders",
  forB.waiting === listB.filter((o) => WAITING(o.status)).length && dashboardB.sales.now.orders === bToday.length && dashboardB.sales.now.sales.USD === bToday.filter((o) => o.currency === "USD").reduce((sum, o) => sum + o.totalMinor, 0),
  JSON.stringify({ waiting: forB.waiting, today: dashboardB?.sales?.now, bOrders: listB.length }),
);

// Cancelled: no longer a sale, nothing to collect.
const cancelled = await call(`/orders/${order.id}/actions`, { method: "POST", cookie: a, body: { action: "cancel", cancellation: { reason: "out_of_stock", note: "" } } });
const afterCancel = (await call("/orders/summary", { cookie: a })).json;
const dayCancelled = await dashboard();
check(
  "a cancelled order leaves 'to handle', today's sales and the cash to collect",
  cancelled.status === 200 && afterCancel.waiting === before.waiting && dayCancelled.sales.now.sales.USD === dayBefore.sales.now.sales.USD && afterCancel.cashToCollect.USD === before.cashToCollect.USD,
  cancelled.raw.slice(0, 200),
);

// The sales report (GET /orders/report; design/screens.md S17 "Sales"): in the shop and online, against the database.
const sql = (query) => psql(query).trim();
const report = (search, cookie = a) => call(`/orders/report?${search}`, { cookie });
check("the sales report needs a signed-in shop", (await call("/orders/report?period=all")).status === 401);
const sales = await report("period=all");
const ofA = `from orders where store_id = (select id from stores where slug = '${slugA}')`;
const sale = `status::text not in ('cancelled', 'awaiting_payment')`;
const dbSum = (where) => sql(`select count(*) || ',' || coalesce(sum(total_minor) filter (where currency = 'USD'), 0) || ',' || coalesce(sum(total_minor) filter (where currency = 'KHR'), 0) ${ofA} and ${where}`);
const sums = (share) => `${share?.orders},${share?.sales?.USD},${share?.sales?.KHR}`;
check("it answers on its own route (not taken for an order's id)", sales.status === 200 && Array.isArray(sales.json?.orders), sales.raw.slice(0, 200));
check("sales match the database: orders and each currency, cancelled and unpaid online orders left out", sums(sales.json?.figures?.all) === dbSum(sale), `${sums(sales.json?.figures?.all)} vs ${dbSum(sale)}`);
check("in the shop and online, each matches the database", sums(sales.json?.figures?.shop) === dbSum(`${sale} and channel = 'in_store'`) && sums(sales.json?.figures?.online) === dbSum(`${sale} and channel = 'online'`));
check("cancelled orders and cash still to collect match the database", `${sales.json?.figures?.cancelled?.orders}` === sql(`select count(*) ${ofA} and status = 'cancelled'`) && `${sales.json?.figures?.toCollect?.orders}` === sql(`select count(*) ${ofA} and payment_method = 'cod' and status::text not in ('completed', 'cancelled', 'awaiting_payment')`));
check("the order just cancelled is in the table, as cancelled", sales.json?.orders?.some((row) => row.id === order.id && row.status === "cancelled"));
const best = sales.json?.products?.[0];
check("the best seller's units match the database", !best || `${best.quantity}` === sql(`select coalesce(sum(i.quantity), 0) from order_items i join orders o on o.id = i.order_id join product_variants v on v.id = i.variant_id where o.store_id = (select id from stores where slug = '${slugA}') and o.${sale} and v.product_id = '${best.productId}'`), JSON.stringify(best));
check("a period long before any order is empty", (await report("period=custom&from=2000-01-01&to=2000-01-31")).json?.figures?.all?.orders === 0);
check("a bad period is refused", (await report("period=forever")).status === 400);
check("another shop's sales report never has A's orders", !((await report("period=all", b)).json?.orders ?? []).some((row) => row.id === order.id));

// The Orders page's status tiles (GET /orders/status; design/screens.md S4): over every order, against the database and the list's own tabs.
const statusOf = (cookie = a) => call("/orders/status", { cookie });
check("the order tiles need a signed-in shop", (await call("/orders/status")).status === 401);
const tilesA = (await statusOf()).json;
const countWhere = (where) => Number(sql(`select count(*) ${ofA} and ${where}`));
check(
  "each tile counts what the database has at that step",
  tilesA?.tabs?.to_confirm?.count === countWhere("status in ('paid', 'cod_pending')") && tilesA.tabs.packing.count === countWhere("status in ('confirmed', 'packing')") && tilesA.tabs.sending.count === countWhere("status in ('waiting_for_driver', 'out_for_delivery')") && tilesA.tabs.problems.count === countWhere("status in ('cancelled', 'failed_delivery')"),
  JSON.stringify(tilesA?.tabs),
);
check("cash to collect: cash on delivery not completed or cancelled, as on the dashboard", tilesA?.toCollect?.count === countWhere("payment_method = 'cod' and status::text not in ('completed', 'cancelled')") && JSON.stringify(tilesA.toCollect.money) === JSON.stringify((await call("/orders/summary", { cookie: a })).json.cashToCollect));
const listTotal = async (tab) => (await call(`/orders/page?chip=${tab}`, { cookie: a })).json?.total;
check("a tile and the list tab it opens hold the same orders", (await listTotal("to_collect")) === tilesA.toCollect.count && (await listTotal("to_confirm")) === tilesA.tabs.to_confirm.count && (await listTotal("problems")) === tilesA.tabs.problems.count);
check("sales today is the dashboard's today", JSON.stringify(tilesA.today.money) === JSON.stringify((await dashboard()).sales.now.sales) && tilesA.today.count === (await dashboard()).sales.now.orders);
const tilesB = (await statusOf(b)).json;
check("another shop's tiles count only its own orders", tilesB?.toCollect?.count === (await call("/orders/page?chip=to_collect", { cookie: b })).json?.total && tilesB.tabs.to_confirm.count === (await call("/orders/page?chip=to_confirm", { cookie: b })).json?.total);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
