// Release 1 complete, part A1, end to end: sharing the shop link, a paused
// shop closing for buyers, Telegram group and follow links, status updates
// queued for followers. Usage: node tests/e2e/r1a.mjs <api url>
import { psql } from "./lib.mjs";
import { randomUUID } from "node:crypto";

const B = process.argv[2] ?? "http://localhost:4105";
const sql = (q) => psql(q).split(/\r?\n/)[0].trim();
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

const a = await login("a");
const b = await login("b");
const slugA = (await call("/auth/me", { cookie: a })).json.store.slug;
const storeA = sql(`select id from stores where slug = '${slugA}'`);

// ---------------------------------------------------------------- share your shop link
check("a shop not ready to share can't mark its link shared (B has no products)", (await call("/store/link-shared", { method: "POST", cookie: b })).json?.error === "action_not_allowed");
const before = (await call("/store", { cookie: a })).json;
check("A starts not shared", before?.linkShared === false, JSON.stringify(before?.readiness));
check("A, ready for buyers, shares its link", (await call("/store/link-shared", { method: "POST", cookie: a })).json?.linkShared === true);
check("the checklist now counts it as shared", (await call("/store", { cookie: a })).json?.linkShared === true);

// ---------------------------------------------------------------- Telegram groups and follow links
const groupLink = await call("/store/telegram-groups/link", { method: "POST", cookie: a });
check("'Add to your staff group' gives a t.me startgroup link with a one-time code", /^https:\/\/t\.me\/\w+\?startgroup=g_[A-Za-z0-9_-]{24}$/.test(groupLink.json?.link ?? ""), groupLink.raw);
check("only the code's hash is stored, for this shop", sql(`select count(*) from telegram_link_codes where store_id = '${storeA}' and kind = 'group_link'`) === "1" && !sql("select string_agg(code_hash, ',') from telegram_link_codes").includes(groupLink.json.link.split("=")[1]));
sql(`insert into store_alert_chats (store_id, chat_id, title) values ('${storeA}', '-100123', 'A staff')`);
const groups = (await call("/store/telegram-groups", { cookie: a })).json;
check("the shop lists its staff groups", groups?.length === 1 && groups[0].title === "A staff");
check("another shop can't see or unlink them", (await call("/store/telegram-groups", { cookie: b })).json?.length === 0 && (await call(`/store/telegram-groups/${groups[0].id}`, { method: "DELETE", cookie: b })).status === 404);
check("the owner unlinks a group", (await call(`/store/telegram-groups/${groups[0].id}`, { method: "DELETE", cookie: a })).json?.unlinked === true);

const shop = (await call(`/public/stores/${slugA}`)).json;
check("an open shop says so on its page", shop?.open === true);
const variant = shop.products.find((p) => !p.hasOptions)?.variants[0]?.id;
const placed = await call(`/public/stores/${slugA}/orders`, {
  method: "POST",
  body: { idempotencyKey: randomUUID(), lines: [{ variantId: variant, quantity: 1 }], checkout: { name: "Dara", phone: "097 123 4567", currency: "USD", fulfilment: "delivery", area: "phnom_penh", districtId: "daun-penh", landmark: "", paymentMethod: "cod" } },
});
const token = placed.json?.token;
check("an order can be placed in an open shop", placed.status === 201, placed.raw);
check("its page says it isn't followed on Telegram yet", (await call(`/public/orders/${token}`)).json?.followingOnTelegram === false);
const followLink = await call(`/public/orders/${token}/telegram-link`, { method: "POST" });
check("'Get updates on Telegram' gives a t.me start link with a one-time code", /^https:\/\/t\.me\/\w+\?start=f_[A-Za-z0-9_-]{24}$/.test(followLink.json?.link ?? ""), followLink.raw);
check("an unknown order link gets none", (await call(`/public/orders/${"x".repeat(32)}/telegram-link`, { method: "POST" })).status === 404);
const orderId = sql(`select id from orders where public_token = '${token}'`);
sql(`insert into order_followers (store_id, order_id, chat_id) values ('${storeA}', '${orderId}', '555')`);
check("once followed, the page says so", (await call(`/public/orders/${token}`)).json?.followingOnTelegram === true);

// ---------------------------------------------------------------- status changes reach followers
const sellerId = (await call("/orders", { cookie: a })).json.find((o) => o.orderNumber === placed.json.orderNumber).id;
await call(`/orders/${sellerId}/actions`, { method: "POST", cookie: a, body: { action: "confirm" } });
check("a seller's step queues a status update for followers", sql(`select count(*) from outbox_events where kind = 'order_status_changed' and payload->>'orderId' = '${orderId}' and payload->>'status' = 'confirmed'`) === "1");
const another = await call(`/public/stores/${slugA}/orders`, {
  method: "POST",
  body: { idempotencyKey: randomUUID(), lines: [{ variantId: variant, quantity: 1 }], checkout: { name: "Dara", phone: "097 123 4567", currency: "USD", fulfilment: "pickup", area: "phnom_penh", landmark: "", paymentMethod: "cod" } },
});
await call(`/public/orders/${another.json.token}/cancel`, { method: "POST" });
const anotherId = sql(`select id from orders where public_token = '${another.json.token}'`);
check("a buyer's own cancel queues a status update too", sql(`select count(*) from outbox_events where kind = 'order_status_changed' and payload->>'orderId' = '${anotherId}' and payload->>'status' = 'cancelled'`) === "1");

// ---------------------------------------------------------------- a paused shop closes
sql(`update subscriptions set status = 'paused' where store_id = '${storeA}'`);
check("a paused shop's page says it's closed", (await call(`/public/stores/${slugA}`)).json?.open === false);
const refused = await call(`/public/stores/${slugA}/orders`, {
  method: "POST",
  body: { idempotencyKey: randomUUID(), lines: [{ variantId: variant, quantity: 1 }], checkout: { name: "Dara", phone: "097 123 4567", currency: "USD", fulfilment: "pickup", area: "phnom_penh", landmark: "", paymentMethod: "cod" } },
});
check("and refuses orders (409 store_closed)", refused.status === 409 && refused.json?.error === "store_closed", refused.raw);
check("its seller can't make a group link while paused", (await call("/store/telegram-groups/link", { method: "POST", cookie: a })).json?.error === "store_paused");
sql(`update subscriptions set status = 'trialing' where store_id = '${storeA}'`);
check("reopened, it takes orders again", (await call(`/public/stores/${slugA}`)).json?.open === true);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
