// Purchases end to end through the real API (design/screens.md S13; docs/blueprint.md
// "Cost price", suppliers and bills): every condition of a supplier bill — the plan and a
// paused shop, what can't go on a bill, free lines, every currency case (same, none yet,
// another option's, mixed, turned at a rate), the average's edges, returns (held stock,
// credit, paid then returned, untracked), payments (returns, zero, another shop, overdue),
// two people at once (numbers, paying, returning), dates ahead, an archived supplier. Its
// own fresh products, so it doesn't lean on the other scripts. PASS/FAIL lines.
// Usage: node tests/e2e/purchases.mjs <api url>   (after stock on the same database)
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
/** Whether the database refuses a query: as its owner (checks, triggers) or as the app's user (grants). */
const refuses = (query, options) => {
  try {
    psql(query, options);
    return false;
  } catch {
    return true;
  }
};
const refusesAsApp = (query) => refuses(query, { asApp: true });

const a = await login("a");
const b = await login("b");
const me = (await call("/auth/me", { cookie: a })).json;
const slugA = me.store.slug;
const storeA = `(select id from stores where slug = '${slugA}')`;

// A's plan, the beta switch and A's modules are put back exactly as they were, for the scripts after this one.
const subscriptionOf = `store_id = ${storeA}`;
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
const setPlan = (plan, status = "active") => sql(`update subscriptions set plan = '${plan}', status = '${status}' where ${subscriptionOf}`);

// Fresh products: pads (simple), oil (simple, costed in riel), mats (two options), labour (a service), gone (deleted).
const categoryId = (await call("/catalog", { cookie: a })).json.categories[0].id;
const tag = randomUUID().slice(0, 6);
await call("/store/modules", { method: "PUT", cookie: a, body: { modules: [...new Set([...modulesBefore, "services"])] } });
const makeProduct = async (titleEn, extra = {}) => (await call("/products", { method: "POST", cookie: a, body: { product: { titleKm: titleEn, titleEn, categoryId, retailPriceUsdCents: 1500, ...extra }, photoKeys: [] } })).json?.id;
const variantsOf = async (productId) => ((await call(`/products/${productId}`, { cookie: a })).json?.variants ?? []).map((variant) => variant.id);
const [pads] = await variantsOf(await makeProduct(`Pads ${tag}`));
const [oil] = await variantsOf(await makeProduct(`Oil ${tag}`));
const [matA, matB] = await variantsOf(
  await makeProduct(`Mats ${tag}`, { retailPriceUsdCents: undefined, options: [{ id: "a", sku: "", labelKm: "A", labelEn: "A", retailPriceUsdCents: 900 }, { id: "b", sku: "", labelKm: "B", labelEn: "B", retailPriceUsdCents: 900 }] }),
);
const [labour] = await variantsOf(await makeProduct(`Labour ${tag}`, { kind: "service" }));
const goneProduct = await makeProduct(`Gone ${tag}`);
const [gone] = await variantsOf(goneProduct);
await call(`/products/${goneProduct}`, { method: "DELETE", cookie: a });
const otherShopItem = (await call("/products", { cookie: b })).json?.[0]?.variants?.[0]?.id;
check("the suite's own products are made", [pads, oil, matA, matB, labour, gone, otherShopItem].every(Boolean), JSON.stringify({ pads, oil, matA, matB, labour, gone, otherShopItem }));

const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const ahead = new Date(Date.now() + 7 * 3_600_000 + 2 * 86_400_000).toISOString().slice(0, 10);
const bill = (lines, extra = {}) => ({ purchasedOn: today, currency: "USD", lines, ...extra });
const buy = (body, cookie = a) => call("/purchases", { method: "POST", cookie, body });
const item = async (variantId) => (await call("/stock", { cookie: a })).json?.items?.find((entry) => entry.variantId === variantId);
const purchasesOfA = () => Number(sql(`select count(*) from purchases where store_id = ${storeA}`));
const giveBack = (purchaseId, lines, cookie = a) => call(`/purchases/${purchaseId}/returns`, { method: "POST", cookie, body: { lines } });
const pay = (purchaseId, body, cookie = a) => call(`/purchases/${purchaseId}/payments`, { method: "POST", cookie, body: { paidOn: today, method: "cash", ...body } });

