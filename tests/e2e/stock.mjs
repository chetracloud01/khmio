// Stock end-to-end through the real API (design/screens.md S13; roadmap Pro
// plan): the plan gate; tracking an option from a count; the shop page's
// "sold out" stock; an online order and a counter sale taking stock and being
// refused when there isn't enough; cancel and void putting it back; stock in
// and corrections; another shop kept out. PASS/FAIL lines.
// Usage: node tests/e2e/stock.mjs <api url>   (run after counter on the same database)
import { randomUUID } from "node:crypto";
import { psql } from "./lib.mjs";

const B = process.argv[2] ?? "http://localhost:4105";
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
};
const sql = (query) => psql(query).trim();
async function call(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(B + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json, raw: text };
}
async function login(who) {
  const r = await fetch(B + "/auth/dev-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ as: who }) });
  return r.headers.get("set-cookie").split(";")[0];
}

const a = await login("a");
const b = await login("b");
const slugA = (await call("/auth/me", { cookie: a })).json.store.slug;
const bread = (await call("/products", { cookie: a })).json.find((product) => product.titleEn === "Bread").variants[0].id;
const onHand = async () => (await call("/stock", { cookie: a })).json?.items?.find((item) => item.variantId === bread)?.onHand;
const order = (quantity) =>
  call(`/public/stores/${slugA}/orders`, {
    method: "POST",
    body: {
      idempotencyKey: randomUUID(),
      lines: [{ variantId: bread, quantity }],
      checkout: { name: "Dara", phone: "097 123 4567", currency: "USD", fulfilment: "pickup", area: "phnom_penh", landmark: "", paymentMethod: "cod" },
    },
  });
const counter = (quantity) =>
  call("/counter/sales", {
    method: "POST",
    cookie: a,
    body: { idempotencyKey: randomUUID(), currency: "USD", lines: [{ variantId: bread, quantity }], payment: { method: "cash", receivedMinor: 100000 }, buyerName: "", buyerPhone: "" },
  });

// A's plan and the beta switch are put back exactly as they were, for the scripts after this one.
const subscriptionOf = `store_id = (select id from stores where slug = '${slugA}')`;
const before = sql(`select plan || ',' || status from subscriptions where ${subscriptionOf}`).split(",");
const beta = sql("select beta_all_basic::text from platform_settings where id = 1");
sql("update platform_settings set beta_all_basic = false where id = 1");
sql(`update subscriptions set plan = 'basic', status = 'active' where ${subscriptionOf}`);

const basic = await call("/stock/track", { method: "POST", cookie: a, body: { variantId: bread, onHand: 2 } });
check("stock is refused on Basic (plan_limit)", basic.status === 403 && basic.json?.error === "plan_limit", basic.raw);
check("on Basic the page is readable, locked", (await call("/stock", { cookie: a })).json?.tracksStock === false);
check("the shop page shows no stock on Basic", Object.keys((await call(`/public/stores/${slugA}`)).json?.stock ?? { x: 1 }).length === 0);

sql(`update subscriptions set plan = 'pro', status = 'active' where ${subscriptionOf}`);
check("an option starts untracked", (await onHand()) === null);
const tracked = await call("/stock/track", { method: "POST", cookie: a, body: { variantId: bread, onHand: 2 } });
check("on Pro the seller starts tracking from a count", tracked.status === 200 && (await onHand()) === 2, tracked.raw);
check("starting twice is refused", (await call("/stock/track", { method: "POST", cookie: a, body: { variantId: bread, onHand: 5 } })).status === 409);
check("the shop page tells buyers how many are left", (await call(`/public/stores/${slugA}`)).json?.stock?.[bread] === 2);

const tooMany = await order(3);
check("an online order for more than is left is refused as sold out", tooMany.json?.fields?.["lines.0"] === "sold_out", tooMany.raw);
check("a refused order takes nothing", (await onHand()) === 2);
const placed = await order(2);
check("an order for what's left is placed and takes it", placed.status === 201 && (await onHand()) === 0, placed.raw);
check("then the shop page says sold out", (await call(`/public/stores/${slugA}`)).json?.stock?.[bread] === 0);
check("a counter sale can't take what isn't there", (await counter(1)).json?.fields?.["lines.0"] === "sold_out");

const orderId = (await call("/orders", { cookie: a })).json.find((row) => row.orderNumber === placed.json.orderNumber).id;
const cancelled = await call(`/orders/${orderId}/actions`, { method: "POST", cookie: a, body: { action: "cancel", cancellation: { reason: "out_of_stock", note: "" } } });
check("cancelling the order puts its stock back", cancelled.json?.status === "cancelled" && (await onHand()) === 2, cancelled.raw);

const sold = await counter(1);
check("a counter sale takes stock", sold.status === 200 && (await onHand()) === 1, sold.raw);
await call(`/counter/sales/${sold.json?.id}/void`, { method: "POST", cookie: a });
check("voiding it puts it back", (await onHand()) === 2);

const purchase = await call("/stock/changes", { method: "POST", cookie: a, body: { variantId: bread, type: "purchase", quantity: 10, note: "Supplier #1042" } });
check("stock in adds to the count", purchase.status === 200 && (await onHand()) === 12, purchase.raw);
check("a correction needs a reason", (await call("/stock/changes", { method: "POST", cookie: a, body: { variantId: bread, type: "adjust_out", quantity: 1 } })).json?.fields?.reason === "reason_required");
const tooMuch = await call("/stock/changes", { method: "POST", cookie: a, body: { variantId: bread, type: "adjust_out", quantity: 13, reason: "damaged" } });
check("a correction can't take the count below zero", tooMuch.json?.fields?.quantity === "not_enough_stock" && (await onHand()) === 12, tooMuch.raw);
const damaged = await call("/stock/changes", { method: "POST", cookie: a, body: { variantId: bread, type: "adjust_out", quantity: 2, reason: "damaged" } });
check("a correction with its reason saves", damaged.status === 200 && (await onHand()) === 10);
const history = (await call("/stock", { cookie: a })).json?.movements ?? [];
check("the history shows every change, newest first", history[0]?.type === "adjust_out" && history[0].reason === "damaged" && history.some((row) => row.type === "sale" && row.inStore) && history.some((row) => row.reason === "returned"));

check("another shop can't change A's stock", (await call("/stock/changes", { method: "POST", cookie: b, body: { variantId: bread, type: "purchase", quantity: 1 } })).status !== 200 && (await onHand()) === 10);
const stopped = await call(`/stock/track/${bread}`, { method: "DELETE", cookie: a });
check("stopping tracking sells without a limit again", stopped.status === 200 && (await onHand()) === null && (await call(`/public/stores/${slugA}`)).json?.stock?.[bread] === undefined);

sql(`update platform_settings set beta_all_basic = ${beta === "true"} where id = 1`);
sql(`update subscriptions set plan = '${before[0]}', status = '${before[1]}' where ${subscriptionOf}`);
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
