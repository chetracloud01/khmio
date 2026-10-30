// Stock going up or down for a reason, and opening stock, end to end through the real API
// (design/screens.md S13 "Change stock", "Set opening stock"): every reason each way, a
// reason the wrong way, "Other" without a note, the cost left alone; opening stock for one
// item and many, with and without a cost, in the product's currency only, never twice; a
// count starting an item; the database's own rule on costs. Its own fresh products.
// PASS/FAIL lines. Usage: node tests/e2e/stock-changes.mjs <api url>
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
/** Whether the database refuses a query (as its owner: checks). */
const refuses = (query) => {
  try {
    psql(query);
    return false;
  } catch {
    return true;
  }
};

const a = await login("a");
const slugA = (await call("/auth/me", { cookie: a })).json.store.slug;
const subscriptionOf = `store_id = (select id from stores where slug = '${slugA}')`;
const before = sql(`select plan || ',' || status from subscriptions where ${subscriptionOf}`).split(",");
const beta = sql("select beta_all_basic::text from platform_settings where id = 1");
const modulesBefore = (await call("/store", { cookie: a })).json?.modules ?? [];
// Put back even if a check below throws, so the scripts after this one start from what they expect.
process.on("exit", () => {
  sql(`update platform_settings set beta_all_basic = ${beta === "true"} where id = 1`);
  sql(`update subscriptions set plan = '${before[0]}', status = '${before[1]}' where ${subscriptionOf}`);
});
sql("update platform_settings set beta_all_basic = false where id = 1");
sql(`update subscriptions set plan = 'pro', status = 'active' where ${subscriptionOf}`);

const categoryId = (await call("/catalog", { cookie: a })).json.categories[0].id;
const tag = randomUUID().slice(0, 6);
await call("/store/modules", { method: "PUT", cookie: a, body: { modules: [...new Set([...modulesBefore, "services"])] } });
const makeItem = async (titleEn, extra = {}) => {
  const id = (await call("/products", { method: "POST", cookie: a, body: { product: { titleKm: titleEn, titleEn, categoryId, retailPriceUsdCents: 1500, ...extra }, photoKeys: [] } })).json?.id;
  return (await call(`/products/${id}`, { cookie: a })).json?.variants?.[0]?.id;
};
const [filters, belts, bulbs, wipers, plugs, service] = [
  await makeItem(`Filters ${tag}`),
  await makeItem(`Belts ${tag}`),
  await makeItem(`Bulbs ${tag}`, { costMinor: 2_000, costCurrency: "KHR" }),
  await makeItem(`Wipers ${tag}`),
  await makeItem(`Plugs ${tag}`),
  await makeItem(`Wash ${tag}`, { kind: "service" }),
];
check("the suite's own products are made", [filters, belts, bulbs, wipers, plugs, service].every(Boolean));

const item = async (variantId) => (await call("/stock", { cookie: a })).json?.items?.find((entry) => entry.variantId === variantId);
const lastMove = async (variantId) => (await call(`/stock/items/${variantId}`, { cookie: a })).json?.movements?.[0];
const open = (body) => call("/stock/track", { method: "POST", cookie: a, body });
const change = (variantId, type, reason, quantity = 1, note) => call("/stock/changes", { method: "POST", cookie: a, body: { variantId, type, quantity, reason, ...(note ? { note } : {}) } });

// ── Opening stock ──────────────────────────────────────────────────────────
const opened = await open({ variantId: filters, onHand: 40, unitCost: 450, costCurrency: "USD" });
const filtersNow = await item(filters);
const openingMove = await lastMove(filters);
check(
  "opening stock with its cost: 40 on the shelf at $4.50 — tracked, costed, written as opening stock (no bill)",
  opened.status === 200 && filtersNow?.onHand === 40 && filtersNow.costMinor === 450 && filtersNow.costCurrency === "USD" && openingMove?.reason === "opening_stock" && openingMove.unitCostMinor === 450 && openingMove.purchaseId === null,
  JSON.stringify(openingMove),
);
await open({ variantId: belts, onHand: 6 });
check("opening stock without a cost: counted, no cost yet (the first bill will set it)", (await item(belts))?.onHand === 6 && (await item(belts))?.costMinor === null && (await lastMove(belts))?.unitCostMinor === null);
check("an item already tracked can't be opened again", (await open({ variantId: filters, onHand: 1 })).status === 409 && (await item(filters))?.onHand === 40);
const otherCurrency = await open({ variantId: bulbs, onHand: 5, unitCost: 100, costCurrency: "USD" });
check("an opening cost in the other currency than the product's is refused, nothing tracked", otherCurrency.json?.fields?.unitCost === "cost_currency_mismatch" && (await item(bulbs))?.onHand === null, otherCurrency.raw);
check("an opening cost needs its currency", (await open({ variantId: bulbs, onHand: 5, unitCost: 100 })).json?.fields?.costCurrency === "required");
check("a service has no opening stock (nothing on a shelf)", (await open({ variantId: service, onHand: 5 })).status === 409);