// ── 1. The plan and a paused shop ──────────────────────────────────────────
const billsBefore = purchasesOfA();
setPlan("basic");
const onBasic = await buy(bill([{ variantId: pads, quantity: 1, unitCost: 100 }]));
check("a bill is refused on Basic (plan_limit), nothing written", onBasic.status === 403 && onBasic.json?.error === "plan_limit" && purchasesOfA() === billsBefore, onBasic.raw);
setPlan("pro", "paused");
const whenPaused = await buy(bill([{ variantId: pads, quantity: 1, unitCost: 100 }]));
check("a bill is refused while the shop is paused, nothing written", whenPaused.status === 403 && whenPaused.json?.error === "store_paused" && purchasesOfA() === billsBefore, whenPaused.raw);
setPlan("pro");

// ── 2. What can't go on a bill ─────────────────────────────────────────────
const lineError = async (line, field = "variantId", extra = {}) => (await buy(bill([{ variantId: pads, quantity: 1, unitCost: 100, ...line }], extra))).json?.fields?.[`lines.0.${field}`];
check("a service can't go on a bill (nothing on a shelf)", (await lineError({ variantId: labour })) === "product_unavailable");
check("a deleted product can't go on a bill", (await lineError({ variantId: gone })) === "product_unavailable");
check("another shop's item can't go on a bill", (await lineError({ variantId: otherShopItem })) === "product_unavailable");
check("how many must be at least 1", (await lineError({ quantity: 0 }, "quantity")) === "quantity_invalid" && (await lineError({ quantity: -2 }, "quantity")) === "quantity_invalid");
check("how many can't be absurd (over 1,000,000)", (await lineError({ quantity: 1_000_001 }, "quantity")) === "quantity_invalid");
check("a cost can't be negative or part of a cent", (await lineError({ unitCost: -1 }, "unitCost")) === "price_invalid" && (await lineError({ unitCost: 1.5 }, "unitCost")) === "price_invalid");
const future = await buy(bill([{ variantId: pads, quantity: 1, unitCost: 100 }], { purchasedOn: ahead }));
check("a bill can't be dated ahead of today", future.json?.fields?.purchasedOn === "date_in_future" && purchasesOfA() === billsBefore, future.raw);

// ── 3. A free line ─────────────────────────────────────────────────────────
const free = await buy(bill([{ variantId: pads, quantity: 2, unitCost: 0 }], { payment: { method: "cash" } }));
check("a free line saves; paid now with nothing to pay makes no payment, and the bill counts as paid", free.status === 200 && free.json?.totalMinor === 0 && free.json.payments?.length === 0 && free.json.payment?.state === "paid", free.raw);
check("the free item starts tracking at a cost of 0 in the bill's currency", (await item(pads))?.onHand === 2 && (await item(pads))?.costMinor === 0 && (await item(pads))?.costCurrency === "USD");

// ── 4. The average, to the cent and to the riel ────────────────────────────
await buy(bill([{ variantId: pads, quantity: 4, unitCost: 1000 }], { payment: { method: "cash" } }));
check("2 at $0 and 4 at $10.00 average $6.67 (rounded to the cent)", (await item(pads))?.costMinor === 667, JSON.stringify(await item(pads)));
const oilFirst = await buy(bill([{ variantId: oil, quantity: 3, unitCost: 4500 }], { currency: "KHR", payment: { method: "cash" } }));
check("an item with no cost yet takes the bill's currency (riel), no rate needed or kept", oilFirst.json?.exchangeRateUsed === null && (await item(oil))?.costCurrency === "KHR" && (await item(oil))?.costMinor === 4500, oilFirst.raw);
const oilSecond = await buy(bill([{ variantId: oil, quantity: 3, unitCost: 4601 }], { currency: "KHR", payment: { method: "cash" } }));
check("a riel bill for a riel item needs no rate; ៛4,500 and ៛4,601 average ៛4,551 (rounded to the riel)", oilSecond.status === 200 && oilSecond.json.exchangeRateUsed === null && (await item(oil))?.costMinor === 4551, JSON.stringify(await item(oil)));

