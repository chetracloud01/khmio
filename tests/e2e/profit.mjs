// Cost price and the profit report end to end (GET /orders/profit): the
// report only on Pro, refused below it; the cost saved on a product and kept
// off the shop page; each sale freezing its cost, so changing the cost later
// doesn't change a past sale; and a product sold without a cost counted as
// "cost missing", never guessed. PASS/FAIL lines.
// Usage: node tests/e2e/profit.mjs <api url>    (after step2/3 on the same database)
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
const sql = (query) => psql(query).trim();

check("the report needs a signed-in shop", (await call("/orders/profit")).status === 401);

const a = await login("a");
const slugA = (await call("/auth/me", { cookie: a })).json.store.slug;
const categoryId = (await call("/catalog", { cookie: a })).json.categories[0].id;

// A's plan and the beta switch are put back exactly as they were, for the scripts after this one.
const subscriptionOf = `store_id = (select id from stores where slug = '${slugA}')`;
const planBefore = sql(`select plan || ',' || status from subscriptions where ${subscriptionOf}`).split(",");
const beta = sql("select beta_all_basic::text from platform_settings where id = 1");
sql("update platform_settings set beta_all_basic = false where id = 1");
sql(`update subscriptions set plan = 'basic', status = 'active' where ${subscriptionOf}`);
const basic = await call("/orders/profit", { cookie: a });
check("the report is refused on Basic (plan_limit)", basic.status === 403 && basic.json?.error === "plan_limit", basic.raw);
sql(`update subscriptions set plan = 'pro', status = 'active' where ${subscriptionOf}`);

// Three products: a cost in dollars (on every plan), a cost in riel, and none.
const save = (titleEn, prices) => call("/products", { method: "POST", cookie: a, body: { product: { titleKm: titleEn, titleEn, categoryId, ...prices }, photoKeys: [] } });
const tag = randomUUID().slice(0, 6);
const costed = await save(`Mug ${tag}`, { retailPriceUsdCents: 500, costMinor: 200, costCurrency: "USD" });
const rielCosted = await save(`Pen ${tag}`, { retailPriceUsdCents: 300, costMinor: 2050, costCurrency: "KHR" });
const uncosted = await save(`Cap ${tag}`, { retailPriceUsdCents: 300 });
check("a product saves with a cost price, in dollars or riel", costed.status === 201 && rielCosted.status === 201 && uncosted.status === 201, costed.raw + rielCosted.raw);
const mug = (await call(`/products/${costed.json.id}`, { cookie: a })).json;
check("the seller reads the cost back, with its currency", mug?.variants?.[0]?.costMinor === 200 && mug.variants[0].costCurrency === "USD", JSON.stringify(mug?.variants));
const cap = (await call(`/products/${uncosted.json.id}`, { cookie: a })).json;
check("no cost means no currency either", cap?.variants?.[0]?.costMinor === null && cap.variants[0].costCurrency === null, JSON.stringify(cap?.variants));
const negative = await save(`Bad ${tag}`, { retailPriceUsdCents: 300, costMinor: -1, costCurrency: "USD" });
check("a cost below zero is refused", negative.status === 400, negative.raw);
const noCurrency = await save(`Bad ${tag}`, { retailPriceUsdCents: 300, costMinor: 100 });
check("a cost without its currency is refused", noCurrency.status === 400 && noCurrency.raw.includes("costCurrency"), noCurrency.raw);
const shopPage = (await call(`/public/stores/${slugA}`)).raw;
check("the shop page never carries a cost", !shopPage.includes("costMinor") && !shopPage.includes("costCurrency"));

const before = (await call("/orders/profit", { cookie: a })).json;
check("the report comes back on Pro, in its shape", before?.mainCurrency && ["today", "week", "month"].every((period) => typeof before[period]?.USD?.profit === "number"), JSON.stringify(before)?.slice(0, 200));

const buy = async (productId, quantity) => {
  const variant = (await call(`/products/${productId}`, { cookie: a })).json.variants[0];
  return call(`/public/stores/${slugA}/orders`, {
    method: "POST",
    body: { idempotencyKey: randomUUID(), lines: [{ variantId: variant.id, quantity }], checkout: { name: "Dara", phone: "097 555 0101", currency: "USD", fulfilment: "pickup", area: "phnom_penh", landmark: "", paymentMethod: "cod" } },
  });
};
check("three cash orders are placed", (await buy(costed.json.id, 3)).status === 201 && (await buy(rielCosted.json.id, 2)).status === 201 && (await buy(uncosted.json.id, 1)).status === 201);
// The riel cost is frozen in dollars at the order's rate, rounded like a price (packages/shared money.ts).
const rate = Number(sql(`select usd_to_khr_rate from stores where slug = '${slugA}'`));
const penCost = Math.round((2050 / rate) * 100);

// The cost changes after the sale: the sale keeps the cost it was made at.
const changed = await call(`/products/${costed.json.id}`, { method: "PUT", cookie: a, body: { product: { titleKm: `Mug ${tag}`, titleEn: `Mug ${tag}`, categoryId, retailPriceUsdCents: 500, costMinor: 450, costCurrency: "USD" }, photoKeys: [] } });
check("the cost can be changed", changed.status === 200, changed.raw);

const after = (await call("/orders/profit", { cookie: a })).json;
const today = after.today.USD;
const was = before.today.USD;
check("today's sales grow by the three orders' goods", today.sales - was.sales === 2400, `${was.sales} → ${today.sales}`);
check("the cost is the one frozen at the sale (3 × $2 + 2 × the pen's), not today's", today.cost - was.cost === 600 + 2 * penCost, `${was.cost} → ${today.cost}`);
check("the product without a cost is 'cost missing', not in the profit", today.missingCostSales - was.missingCostSales === 300 && today.profit - was.profit === 900 + 600 - 2 * penCost, JSON.stringify(today));
const penLine = after.today.products.find((product) => product.nameEn === `Pen ${tag}`);
check("a riel cost sold in dollars is converted once, at the order's rate", penLine?.USD.cost === 2 * penCost && after.today.KHR.cost === before.today.KHR.cost, JSON.stringify(penLine));
const mugLine = after.today.products.find((product) => product.nameEn === `Mug ${tag}`);
check("the product list gives its profit and margin", mugLine?.quantity === 3 && mugLine.USD.profit === 900 && mugLine.USD.marginPercent === 60, JSON.stringify(mugLine));
check("riel isn't touched by dollar sales", after.today.KHR.sales === before.today.KHR.sales);
check("the week and month count today too", after.week.USD.sales - before.week.USD.sales === 2400 && after.month.USD.sales - before.month.USD.sales === 2400);

const b = await login("b");
const subscriptionOfB = `store_id = (select id from stores where slug = '${(await call("/auth/me", { cookie: b })).json.store.slug}')`;
const planBeforeB = sql(`select plan || ',' || status from subscriptions where ${subscriptionOfB}`).split(",");
sql(`update subscriptions set plan = 'pro', status = 'active' where ${subscriptionOfB}`);
const forB = (await call("/orders/profit", { cookie: b })).json;
check("another shop's report never shows A's products", !!forB && !forB.month.products.some((product) => product.nameEn === `Mug ${tag}`), JSON.stringify(forB)?.slice(0, 200));
sql(`update subscriptions set plan = '${planBeforeB[0]}', status = '${planBeforeB[1]}' where ${subscriptionOfB}`);

sql(`update subscriptions set plan = '${planBefore[0]}', status = '${planBefore[1]}' where ${subscriptionOf}`);
sql(`update platform_settings set beta_all_basic = ${beta} where id = 1`);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
