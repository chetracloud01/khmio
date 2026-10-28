// Customers end to end (GET /customers/page and /customers/:id; design/screens.md
// S14): on every plan; a buyer is one customer whether they order online or
// at the counter; their numbers count only sales (a cancelled order is listed
// but not counted) and keep dollars and riel apart; search by name or a
// phone typed any way; an order links to its customer; another shop never
// sees them. PASS/FAIL lines.
// Usage: node tests/e2e/customers.mjs <api url>    (after step2/3/4 on the same database)
import { randomInt, randomUUID } from "node:crypto";
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
const sql = (query) => psql(query).trim();

check("the list needs a signed-in shop", (await call("/customers/page")).status === 401);

const a = await login("a");
const b = await login("b");
const slugA = (await call("/auth/me", { cookie: a })).json.store.slug;
const subscriptionOf = `store_id = (select id from stores where slug = '${slugA}')`;
const planBefore = sql(`select plan || ',' || status from subscriptions where ${subscriptionOf}`).split(",");
const beta = sql("select beta_all_basic::text from platform_settings where id = 1");
sql("update platform_settings set beta_all_basic = false where id = 1");

// One new buyer: a phone and a name no other check uses.
const tag = randomUUID().slice(0, 6);
const name = `Customer ${tag}`;
const local = `097${String(randomInt(1_000_000, 9_999_999))}`;
const saved = `855${local.slice(1)}`;
const bread = (await call("/products", { cookie: a })).json.find((product) => product.titleEn === "Bread");
const variantId = bread.variants[0].id;
const order = async (currency) => {
  const placed = await call(`/public/stores/${slugA}/orders`, {
    method: "POST",
    body: { idempotencyKey: randomUUID(), lines: [{ variantId, quantity: 1 }], checkout: { name, phone: local, currency, fulfilment: "pickup", area: "phnom_penh", landmark: "", paymentMethod: "cod" } },
  });
  // The buyer gets a link token and the number; the seller's id comes from the seller's list.
  const id = (await call("/orders", { cookie: a })).json?.find((entry) => entry.orderNumber === placed.json?.orderNumber)?.id;
  return { ...placed.json, id };
};
const usdOrder = await order("USD");
const khrOrder = await order("KHR");
const cancelled = await order("USD");
check("three online orders are placed", !!usdOrder?.id && !!khrOrder?.id && !!cancelled?.id, JSON.stringify(usdOrder));
check("the buyer cancels one", (await call(`/public/orders/${cancelled.token}/cancel`, { method: "POST" })).json?.cancelled === true);

// The same buyer at the counter (Basic and up), with their phone typed another way.
sql(`update subscriptions set plan = 'basic', status = 'active' where ${subscriptionOf}`);
const counter = await call("/counter/sales", {
  method: "POST",
  cookie: a,
  body: { idempotencyKey: randomUUID(), currency: "USD", lines: [{ variantId, quantity: 2 }], payment: { method: "cash", receivedMinor: 100000 }, buyerName: name, buyerPhone: `+855 ${local.slice(1)}` },
});
check("a counter sale with their phone is made", counter.status === 200 && counter.json?.created === true, counter.raw);

const detailOf = async (id) => (await call(`/orders/${id}`, { cookie: a })).json;
const [usd, khr, sold] = [await detailOf(usdOrder.id), await detailOf(khrOrder.id), await detailOf(counter.json.id)];
const customerId = usd?.customerId;
check("online and counter orders point to the same customer", !!customerId && khr.customerId === customerId && sold.customerId === customerId, JSON.stringify([usd?.customerId, khr?.customerId, sold?.customerId]));

// Customers is on every plan: Free too.
sql(`update subscriptions set plan = 'free', status = 'trialing' where ${subscriptionOf}`);
const byPhone = await call(`/customers/page?q=${encodeURIComponent(local.slice(-5))}`, { cookie: a });
const row = byPhone.json?.rows?.find((entry) => entry.id === customerId);
check("the list works on the Free plan and finds them by part of the phone", byPhone.status === 200 && !!row, byPhone.raw.slice(0, 200));
check("their numbers count the sales only: 3 orders, the cancelled one left out", row?.orderCount === 3, JSON.stringify(row));
check("dollars and riel are kept apart", row?.spent.USD === usd.totalMinor + sold.totalMinor && row.spent.KHR === khr.totalMinor, JSON.stringify(row?.spent));
check("one customer for one phone", row?.phone === saved && byPhone.json.rows.filter((entry) => entry.phone === saved).length === 1);
check("first and last order are known", !!row?.firstOrderAt && !!row.lastOrderAt && row.firstOrderAt <= row.lastOrderAt);

const byName = (await call(`/customers/page?q=${encodeURIComponent(name.toUpperCase())}`, { cookie: a })).json;
check("found by name in any case", byName?.rows?.some((entry) => entry.id === customerId) && byName.total >= 1);
const byFullPhone = (await call(`/customers/page?q=${encodeURIComponent(`+855 ${local.slice(1, 3)} ${local.slice(3)}`)}`, { cookie: a })).json;
check("found by the phone typed with +855", byFullPhone?.rows?.some((entry) => entry.id === customerId));
const sorted = (await call("/customers/page?sort=spent&dir=desc&pageSize=100", { cookie: a })).json;
const spentMain = (entry) => entry.spent[sql(`select default_currency from stores where slug = '${slugA}'`)];
check("sorted by most spent, in the shop's main currency", sorted?.rows?.every((entry, at, rows) => at === 0 || spentMain(rows[at - 1]) >= spentMain(entry)), JSON.stringify(sorted?.rows?.map(spentMain)));
check("a sort the list doesn't declare is refused", (await call("/customers/page?sort=phone", { cookie: a })).status === 400);

const detail = (await call(`/customers/${customerId}`, { cookie: a })).json;
check("their page lists every order, the cancelled one too, newest first", detail?.orders?.length === 4 && detail.orders.every((entry, at, list) => at === 0 || list[at - 1].createdAt >= entry.createdAt), JSON.stringify(detail?.orders?.map((entry) => entry.status)));
check("their page has the same numbers as the list", detail?.orderCount === row?.orderCount && detail.spent.USD === row.spent.USD && detail.spent.KHR === row.spent.KHR);

check("another shop can't open A's customer", (await call(`/customers/${customerId}`, { cookie: b })).status === 404);
check("another shop's list never has them", !((await call(`/customers/page?q=${encodeURIComponent(name)}`, { cookie: b })).json?.rows ?? []).some((entry) => entry.id === customerId));
check("an unknown customer is not found", (await call(`/customers/${randomUUID()}`, { cookie: a })).status === 404);
check("a malformed id is refused", (await call("/customers/not-an-id", { cookie: a })).status === 400);

sql(`update subscriptions set plan = '${planBefore[0]}', status = '${planBefore[1]}' where ${subscriptionOf}`);
sql(`update platform_settings set beta_all_basic = ${beta} where id = 1`);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