// ── 5. Every currency case ─────────────────────────────────────────────────
await buy(bill([{ variantId: matA, quantity: 2, unitCost: 3000 }], { payment: { method: "cash" } }));
const siblingNoRate = await buy(bill([{ variantId: matB, quantity: 1, unitCost: 12000 }], { currency: "KHR", payment: { method: "cash" } }));
check("an option with no cost of its own follows its product's other option (dollars): a riel bill needs a rate", siblingNoRate.json?.fields?.exchangeRate === "required", siblingNoRate.raw);
const sibling = await buy(bill([{ variantId: matB, quantity: 1, unitCost: 12000 }], { currency: "KHR", exchangeRate: 4000, payment: { method: "cash" } }));
check("with a rate it's turned into dollars: ៛12,000 at 4,000 = $3.00", sibling.json?.lines?.[0]?.itemCostMinor === 300 && sibling.json.lines[0].itemCostCurrency === "USD" && (await item(matB))?.costCurrency === "USD" && (await item(matB))?.costMinor === 300, sibling.raw);
const mixed = await buy(bill([{ variantId: pads, quantity: 6, unitCost: 667 }, { variantId: oil, quantity: 2, unitCost: 125 }], { exchangeRate: 4000, payment: { method: "bank" } }));
const mixedOil = mixed.json?.lines?.find((line) => line.variantId === oil);
const mixedPads = mixed.json?.lines?.find((line) => line.variantId === pads);
check(
  "one dollar bill with a dollar item and a riel item: only the riel one is turned ($1.25 at 4,000 = ៛5,000), the bill keeps the rate",
  mixed.status === 200 && mixed.json.exchangeRateUsed === 4000 && mixedPads?.itemCostMinor === 667 && mixedPads.itemCostCurrency === "USD" && mixedOil?.itemCostMinor === 5000 && mixedOil.itemCostCurrency === "KHR",
  mixed.raw,
);
check("each average stays in its own currency: oil 6 at ៛4,551 and 2 at ៛5,000 = ៛4,663", (await item(oil))?.costCurrency === "KHR" && (await item(oil))?.costMinor === 4663 && (await item(pads))?.costMinor === 667, JSON.stringify([await item(oil), await item(pads)]));

/** A stock count applied at once (design/screens.md S13 "Count stock"): started (or the open draft), these lines, applied. */
const applyCount = async (lines, cookie = a) => {
  const count = (await call("/stock/counts", { method: "POST", cookie, body: {} })).json;
  await call(`/stock/counts/${count?.id}/lines`, { method: "PUT", cookie, body: { lines } });
  return call(`/stock/counts/${count?.id}/apply`, { method: "POST", cookie });
};

// ── 6. The average's edges ─────────────────────────────────────────────────
await applyCount([{ variantId: oil, counted: 0 }]);
await buy(bill([{ variantId: oil, quantity: 1, unitCost: 9999 }], { currency: "KHR", payment: { method: "cash" } }));
check("with none on hand, the cost becomes the new price (៛9,999)", (await item(oil))?.onHand === 1 && (await item(oil))?.costMinor === 9999, JSON.stringify(await item(oil)));
await call(`/stock/track/${matB}`, { method: "DELETE", cookie: a });
const retracked = await buy(bill([{ variantId: matB, quantity: 1, unitCost: 400 }], { payment: { method: "cash" } }));
check("an item that stopped being tracked starts again from the bill, at its price", retracked.status === 200 && (await item(matB))?.onHand === 1 && (await item(matB))?.costMinor === 400, JSON.stringify(await item(matB)));

