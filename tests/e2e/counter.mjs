// Sell in shop end-to-end through the real API (design/screens.md P1–P4):
// the plan gate, a cash sale with its change, too little cash, the same key
// twice, the shop's QR with and without the seller's tick, a walk-in buyer's
// phone joining the customers, today's totals, the receipt, the "In shop"
// filter, void, and another shop kept out. PASS/FAIL lines.
// Usage: node tests/e2e/counter.mjs <api url>   (run after step4 on the same database)
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
const storeA = (await call("/auth/me", { cookie: a })).json.store;
const products = (await call("/products", { cookie: a })).json;
const bread = products.find((product) => product.titleEn === "Bread");
const variant = bread.variants[0];
const lines = [{ variantId: variant.id, quantity: 2 }];
const sale = (payment, extra = {}) => ({ idempotencyKey: randomUUID(), currency: "USD", lines, payment, buyerName: "", buyerPhone: "", ...extra });

// The beta switch lifts Free to Basic: off for this check. It and A's
// subscription are put back exactly as they were, for the scripts after this one.
const beta = sql("select beta_all_basic::text from platform_settings where id = 1");
const subscriptionOf = `store_id = (select id from stores where slug = '${storeA.slug}')`;
const before = sql(`select plan || ',' || status from subscriptions where ${subscriptionOf}`).split(",");
sql("update platform_settings set beta_all_basic = false where id = 1");
sql(`update subscriptions set plan = 'free', status = 'trialing' where ${subscriptionOf}`);
const free = await call("/counter/sales", { method: "POST", cookie: a, body: sale({ method: "cash", receivedMinor: 10000 }) });
check("selling in the shop is refused on Free (plan_limit)", free.status === 403 && free.json?.error === "plan_limit", free.raw);
sql(`update subscriptions set plan = 'basic', status = 'active' where ${subscriptionOf}`);

const store = (await call("/store", { cookie: a })).json;
// Bread $1.25 × 2 = 250; VAT at the shop's rate.
const total = 250 + Math.round(250 * (store.vatPercent / 100));
const short = await call("/counter/sales", { method: "POST", cookie: a, body: sale({ method: "cash", receivedMinor: total - 1 }) });
check("too little cash is refused, whatever the phone said", short.json?.fields?.["payment.receivedMinor"] === "cash_short", short.raw);

const cashSale = sale({ method: "cash", receivedMinor: 1000 }, { buyerName: "Walk-in", buyerPhone: "011 222 333" });
const sold = await call("/counter/sales", { method: "POST", cookie: a, body: cashSale });
check("a cash sale is saved with the server's total and the change", sold.status === 200 && sold.json?.totalMinor === total && sold.json.changeMinor === 1000 - total && sold.json.created === true, sold.raw);
const again = await call("/counter/sales", { method: "POST", cookie: a, body: cashSale });
check("the same sale sent again gives the same sale, not a second one", again.json?.id === sold.json?.id && again.json.created === false, again.raw);
check("the buyer who gave a phone joins the shop's customers", sql(`select count(*) from customers where phone = '85511222333' and store_id = (select id from stores where slug = '${storeA.slug}')`) === "1");
check("a counter sale sends no Telegram alert", sql(`select count(*) from outbox_events where payload->>'orderId' = '${sold.json?.id}'`) === "0");

const unticked = await call("/counter/sales", { method: "POST", cookie: a, body: sale({ method: "shop_qr", sellerConfirmed: false }) });
check("the shop's QR needs the seller's tick", unticked.json?.fields?.["payment.sellerConfirmed"] === "required", unticked.raw);
const qr = await call("/counter/sales", { method: "POST", cookie: a, body: sale({ method: "shop_qr", sellerConfirmed: true }, { currency: "KHR" }) });
check("a shop QR sale in riel is saved, with no change", qr.status === 200 && qr.json?.currency === "KHR" && qr.json.changeMinor === null, qr.raw);

const day = (await call("/counter/sales/today", { cookie: a })).json;
check("today's totals: cash and shop QR apart, dollars and riel apart", day?.totals?.all?.count === 2 && day.totals.cash.USD === total && day.totals.shopQr.KHR === qr.json?.totalMinor && day.totals.cash.KHR === 0, JSON.stringify(day?.totals));

const receipt = (await call(`/orders/${sold.json?.id}/invoice`, { cookie: a })).json?.order;
check("the receipt is an in-shop cash sale with what was received and the change", receipt?.channel === "in_store" && receipt.paymentMethod === "cash" && receipt.cashReceivedMinor === 1000 && receipt.changeMinor === 1000 - total && receipt.state === "paid", JSON.stringify(receipt));
const inShop = (await call("/orders/page?f.fulfilment=in_store", { cookie: a })).json;
const online = (await call("/orders/page?f.payment=online", { cookie: a })).json;
const rows = (page) => (Array.isArray(page) ? page : page?.rows ?? []);
check("the orders list's \"In shop\" filter finds them, \"Paid online\" doesn't", rows(inShop).length === 2 && rows(online).every((row) => row.channel === "online"), JSON.stringify(inShop).slice(0, 200));

check("another shop can't void A's sale", (await call(`/counter/sales/${sold.json?.id}/void`, { method: "POST", cookie: b })).status === 409);
const voided = await call(`/counter/sales/${sold.json?.id}/void`, { method: "POST", cookie: a });
check("the seller voids a sale", voided.json?.voided === true, voided.raw);
check("a sale can't be voided twice", (await call(`/counter/sales/${sold.json?.id}/void`, { method: "POST", cookie: a })).status === 409);
const after = (await call("/counter/sales/today", { cookie: a })).json;
check("a voided sale stays listed but isn't counted", after?.totals?.all?.count === 1 && after.sales.some((row) => row.id === sold.json?.id && row.voided));
check("B sees none of A's counter sales", (await call("/counter/sales/today", { cookie: b })).json?.sales?.length === 0);

sql(`update platform_settings set beta_all_basic = ${beta === "true"} where id = 1`);
sql(`update subscriptions set plan = '${before[0]}', status = '${before[1]}' where ${subscriptionOf}`);
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