const many = await call("/stock/track-many", { method: "POST", cookie: a, body: { items: [{ variantId: bulbs, onHand: 12, unitCost: 2_100, costCurrency: "KHR" }, { variantId: wipers, onHand: 8, unitCost: 650, costCurrency: "USD" }] } });
check("opening stock for many at once, each with its own count and cost", many.status === 200 && (await item(bulbs))?.costMinor === 2_100 && (await item(bulbs))?.onHand === 12 && (await item(wipers))?.costMinor === 650, many.raw);
const manyNoCurrency = await call("/stock/track-many", { method: "POST", cookie: a, body: { items: [{ variantId: plugs, onHand: 3, unitCost: 100 }] } });
check("one of many without its cost's currency refuses them all", manyNoCurrency.json?.fields?.["items.0.costCurrency"] === "required" && (await item(plugs))?.onHand === null, manyNoCurrency.raw);
/** A stock count applied at once (design/screens.md S13 "Count stock"): started (or the open draft), these lines, applied. */
const applyCount = async (lines, cookie = a) => {
  const count = (await call("/stock/counts", { method: "POST", cookie, body: {} })).json;
  await call(`/stock/counts/${count?.id}/lines`, { method: "PUT", cookie, body: { lines } });
  return call(`/stock/counts/${count?.id}/apply`, { method: "POST", cookie });
};
await applyCount([{ variantId: plugs, counted: 9 }]);
check("a count starts an item not tracked yet as its opening stock (no cost)", (await item(plugs))?.onHand === 9 && (await lastMove(plugs))?.reason === "opening_stock" && (await lastMove(plugs))?.unitCostMinor === null);

// ── Went up or down, for a reason ──────────────────────────────────────────
const ups = ["count_correction", "returned", "free_goods"];
const downs = ["damaged", "expired", "lost", "own_use", "given_away", "count_correction"];
let expected = 40;
const upsSaved = [];
for (const reason of ups) {
  const saved = await change(filters, "adjust_in", reason, 2);
  expected += 2;
  upsSaved.push(saved.status === 200 && (await lastMove(filters))?.reason === reason);
}
check("every reason stock goes up saves, and the history keeps it", upsSaved.every(Boolean) && (await item(filters))?.onHand === expected, JSON.stringify(upsSaved));
const downsSaved = [];
for (const reason of downs) {
  const saved = await change(filters, "adjust_out", reason, 1);
  expected -= 1;
  downsSaved.push(saved.status === 200 && (await lastMove(filters))?.reason === reason && (await lastMove(filters))?.type === "adjust_out");
}
check("every reason stock goes down saves, and the history keeps it", downsSaved.every(Boolean) && (await item(filters))?.onHand === expected, JSON.stringify(downsSaved));
check("going up or down never touches the cost ($4.50 stays)", (await item(filters))?.costMinor === 450);
check("an expired item can't come back up", (await change(filters, "adjust_in", "expired")).json?.fields?.reason === "choice_invalid" && (await item(filters))?.onHand === expected);
check("free goods can't go down, nor something be used in the shop going up", (await change(filters, "adjust_out", "free_goods")).json?.fields?.reason === "choice_invalid" && (await change(filters, "adjust_in", "own_use")).json?.fields?.reason === "choice_invalid");
check("\"Other\" needs a note, whichever way", (await change(filters, "adjust_in", "other")).json?.fields?.note === "required" && (await change(filters, "adjust_out", "other")).json?.fields?.note === "required");
const otherWithNote = await change(filters, "adjust_out", "other", 1, "Taken for the display stand");
check("\"Other\" with its note saves", otherWithNote.status === 200 && (await lastMove(filters))?.note === "Taken for the display stand");
check("going down never goes below zero", (await change(belts, "adjust_out", "damaged", 7)).json?.fields?.quantity === "not_enough_stock" && (await item(belts))?.onHand === 6);

// ── The database's own rule on costs ───────────────────────────────────────
const levelOf = `select store_id, variant_id, location_id from stock_levels where variant_id = '${belts}'`;
check("the database refuses a cost on stock going down", refuses(`insert into stock_movements (store_id, variant_id, location_id, type, quantity, reason, unit_cost_minor, cost_currency) select store_id, variant_id, location_id, 'adjust_out', 1, 'damaged', 100, 'USD' from (${levelOf}) l`));
check("the database refuses a cost on stock going up for any reason but opening stock", refuses(`insert into stock_movements (store_id, variant_id, location_id, type, quantity, reason, unit_cost_minor, cost_currency) select store_id, variant_id, location_id, 'adjust_in', 1, 'free_goods', 100, 'USD' from (${levelOf}) l`));

await call("/store/modules", { method: "PUT", cookie: a, body: { modules: modulesBefore } });
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