// ── 7. Returns ─────────────────────────────────────────────────────────────
const padsOnHand = (await item(pads))?.onHand;
sql(`update stock_levels set reserved = ${padsOnHand - 1} where variant_id = '${pads}'`);
const heldBack = await giveBack(mixed.json?.id, [{ variantId: pads, quantity: 2 }]);
check("held for unpaid KHQR orders: only what's free can go back", heldBack.json?.fields?.["lines.0.quantity"] === "not_enough_stock" && (await item(pads))?.onHand === padsOnHand, heldBack.raw);
sql(`update stock_levels set reserved = 0 where variant_id = '${pads}'`);

const credit = await buy(bill([{ variantId: pads, quantity: 5, unitCost: 1000 }]));
const creditBack = await giveBack(credit.json?.id, [{ variantId: pads, quantity: 2 }]);
check("a return lowers what a credit bill owes: $50.00 less $20.00 back = $30.00, still unpaid", creditBack.json?.payment?.owed === 3000 && creditBack.json.payment.state === "unpaid", JSON.stringify(creditBack.json?.payment));

const paidFirst = await buy(bill([{ variantId: pads, quantity: 3, unitCost: 1000 }], { payment: { method: "cash" } }));
const paidBack = await giveBack(paidFirst.json?.id, [{ variantId: pads, quantity: 1 }]);
check("paid in full, then $10.00 goes back: the supplier owes the shop, and the bill counts as paid", paidBack.json?.payment?.owed === -1000 && paidBack.json.payment.state === "paid", JSON.stringify(paidBack.json?.payment));
check("what a supplier owes back isn't counted against what the shop owes", (await call("/purchases/page?pageSize=100", { cookie: a })).json?.owed?.USD >= 3000);

await call(`/stock/track/${matB}`, { method: "DELETE", cookie: a });
const untrackedBack = await giveBack(retracked.json?.id, [{ variantId: matB, quantity: 1 }]);
check("an item no longer tracked can't be sent back (nothing on the shelf to take)", untrackedBack.json?.fields?.["lines.0.quantity"] === "not_enough_stock", untrackedBack.raw);

// ── 8. Payments ────────────────────────────────────────────────────────────
check("a return can't be paid (only a bill owes)", (await pay(creditBack.json?.returnedBy?.[0]?.id, { amount: 100 })).status === 404);
check("a payment of 0 is refused", (await pay(credit.json?.id, { amount: 0 })).json?.fields?.amount === "price_invalid");
check("a payment can't be dated ahead of today", (await pay(credit.json?.id, { amount: 100, paidOn: ahead })).json?.fields?.paidOn === "date_in_future");
const onePaid = await pay(credit.json?.id, { amount: 1000 });
const otherVoid = await call(`/purchases/payments/${onePaid.json?.payments?.[0]?.id}/void`, { method: "POST", cookie: b });
check("another shop can't void A's payment", otherVoid.status !== 200 && (await call(`/purchases/${credit.json?.id}`, { cookie: a })).json?.payments?.[0]?.voided === false, otherVoid.raw);
const summaryBefore = (await call("/stock/summary", { cookie: a })).json;
const late = await buy(bill([{ variantId: pads, quantity: 1, unitCost: 500 }], { purchasedOn: "2026-01-02", dueOn: "2026-01-31" }));
const summaryLate = (await call("/stock/summary", { cookie: a })).json;
check("an overdue bill is counted in the badges", late.json?.payment?.state === "overdue" && summaryLate?.overdueBills === summaryBefore.overdueBills + 1 && summaryLate.unpaidBills === summaryBefore.unpaidBills + 1, JSON.stringify([summaryBefore, summaryLate]));
const lateNowPaid = await pay(late.json?.id, { amount: 500 });
const summaryPaid = (await call("/stock/summary", { cookie: a })).json;
check("paid, it's no longer overdue, and the badges follow", lateNowPaid.json?.payment?.state === "paid" && summaryPaid?.overdueBills === summaryBefore.overdueBills && summaryPaid.unpaidBills === summaryBefore.unpaidBills, JSON.stringify(summaryPaid));

