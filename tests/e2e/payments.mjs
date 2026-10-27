// KHQR end-to-end through the real API and worker (roadmap step 5), with the
// stand-in bank (KHQR_PROVIDER=fake): a KHQR order waits for payment with its
// stock held and no seller alert; paying the exact amount makes it paid (by
// the worker's bank check, never the browser), its stock a sale, and alerts
// the seller; a code that runs out cancels the order and lets the stock go; a
// wrong amount is never paid and asks an admin; money for an order the buyer
// cancelled is never paid either. PASS/FAIL lines.
// Usage: node tests/e2e/payments.mjs <api url>   (run last: the worker runs alongside it)
import { randomUUID } from "node:crypto";
import { psql, saveShopDetails } from "./lib.mjs";

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
/** Asks again until `done` holds (the worker checks the bank every few seconds), or gives up. */
async function waitFor(read, done, seconds = 20) {
  let last;
  for (let i = 0; i < seconds * 2; i += 1) {
    last = await read();
    if (done(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return last;
}

const a = await login("a");
const store = (await call("/auth/me", { cookie: a })).json.store;
const slugA = store.slug;
const bread = (await call("/products", { cookie: a })).json.find((product) => product.titleEn === "Bread").variants[0].id;
const page = async (token) => (await call(`/public/orders/${token}`)).json;
const order = (paymentMethod = "khqr") =>
  call(`/public/stores/${slugA}/orders`, {
    method: "POST",
    body: {
      idempotencyKey: randomUUID(),
      lines: [{ variantId: bread, quantity: 1 }],
      checkout: { name: "Dara", phone: "097 123 4567", currency: "KHR", fulfilment: "pickup", area: "phnom_penh", landmark: "", paymentMethod },
    },
  });
const level = () => sql(`select on_hand || ',' || reserved from stock_levels where variant_id = '${bread}'`);
const orderId = (token) => sql(`select id from orders where public_token = '${token}'`);
const attempt = (token) => sql(`select status || ',' || coalesce(issue::text, '') from payment_attempts where order_id = '${orderId(token)}'`);
const pay = (payment, amountMinor = payment.amountMinor) =>
  call(`/dev/fake-bank/${payment.testBankRef}/pay`, { method: "POST", body: { currency: payment.currency, amountMinor } });

// A's plan, the beta switch and the Bakong account are put back as they were.
const subscriptionOf = `store_id = (select id from stores where slug = '${slugA}')`;
const before = sql(`select plan || ',' || status from subscriptions where ${subscriptionOf}`).split(",");
const beta = sql("select beta_all_basic::text from platform_settings where id = 1");
sql("update platform_settings set beta_all_basic = false where id = 1");
sql(`update subscriptions set plan = 'pro', status = 'active' where ${subscriptionOf}`);

check("without a Bakong account the shop page offers no KHQR", (await call(`/public/stores/${slugA}`)).json?.ordering?.khqrReady === false);
await saveShopDetails(call, a, { bakongId: "srey@aclb" });
check("with one, and KHQR on, it does", (await call(`/public/stores/${slugA}`)).json?.ordering?.khqrReady === true);
check("the shop page still never shows the account", !JSON.stringify((await call(`/public/stores/${slugA}`)).json).includes("srey@aclb"));
check("the stand-in bank refuses a reference that isn't one", (await call("/dev/fake-bank/not-a-ref")).status === 404);

// One bread on the shelf, tracked.
await call(`/stock/track/${bread}`, { method: "DELETE", cookie: a });
await call("/stock/track", { method: "POST", cookie: a, body: { variantId: bread, onHand: 1 } });

// --- paid in full
const first = await order();
const token1 = first.json?.token;
const waiting = await page(token1);
check("a KHQR order is placed and waits for payment", first.status === 201 && waiting?.status === "awaiting_payment", first.raw);
check(
  "its page shows the code to pay: the order's exact total, 10 minutes",
  waiting?.payment?.amountMinor === waiting?.totalMinor && waiting?.payment?.currency === "KHR" && waiting.payment.qrPayload.startsWith("FAKE-KHQR|srey@aclb|KHR|") && Math.abs(Date.parse(waiting.payment.expiresAt) - Date.now() - 600_000) < 30_000,
  JSON.stringify(waiting?.payment),
);
check("its stock is held, not taken", level() === "1,1");
check("buyers now see none free", (await call(`/public/stores/${slugA}`)).json?.stock?.[bread] === 0);
check("another order can't have the held one", (await order()).json?.fields?.["lines.0"] === "sold_out");
check("the seller isn't alerted before the money lands", sql(`select count(*) from outbox_events where kind = 'order_placed' and payload->>'orderId' = '${orderId(token1)}'`) === "0");
check("the stand-in bank says nothing paid yet", (await call(`/dev/fake-bank/${waiting.payment.testBankRef}`)).json?.paid === false);

await pay(waiting.payment);
const paid = await waitFor(() => page(token1), (o) => o?.status === "paid");
check("paying the exact amount makes it paid, by the worker's bank check", paid?.status === "paid" && paid.payment === null, paid?.status);
check("its held stock became a sale", level() === "0,0");
check("and only now the seller is alerted", sql(`select count(*) from outbox_events where kind = 'order_placed' and payload->>'orderId' = '${orderId(token1)}'`) === "1");

// --- the code runs out
await call("/stock/changes", { method: "POST", cookie: a, body: { variantId: bread, type: "purchase", quantity: 3 } });
const second = await order();
const token2 = second.json?.token;
sql(`update payment_attempts set expires_at = now() - interval '1 second' where order_id = '${orderId(token2)}'`);
const timedOut = await waitFor(() => page(token2), (o) => o?.status === "cancelled");
check("an unpaid code that ran out cancels the order", timedOut?.status === "cancelled" && timedOut.cancelReason === "payment_timeout", timedOut?.status);
check("and lets its stock go", level() === "3,0");
check("the attempt is marked expired", attempt(token2) === "expired,");

// --- a wrong amount
const third = await order();
const token3 = third.json?.token;
await pay((await page(token3)).payment, 100);
const wrong = await waitFor(() => page(token3), (o) => o?.status !== "awaiting_payment");
check("a wrong amount is never paid", wrong?.status === "cancelled", wrong?.status);
check("it's recorded for a person to look at", attempt(token3) === "failed,amount_mismatch");
check("an admin is alerted", sql(`select count(*) from outbox_events where kind = 'admin_alert' and payload->>'reason' = 'payment_issue' and payload->>'issue' = 'amount_mismatch'`) !== "0");
check("its stock went back", level() === "3,0");

// --- the buyer cancels, then pays anyway
const fourth = await order();
const token4 = fourth.json?.token;
const unpaid = (await page(token4)).payment;
check("the buyer may cancel while it waits", (await call(`/public/orders/${token4}/cancel`, { method: "POST" })).status === 200);
check("cancelling lets the held stock go at once", level() === "3,0");
await pay(unpaid);
await waitFor(() => attempt(token4), (row) => row !== "pending,");
check("money for a cancelled order is never paid: a person looks", attempt(token4) === "failed,paid_after_expiry" && (await page(token4))?.status === "cancelled");

// --- cash on delivery is unchanged
const cod = await order("cod");
check("a cash order still takes its stock at once and alerts the seller", cod.status === 201 && level() === "2,0" && sql(`select count(*) from outbox_events where kind = 'order_placed' and payload->>'orderId' = '${orderId(cod.json.token)}'`) === "1");

await call(`/stock/track/${bread}`, { method: "DELETE", cookie: a });
await saveShopDetails(call, a, { bakongId: "" });
sql(`update platform_settings set beta_all_basic = ${beta === "true"} where id = 1`);
sql(`update subscriptions set plan = '${before[0]}', status = '${before[1]}' where ${subscriptionOf}`);
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
