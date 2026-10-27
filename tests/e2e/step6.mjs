// Step 6 part A end-to-end through the real API: an order's whole journey,
// refused steps, the buyer cancelling, another shop, a paused shop, and the
// Telegram messages queued for the worker. PASS/FAIL lines.
// Usage: node tests/e2e/step6.mjs <api url>    (after step2/3/4 on the same database)
import { randomUUID } from "node:crypto";
import { psql } from "./lib.mjs";

const B = process.argv[2] ?? "http://localhost:4105";
const sql = (query) => psql(query).trim();
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
};
async function call(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(B + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
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
const shop = (await call(`/public/stores/${slugA}`)).json;
const bread = shop.products.find((p) => p.titleEn === "Bread").variants[0].id;

async function placeOrder(extra = {}) {
  const placed = await call(`/public/stores/${slugA}/orders`, {
    method: "POST",
    body: {
      idempotencyKey: randomUUID(),
      lines: [{ variantId: bread, quantity: 1 }],
      checkout: { name: "Dara", phone: "097 123 4567", currency: "USD", fulfilment: "delivery", area: "phnom_penh", districtId: "daun-penh", landmark: "", paymentMethod: "cod", ...extra },
    },
  });
  const token = placed.json.token;
  const list = (await call("/orders", { cookie: a })).json;
  const id = list.find((order) => order.orderNumber === placed.json.orderNumber).id;
  return { token, id };
}
const act = (id, body, cookie = a) => call(`/orders/${id}/actions`, { method: "POST", cookie, body });
const status = async (id) => (await call(`/orders/${id}`, { cookie: a })).json?.status;

// ---------------------------------------------------------------- a delivery order, start to end
const outboxBefore = Number(sql("select count(*) from outbox_events where kind = 'order_placed'"));
const first = await placeOrder();
check("placing an order queues one new-order message for the worker", Number(sql("select count(*) from outbox_events where kind = 'order_placed'")) === outboxBefore + 1);
const payload = sql(`select payload::text from outbox_events where payload->>'orderId' = '${first.id}'`);
check("the queued message holds only the order id — no name or phone", payload === `{"orderId": "${first.id}"}`, payload);

const detail = (await call(`/orders/${first.id}`, { cookie: a })).json;
check("the order detail lists the next steps and how it must be sent", JSON.stringify(detail?.actions) === '["confirm","cancel"]' && detail.route === "driver" && detail.buyerPhone === "855971234567", JSON.stringify(detail?.actions));
check("a step that doesn't follow is refused (409 action_not_allowed)", (await act(first.id, { action: "start_packing" })).json?.error === "action_not_allowed");
check("confirm → confirmed", (await act(first.id, { action: "confirm" })).json?.status === "confirmed");
check("confirming twice is refused, nothing changes", (await act(first.id, { action: "confirm" })).status === 409 && (await status(first.id)) === "confirmed");
check("start packing → packing", (await act(first.id, { action: "start_packing" })).json?.status === "packing");
check("sending it another way than the buyer chose is refused", (await act(first.id, { action: "dispatch", dispatch: { route: "pickup" } })).json?.error === "action_not_allowed");
const badDriver = await act(first.id, { action: "dispatch", dispatch: { route: "driver", driverName: "D", driverPhone: "1" } });
check("a driver needs a name and a real phone", badDriver.json?.fields?.["dispatch.driverName"] === "too_short" && badDriver.json.fields["dispatch.driverPhone"] === "phone_invalid", badDriver.raw);
const sent = await act(first.id, { action: "dispatch", dispatch: { route: "driver", driverName: "Dara S.", driverPhone: "012 345 678" } });
check("send to the shop's saved driver → waiting for driver, the driver linked", sent.json?.status === "waiting_for_driver" && sent.json.dispatches?.[0]?.driverPhone === "85512345678", sent.raw);
check("the dispatch is linked to the saved driver", sql(`select (driver_id is not null)::text from delivery_dispatches where order_id = '${first.id}'`) === "true");
check("driver picked up → out for delivery", (await act(first.id, { action: "driver_picked_up" })).json?.status === "out_for_delivery");
const buyerPage = (await call(`/public/orders/${first.token}`)).json;
check("the buyer's page shows the new status and the driver's name — not the driver's phone", buyerPage?.status === "out_for_delivery" && buyerPage.dispatch?.driverName === "Dara S." && !JSON.stringify(buyerPage).includes("85512345678"), JSON.stringify(buyerPage?.dispatch));
check("the buyer can't cancel an order that's on its way", buyerPage?.canCancel === false && (await call(`/public/orders/${first.token}/cancel`, { method: "POST" })).status === 409);
check("delivered → a cash order waits for the cash", (await act(first.id, { action: "mark_delivered" })).json?.status === "delivered");
const done = await act(first.id, { action: "settle_cash" });
check("cash collected → completed, nothing left to do", done.json?.status === "completed" && done.json.actions.length === 0);
check("the history has every step, by the merchant", JSON.stringify(done.json?.events?.map((e) => e.status)) === '["cod_pending","confirmed","packing","waiting_for_driver","out_for_delivery","delivered","completed"]' && done.json.events.slice(1).every((e) => e.actor === "merchant"));
check("the dispatch records pickup and delivery times", sql(`select (picked_up_at is not null and delivered_at is not null)::text from delivery_dispatches where order_id = '${first.id}'`) === "true");
check("every step is in the audit log", Number(sql(`select count(*) from audit_logs where entity_id = '${first.id}'::text and action like 'order.%'`)) === 6);

// ---------------------------------------------------------------- pickup, failed delivery, rebook
const pickup = await placeOrder({ fulfilment: "pickup", districtId: undefined });
for (const action of ["confirm", "start_packing"]) await act(pickup.id, { action });
check("a pickup order is 'sent' as ready for pickup", (await act(pickup.id, { action: "dispatch", dispatch: { route: "pickup" } })).json?.status === "out_for_delivery");
check("not collected → failed delivery", (await act(pickup.id, { action: "fail_delivery" })).json?.status === "failed_delivery");
check("rebook → back to packing", (await act(pickup.id, { action: "rebook" })).json?.status === "packing");

// ---------------------------------------------------------------- cancelling
const toCancel = await placeOrder();
const page = (await call(`/public/orders/${toCancel.token}`)).json;
check("a new cash order offers the buyer a cancel", page?.canCancel === true);
check("the buyer cancels it", (await call(`/public/orders/${toCancel.token}/cancel`, { method: "POST" })).json?.cancelled === true);
const cancelledPage = (await call(`/public/orders/${toCancel.token}`)).json;
check("the buyer's page shows it cancelled by the buyer", cancelledPage?.status === "cancelled" && cancelledPage.cancelReason === "buyer_cancelled" && cancelledPage.canCancel === false);
check("cancelling twice is refused", (await call(`/public/orders/${toCancel.token}/cancel`, { method: "POST" })).status === 409);
check("the seller is told: a buyer-cancelled message is queued", Number(sql(`select count(*) from outbox_events where kind = 'order_cancelled_by_buyer' and payload->>'orderId' = '${toCancel.id}'`)) === 1);
check("a malformed order link can't cancel anything", (await call("/public/orders/1/cancel", { method: "POST" })).status === 404);

const sellerCancel = await placeOrder();
check("a seller's 'other' reason needs a note", (await act(sellerCancel.id, { action: "cancel", cancellation: { reason: "other", note: "" } })).json?.fields?.["cancellation.note"] === "required");
check("a seller can't use the buyer's or the system's reason", (await act(sellerCancel.id, { action: "cancel", cancellation: { reason: "payment_timeout", note: "" } })).json?.fields?.["cancellation.reason"] === "reason_required");
const sc = await act(sellerCancel.id, { action: "cancel", cancellation: { reason: "out_of_stock", note: "Sold out today" } });
check("the seller cancels with a reason the buyer sees", sc.json?.status === "cancelled" && (await call(`/public/orders/${sellerCancel.token}`)).json?.cancelReason === "out_of_stock");

// ---------------------------------------------------------------- other shop, paused shop
const another = await placeOrder();
check("another shop can't read the order", (await call(`/orders/${another.id}`, { cookie: b })).status === 404);
check("another shop can't move it", (await act(another.id, { action: "confirm" }, b)).status === 404 && (await status(another.id)) === "cod_pending");
check("a bad order id is refused", (await call("/orders/not-a-uuid", { cookie: a })).status === 400);
const storeA = sql(`select id from stores where slug = '${slugA}'`);
sql(`update subscriptions set status = 'paused' where store_id = '${storeA}'`);
check("a paused shop can read its orders but not move them", (await call(`/orders/${another.id}`, { cookie: a })).status === 200 && (await act(another.id, { action: "confirm" })).json?.error === "store_paused");
sql(`update subscriptions set status = 'trialing' where store_id = '${storeA}'`);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