// ── 9. Two people at once ──────────────────────────────────────────────────
const together = await Promise.all(Array.from({ length: 5 }, () => buy(bill([{ variantId: matA, quantity: 1, unitCost: 3000 }], { payment: { method: "cash" } }))));
const numbers = together.map((answer) => answer.json?.number);
check("5 bills saved at the same moment all save, each with its own number", together.every((answer) => answer.status === 200) && new Set(numbers).size === 5, JSON.stringify(numbers));

const race = await buy(bill([{ variantId: pads, quantity: 2, unitCost: 1000 }]));
const payBoth = await Promise.all([pay(race.json?.id, { amount: 2000 }), pay(race.json?.id, { amount: 2000 })]);
const paidOnce = (await call(`/purchases/${race.json?.id}`, { cookie: a })).json;
check(
  "two people paying the whole bill at once: one is paid, the other refused, never paid twice",
  payBoth.filter((answer) => answer.status === 200).length === 1 && payBoth.some((answer) => answer.json?.fields?.amount === "payment_above_owed") && paidOnce?.payment?.paid === 2000 && paidOnce.payments.length === 1,
  JSON.stringify(payBoth.map((answer) => answer.raw.slice(0, 120))),
);

const backRace = await buy(bill([{ variantId: matA, quantity: 2, unitCost: 3000 }], { payment: { method: "cash" } }));
const matABefore = (await item(matA))?.onHand;
const returnBoth = await Promise.all([giveBack(backRace.json?.id, [{ variantId: matA, quantity: 2 }]), giveBack(backRace.json?.id, [{ variantId: matA, quantity: 2 }])]);
check(
  "two people sending back everything at once: one goes back, the other is refused; stock taken once",
  returnBoth.filter((answer) => answer.status === 200).length === 1 && returnBoth.some((answer) => answer.json?.fields?.["lines.0.quantity"] === "return_above_bought") && (await item(matA))?.onHand === matABefore - 2,
  JSON.stringify(returnBoth.map((answer) => answer.raw.slice(0, 120))),
);

// ── 10. A supplier archived after its bills ────────────────────────────────
const kim = (await call("/suppliers", { method: "POST", cookie: a, body: { name: `Kim Parts ${tag}` } })).json;
const kimBill = await buy(bill([{ variantId: pads, quantity: 1, unitCost: 900 }], { supplierId: kim?.id, payment: { method: "cash" } }));
await call(`/suppliers/${kim?.id}/archive`, { method: "PATCH", cookie: a, body: { archived: true } });
const kimAfter = (await call(`/purchases/${kimBill.json?.id}`, { cookie: a })).json;
const kimRow = (await call(`/purchases/page?q=${encodeURIComponent(`Kim Parts ${tag}`)}`, { cookie: a })).json?.rows?.[0];
check("archived after its bills, a supplier still names them, on the bill and in the list", kimAfter?.supplierName === `Kim Parts ${tag}` && kimRow?.supplierName === `Kim Parts ${tag}`, JSON.stringify(kimRow));

const dara = (await call("/suppliers", { method: "POST", cookie: a, body: { name: `Dara Tyres ${tag}`, phone: "012 345 678" } })).json;
const daraBill = await buy(bill([{ variantId: pads, quantity: 1, unitCost: 900 }], { supplierId: dara?.id, payment: { method: "cash" } }));
check("a bill carries its supplier's phone (for the printed bill and voucher); none without a supplier", daraBill.json?.supplierPhone === "85512345678" && free.json?.supplierPhone === "", JSON.stringify([daraBill.json?.supplierPhone, free.json?.supplierPhone]));

// ── Received now, or not yet ───────────────────────────────────────────────
check("a bill saved without saying is received at once (the quick bill from Change stock)", (await call(`/purchases/${kimBill.json?.id}`, { cookie: a })).json?.receivedAt !== null);
const waitingBefore = await item(pads);
const waiting = await buy(bill([{ variantId: pads, quantity: 10, unitCost: 1300 }], { received: false }));
const movesOf = (purchaseId) => Number(sql(`select count(*) from stock_movements where purchase_id = '${purchaseId}'`));
check(
  "saved as not received: the bill is kept, owed, but nothing goes into stock and the cost stays",
  waiting.status === 200 && waiting.json.receivedAt === null && waiting.json.payment?.owed === 13000 && movesOf(waiting.json.id) === 0 && (await item(pads))?.onHand === waitingBefore.onHand && (await item(pads))?.costMinor === waitingBefore.costMinor,
  waiting.raw,
);
const notReceivedList = (await call("/purchases/page?chip=not_received", { cookie: a })).json;
check("the list's Not received chip finds it", notReceivedList?.rows?.some((row) => row.id === waiting.json?.id) && notReceivedList.rows.every((row) => row.receivedAt === null && row.kind === "purchase"), JSON.stringify(notReceivedList?.chipCounts));
check("nothing goes back before it arrives", (await giveBack(waiting.json?.id, [{ variantId: pads, quantity: 1 }])).status === 409);
const paidEarly = await pay(waiting.json?.id, { amount: 13000 });
check("it can be paid before the goods arrive", paidEarly.json?.payment?.state === "paid" && paidEarly.json.receivedAt === null, paidEarly.raw);
await buy(bill([{ variantId: pads, quantity: 2, unitCost: 900 }], { payment: { method: "cash" } }));
const atReceive = await item(pads);
const receivedNow = await call(`/purchases/${waiting.json?.id}/receive`, { method: "POST", cookie: a });
const afterReceive = await item(pads);
const averageAtReceive = Math.round((atReceive.onHand * atReceive.costMinor + 10 * 1300) / (atReceive.onHand + 10));
check(
  "Received: stock goes up then, and the average is worked out from what's on hand at that moment",
  receivedNow.status === 200 && receivedNow.json.receivedAt !== null && afterReceive?.onHand === atReceive.onHand + 10 && afterReceive.costMinor === averageAtReceive && movesOf(waiting.json.id) === 1,
  JSON.stringify({ atReceive, afterReceive, averageAtReceive }),
);
check("it can't be received twice", (await call(`/purchases/${waiting.json?.id}/receive`, { method: "POST", cookie: a })).status === 409 && (await item(pads))?.onHand === afterReceive.onHand);
check("once received, goods can go back", (await giveBack(waiting.json?.id, [{ variantId: pads, quantity: 1 }])).status === 200);
check("a return can't be \"received\"", (await call(`/purchases/${paidBack.json?.returnedBy?.[0]?.id}/receive`, { method: "POST", cookie: a })).status === 409);
const raceBill = await buy(bill([{ variantId: matA, quantity: 3, unitCost: 3000 }], { received: false, payment: { method: "cash" } }));
const matAWas = (await item(matA))?.onHand;
const receiveBoth = await Promise.all([call(`/purchases/${raceBill.json?.id}/receive`, { method: "POST", cookie: a }), call(`/purchases/${raceBill.json?.id}/receive`, { method: "POST", cookie: a })]);
check("two people pressing Received at once: stock goes up once", receiveBoth.filter((answer) => answer.status === 200).length === 1 && (await item(matA))?.onHand === matAWas + 3 && movesOf(raceBill.json?.id) === 1, JSON.stringify(receiveBoth.map((answer) => answer.status)));
check("another shop can't receive A's bill", (await call(`/purchases/${(await buy(bill([{ variantId: matA, quantity: 1, unitCost: 3000 }], { received: false }))).json?.id}/receive`, { method: "POST", cookie: b })).status !== 200);
check("the database never takes a bill back to \"not received\"", refuses(`update purchases set received_at = null where id = '${waiting.json?.id}'`));
check("the app may change nothing else on a bill", refusesAsApp(`update purchases set total_minor = 1 where id = '${waiting.json?.id}'`) && refusesAsApp(`update purchases set note = 'x'`));
check("the database keeps a return received", refuses(`insert into purchases (store_id, number, kind, returns_id, purchased_on, currency, total_minor) select store_id, 999999, 'return', id, purchased_on, currency, 0 from purchases where id = '${waiting.json?.id}'`));

// ── Received by, the goods filter, and the payables report ─────────────────
check("a received bill says who received it", (await call(`/purchases/${waiting.json?.id}`, { cookie: a })).json?.receivedByName === me.merchant?.firstName, JSON.stringify(me.merchant));
const stillWaiting = await buy(bill([{ variantId: pads, quantity: 4, unitCost: 2500 }], { received: false, dueOn: ahead }));
check("a bill not received yet names no one", stillWaiting.json?.receivedByName === null, stillWaiting.raw);
const goodsNo = (await call("/purchases/page?f.goods=not_received&pageSize=100", { cookie: a })).json;
const goodsYes = (await call("/purchases/page?f.goods=received&pageSize=100", { cookie: a })).json;
check(
  "the goods filter splits bills into received and not, never a return as not received",
  goodsNo?.rows?.some((row) => row.id === stillWaiting.json?.id) && goodsNo.rows.every((row) => row.receivedAt === null && row.kind === "purchase") && goodsYes?.rows?.every((row) => row.receivedAt !== null && row.kind === "purchase"),
  JSON.stringify(goodsNo?.chipCounts),
);
// The tiles' filters: due within 7 days, and owing but not late.
const dueSoonList = (await call("/purchases/page?f.due=due_soon&pageSize=100", { cookie: a })).json;
check(
  "the due filter finds the bill due in 2 days, and only bills owing, not late, due within 7 days",
  dueSoonList?.rows?.some((row) => row.id === stillWaiting.json?.id) && dueSoonList.rows.every((row) => row.payment?.owed > 0 && row.payment.state !== "overdue" && row.dueOn && row.dueOn <= ahead),
  JSON.stringify(dueSoonList?.rows?.map((row) => [row.dueOn, row.payment?.state])),
);
const openList = (await call("/purchases/page?f.payment=open&pageSize=100", { cookie: a })).json;
check("\"open\" is unpaid or part paid, never overdue or paid", openList?.rows?.length > 0 && openList.rows.every((row) => row.payment?.state === "unpaid" || row.payment?.state === "part"), JSON.stringify(openList?.rows?.map((row) => row.payment?.state)));

// The report against the bills themselves, read straight from the database.
const report = (await call("/purchases/report", { cookie: a })).json;
const usd = report?.currencies?.USD;
const dbOwed = Number(
  sql(`select coalesce(sum(greatest(owed, 0)), 0) from (
    select b.total_minor - coalesce((select sum(r.total_minor) from purchases r where r.returns_id = b.id), 0)
         - coalesce((select sum(p.amount_minor) from purchase_payments p where p.purchase_id = b.id and p.voided_at is null), 0) as owed
      from purchases b where b.store_id = ${storeA} and b.kind = 'purchase' and b.currency = 'USD') bills`),
);
const dbWaiting = Number(sql(`select count(*) from purchases where store_id = ${storeA} and kind = 'purchase' and currency = 'USD' and received_at is null`));
check("the report's \"you owe\" matches the bills, returns and payments in the database", usd?.figures?.owed === dbOwed, JSON.stringify({ report: usd?.figures, dbOwed }));
check("its not-received count matches the database", usd?.figures?.notReceived?.count === dbWaiting, JSON.stringify(usd?.figures?.notReceived));
const cells = Object.values(usd?.status ?? {}).flatMap((goods) => Object.values(goods));
check("every bill is in exactly one status cell", cells.reduce((sum, cell) => sum + cell.count, 0) === usd?.figures?.billCount);
check("its due-soon count matches the due filter's list", usd?.figures?.dueSoonCount === dueSoonList?.rows?.filter((row) => row.currency === "USD").length, JSON.stringify(usd?.figures));
check("the ageing adds up to what's owed", Object.values(usd?.ageing ?? {}).reduce((sum, owed) => sum + owed, 0) === usd?.figures?.owed);
check("not received and still owed shows in its cell", usd?.status?.unpaid?.not_received?.owed >= 10000);
const dbReturned = Number(sql(`select coalesce(sum(r.total_minor), 0) from purchases r join purchases b on b.id = r.returns_id where b.store_id = ${storeA} and b.kind = 'purchase' and b.currency = 'USD' and r.kind = 'return'`));
check("what went back to suppliers matches the database's returns, and the suppliers add up to it", usd?.figures?.returned === dbReturned && report?.suppliers?.filter((row) => row.currency === "USD").reduce((sum, row) => sum + row.returned, 0) === dbReturned, JSON.stringify({ returned: usd?.figures?.returned, dbReturned }));
check("suppliers add up to the report", report?.suppliers?.filter((row) => row.currency === "USD").reduce((sum, row) => sum + row.owed, 0) === usd?.figures?.owed);
// Bills dated in a range, counted straight from the database.
const usdBillsBetween = (from, to) => Number(sql(`select count(*) from purchases where store_id = ${storeA} and kind = 'purchase' and currency = 'USD' and purchased_on between '${from}' and '${to}'`));
const january = (await call("/purchases/report?period=custom&from=2026-01-01&to=2026-01-31", { cookie: a })).json;
check(
  "a custom range reads only its bills, drawn day by day (the January bill on its day)",
  january?.period === "custom" && january.days?.from === "2026-01-01" && january.currencies.USD.figures.billCount === usdBillsBetween("2026-01-01", "2026-01-31") && january.unit === "day" && january.series.length === 31 && january.series.find((point) => point.key === "2026-01-02")?.bought.USD >= 500,
  JSON.stringify(january?.currencies?.USD?.figures),
);
const week = (await call("/purchases/report?period=week", { cookie: a })).json;
check("the last 7 days read only their bills", week?.days?.to === today && week.series.length === 7 && week.currencies.USD.figures.billCount === usdBillsBetween(week.days.from, today), JSON.stringify(week?.days));
check("every bill is drawn month by month", report?.unit === "month" && report.series[0]?.key === "2026-01", JSON.stringify(report?.series?.slice(0, 2)));
const paidInSeries = report?.series?.reduce((sum, point) => sum + point.paid.USD, 0);
const dbPaid = Number(sql(`select coalesce(sum(p.amount_minor), 0) from purchase_payments p join purchases b on b.id = p.purchase_id where p.store_id = ${storeA} and p.voided_at is null and b.currency = 'USD'`));
check("the bars' payments match the database (voided ones left out)", paidInSeries === dbPaid, JSON.stringify({ paidInSeries, dbPaid }));
// A custom range needs both days, in order, not ahead; an unknown period is refused.
for (const bad of ["?period=custom&from=2026-01-01", "?period=custom&from=2026-02-01&to=2026-01-01", "?period=custom&from=2026-01-01&to=2999-01-01", "?period=forever"]) {
  check(`refused: ${bad}`, (await call(`/purchases/report${bad}`, { cookie: a })).status === 400);
}
const reportB = (await call("/purchases/report", { cookie: b })).json;
check("another shop's report never counts A's bills", !reportB?.suppliers?.some((row) => row.supplierName === `Kim Parts ${tag}`));

// ── The database's own rules ───────────────────────────────────────────────
check("the database refuses a rate of 0", refuses(`update purchases set exchange_rate_used = 0 where id = '${mixed.json?.id}'`));
check("the database refuses a payment of 0", refuses(`update purchase_payments set amount_minor = 0 where purchase_id = '${race.json?.id}'`));

await call("/store/modules", { method: "PUT", cookie: a, body: { modules: modulesBefore } });
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
