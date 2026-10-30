// Stock end-to-end through the real API (design/screens.md S13; roadmap Pro
// plan): the plan gate; tracking an option from a count; the shop page's
// "sold out" stock; an online order and a counter sale taking stock and being
// refused when there isn't enough; cancel and void putting it back; stock in
// (a supplier bill) and corrections; bills with many lines, returns to the
// supplier and suppliers; another shop kept out. PASS/FAIL lines.
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

// Stock bought in is a supplier bill (POST /purchases): one currency, a cost on every line.
const bill = (lines, extra = {}) => ({ purchasedOn: new Date().toISOString().slice(0, 10), currency: "USD", lines, ...extra });
const buy = (body, cookie = a) => call("/purchases", { method: "POST", cookie, body });
const purchase = await buy(bill([{ variantId: bread, quantity: 10, unitCost: 2000 }], { note: "Supplier #1042" }));
check("stock in (a one-line bill) adds to the count", purchase.status === 200 && (await onHand()) === 12, purchase.raw);
check("a correction needs a reason", (await call("/stock/changes", { method: "POST", cookie: a, body: { variantId: bread, type: "adjust_out", quantity: 1 } })).json?.fields?.reason === "reason_required");
const tooMuch = await call("/stock/changes", { method: "POST", cookie: a, body: { variantId: bread, type: "adjust_out", quantity: 13, reason: "damaged" } });
check("a correction can't take the count below zero", tooMuch.json?.fields?.quantity === "not_enough_stock" && (await onHand()) === 12, tooMuch.raw);
const damaged = await call("/stock/changes", { method: "POST", cookie: a, body: { variantId: bread, type: "adjust_out", quantity: 2, reason: "damaged" } });
check("a correction with its reason saves", damaged.status === 200 && (await onHand()) === 10);
const history = (await call("/stock", { cookie: a })).json?.movements ?? [];
check("the history shows every change, newest first", history[0]?.type === "adjust_out" && history[0].reason === "damaged" && history.some((row) => row.type === "sale" && row.inStore) && history.some((row) => row.reason === "returned"));

check("another shop can't change A's stock", (await call("/stock/changes", { method: "POST", cookie: b, body: { variantId: bread, type: "adjust_in", quantity: 1, reason: "count_correction" } })).status !== 200 && (await onHand()) === 10);
check("another shop can't buy A's items", (await buy(bill([{ variantId: bread, quantity: 1, unitCost: 1 }]), b)).status !== 200 && (await onHand()) === 10);
// Purchases with their cost (docs/blueprint.md "Cost price", level 2): the moving average.
const item = async () => (await call("/stock", { cookie: a })).json?.items?.find((entry) => entry.variantId === bread);
sql(`update product_variants set cost_minor = 2000, cost_currency = 'USD' where id = '${bread}'`);
const chhay = (await call("/suppliers", { method: "POST", cookie: a, body: { name: "Chhay Auto Parts" } })).json?.id;
const bought = await buy(bill([{ variantId: bread, quantity: 10, unitCost: 2600 }], { supplierId: chhay }));
const afterPurchase = await item();
check("10 on hand at $20 and 10 bought at $26 cost $23 each", bought.status === 200 && afterPurchase?.onHand === 20 && afterPurchase.costMinor === 2300 && afterPurchase.costCurrency === "USD", JSON.stringify(afterPurchase));
const purchaseRow = (await call("/stock", { cookie: a })).json?.movements?.[0];
check("the purchase keeps its cost and supplier in the history", purchaseRow?.type === "purchase" && purchaseRow.unitCostMinor === 2600 && purchaseRow.costCurrency === "USD" && purchaseRow.supplier === "Chhay Auto Parts", JSON.stringify(purchaseRow));
const riel = await buy(bill([{ variantId: bread, quantity: 1, unitCost: 100000 }], { currency: "KHR" }));
check("a riel bill for a dollar item asks for the rate, and nothing changes", riel.json?.fields?.exchangeRate === "required" && (await item())?.onHand === 20, riel.raw);
const offBand = await buy(bill([{ variantId: bread, quantity: 1, unitCost: 100000 }], { currency: "KHR", exchangeRate: 99 }));
check("a rate outside the platform's band is refused", offBand.json?.fields?.exchangeRate === "rate_out_of_band" && (await item())?.onHand === 20, offBand.raw);
const asCorrection = await call("/stock/changes", { method: "POST", cookie: a, body: { variantId: bread, type: "purchase", quantity: 1 } });
check("a stock correction is never a purchase (that's a bill)", asCorrection.status === 400 && (await item())?.onHand === 20, asCorrection.raw);
const noCost = await buy(bill([{ variantId: bread, quantity: 1 }]));
check("a bill line without a cost is refused, the average kept", noCost.status === 400 && (await item())?.costMinor === 2300 && (await item())?.onHand === 20, noCost.raw);
const pageNow = (await call("/stock", { cookie: a })).json;
check("the stock value counts it at the average", pageNow?.value?.USD >= 20 * 2300, JSON.stringify(pageNow?.value));
const soldAtAverage = await counter(1);
check("the next sale freezes the average as its cost", soldAtAverage.status === 200 && sql(`select unit_cost_minor from order_items where order_id = '${soldAtAverage.json?.id}'`) === "2300", soldAtAverage.raw);
await call(`/counter/sales/${soldAtAverage.json?.id}/void`, { method: "POST", cookie: a });
check("a return puts the stock back and keeps the average", (await item())?.onHand === 20 && (await item())?.costMinor === 2300);
let refusedByDatabase = false;
try {
  sql(`insert into stock_movements (store_id, variant_id, location_id, type, quantity, reason, unit_cost_minor, cost_currency)
       select store_id, variant_id, location_id, 'adjust_in', 1, 'returned', 100, 'USD' from stock_levels where variant_id = '${bread}' limit 1`);
} catch {
  refusedByDatabase = true;
}
check("the database itself refuses a cost on anything but a purchase", refusedByDatabase);

// Start tracking many at once (the Stock list's selection), all or nothing.
const untracked = ((await call("/stock", { cookie: a })).json?.items ?? []).filter((entry) => entry.onHand === null).slice(0, 3);
const [first, second, third] = untracked.map((entry) => entry.variantId);
const many = await call("/stock/track-many", { method: "POST", cookie: a, body: { items: [{ variantId: first, onHand: 3 }, { variantId: second, onHand: 0 }] } });
const levels = async () => new Map(((await call("/stock", { cookie: a })).json?.items ?? []).map((entry) => [entry.variantId, entry.onHand]));
const afterMany = await levels();
check("many options start tracking at once, each from its own count", untracked.length === 3 && many.status === 200 && afterMany.get(first) === 3 && afterMany.get(second) === 0, many.raw);
const again = await call("/stock/track-many", { method: "POST", cookie: a, body: { items: [{ variantId: first, onHand: 9 }, { variantId: third, onHand: 2 }] } });
const afterAgain = await levels();
check("one already tracked is skipped, not reset; the others start", again.status === 200 && afterAgain.get(first) === 3 && afterAgain.get(third) === 2, again.raw);
check("the same option twice is refused", (await call("/stock/track-many", { method: "POST", cookie: a, body: { items: [{ variantId: first, onHand: 1 }, { variantId: first, onHand: 2 }] } })).json?.fields?.["items.1.variantId"] === "option_duplicate");
check("another shop can't start A's options", (await call("/stock/track-many", { method: "POST", cookie: b, body: { items: [{ variantId: first, onHand: 1 }] } })).status !== 200 && (await levels()).get(first) === 3);

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
// Supplier bills (design/screens.md S13 "Purchases"): many lines at once, all or nothing; returns; suppliers.
const stockItems = (await call("/stock", { cookie: a })).json?.items ?? [];
const rielProducts = new Set(stockItems.filter((entry) => entry.costCurrency === "KHR").map((entry) => entry.productId));
const fresh = stockItems.find((entry) => entry.onHand === null && entry.variantId !== bread && !rielProducts.has(entry.productId))?.variantId;
// A tracked item whose cost (if any) is in dollars, like the bill.
const dollarItem = stockItems.find((entry) => entry.onHand !== null && entry.variantId !== bread && !rielProducts.has(entry.productId))?.variantId;
const dollarItemBefore = (await levels()).get(dollarItem);
const threeLines = await buy(bill([{ variantId: bread, quantity: 20, unitCost: 2900 }, { variantId: dollarItem, quantity: 2, unitCost: 500 }, { variantId: fresh, quantity: 4, unitCost: 125 }], { supplierId: chhay, billRef: "INV-77" }));
const billed = threeLines.json;
const afterBill = new Map(((await call("/stock", { cookie: a })).json?.items ?? []).map((entry) => [entry.variantId, entry]));
check("a bill of three lines saves with its total worked out by the server", threeLines.status === 200 && billed?.lines?.length === 3 && billed.totalMinor === 59500 && billed.supplierName === "Chhay Auto Parts" && billed.billRef === "INV-77", threeLines.raw);
check("each line adds its stock; 20 at $23 and 20 at $29 average $26", afterBill.get(bread)?.onHand === 40 && afterBill.get(bread)?.costMinor === 2600 && afterBill.get(dollarItem)?.onHand === dollarItemBefore + 2, JSON.stringify(afterBill.get(bread)));
check("an item not tracked yet starts tracking from the bill, at its cost", afterBill.get(fresh)?.onHand === 4 && afterBill.get(fresh)?.costMinor === 125 && afterBill.get(fresh)?.costCurrency === "USD", JSON.stringify(afterBill.get(fresh)));
check("its movements name the bill", sql(`select count(*) from stock_movements where purchase_id = '${billed?.id}' and type = 'purchase'`) === "3");
const halfBad = await buy(bill([{ variantId: bread, quantity: 1, unitCost: 2600 }, { variantId: randomUUID(), quantity: 1, unitCost: 1 }]));
check("one bad line refuses the whole bill: nothing added", halfBad.json?.fields?.["lines.1.variantId"] === "product_unavailable" && (await item())?.onHand === 40, halfBad.raw);
check("the same item twice on a bill is refused", (await buy(bill([{ variantId: bread, quantity: 1, unitCost: 1 }, { variantId: bread, quantity: 1, unitCost: 1 }]))).json?.fields?.["lines.1.variantId"] === "option_duplicate");
check("another shop can't read A's bill", (await call(`/purchases/${billed?.id}`, { cookie: b })).status === 404 && !((await call("/purchases/page", { cookie: b })).json?.rows ?? []).some((row) => row.id === billed?.id));

// Returns: never more than the bill brought in, never more than is on the shelf; the average stays.
const tooManyBack = await call(`/purchases/${billed?.id}/returns`, { method: "POST", cookie: a, body: { lines: [{ variantId: bread, quantity: 21 }] } });
check("sending back more than the bill brought in is refused", tooManyBack.json?.fields?.["lines.0.quantity"] === "return_above_bought" && (await item())?.onHand === 40, tooManyBack.raw);
const sentBack = await call(`/purchases/${billed?.id}/returns`, { method: "POST", cookie: a, body: { lines: [{ variantId: bread, quantity: 5 }], note: "Wrong size" } });
const returned = sentBack.json?.returnedBy?.[0];
check("a return takes the stock away and keeps the average", sentBack.status === 200 && (await item())?.onHand === 35 && (await item())?.costMinor === 2600, sentBack.raw);
check("the bill shows the return and what may still go back", returned?.totalMinor === 14500 && returned.number === 1 && sentBack.json?.lines?.find((line) => line.variantId === bread)?.returnable === 15, JSON.stringify(sentBack.json?.lines));
check("the return's movement says sent back to the supplier", sql(`select type || ',' || reason || ',' || quantity from stock_movements where purchase_id = '${returned?.id}'`) === "adjust_out,supplier_return,5");
check("a second return counts the first", (await call(`/purchases/${billed?.id}/returns`, { method: "POST", cookie: a, body: { lines: [{ variantId: bread, quantity: 16 }] } })).json?.fields?.["lines.0.quantity"] === "return_above_bought");
check("a return can't be sent back again", (await call(`/purchases/${returned?.id}/returns`, { method: "POST", cookie: a, body: { lines: [{ variantId: bread, quantity: 1 }] } })).status === 404);
await call("/stock/changes", { method: "POST", cookie: a, body: { variantId: fresh, type: "adjust_out", quantity: 3, reason: "damaged" } });
const offShelf = await call(`/purchases/${billed?.id}/returns`, { method: "POST", cookie: a, body: { lines: [{ variantId: fresh, quantity: 2 }] } });
check("sending back more than is on the shelf is refused", offShelf.json?.fields?.["lines.0.quantity"] === "not_enough_stock", offShelf.raw);
check("bills and returns each count on their own (BILL-0003, RET-0001)", billed?.number === 3 && returned?.number === 1 && sql(`select string_agg(series || '=' || last_number, ',' order by series) from document_counters where store_id = (select store_id from purchases where id = '${billed?.id}')`) === "bill=3,return=1");
const byCode = (await call(`/purchases/page?q=BILL-${String(billed?.number).padStart(4, "0")}`, { cookie: a })).json;
check("our number finds the bill, typed with its prefix", byCode?.rows?.some((row) => row.id === billed?.id) && byCode.rows.every((row) => row.kind === "purchase"), JSON.stringify(byCode?.rows?.map((row) => row.kind)));
check("the app can't delete a shop's counter", refusesAsApp(`delete from document_counters`));
const returnsChip = (await call("/purchases/page?chip=return", { cookie: a })).json;
const searched = (await call("/purchases/page?q=INV-77", { cookie: a })).json;
check("the list has a returns chip and finds a bill by the supplier's number", returnsChip?.rows?.every((row) => row.kind === "return") && returnsChip.total >= 1 && searched?.rows?.some((row) => row.id === billed?.id), JSON.stringify(returnsChip?.chipCounts));

const bySupplier = (await call(`/purchases/page?f.supplier=${chhay}&f.currency=USD&f.period=this_month`, { cookie: a })).json;
check("the list filters by supplier, currency and month, and adds up bills less returns", bySupplier?.rows?.length >= 2 && bySupplier.rows.every((row) => row.supplierId === chhay && row.currency === "USD") && bySupplier.totals?.USD === 26000 + 59500 - 14500 && bySupplier.filterCounts?.currency?.KHR === 0, JSON.stringify({ totals: bySupplier?.totals, counts: bySupplier?.filterCounts?.currency }));
check("a supplier filter that isn't an id is refused", (await call("/purchases/page?f.supplier=everyone", { cookie: a })).status === 400);
const chhayRow = (await call("/suppliers", { cookie: a })).json?.suppliers?.find((entry) => entry.id === chhay);
check("a supplier shows what was bought from them and their last bill", chhayRow?.bought?.USD === 26000 + 59500 - 14500 && chhayRow.lastBillOn === bill([]).purchasedOn, JSON.stringify(chhayRow));

// Paying bills: what's owed is the total less returns less payments; never more than owed; voided, never deleted.
const bill3 = async () => (await call(`/purchases/${billed?.id}`, { cookie: a })).json;
check("a bill bought on credit owes its total less what went back", (await bill3())?.payment?.owed === 45000 && (await bill3())?.payment?.state === "unpaid", JSON.stringify((await bill3())?.payment));
const pay = (id, body) => call(`/purchases/${id}/payments`, { method: "POST", cookie: a, body: { paidOn: bill([]).purchasedOn, method: "cash", ...body } });
const part = await pay(billed?.id, { amount: 20000, method: "bank", note: "ABA 1234" });
check("paying part leaves the rest owed, numbered PAY-…", part.status === 200 && part.json?.payment?.state === "part" && part.json.payment.owed === 25000 && part.json.payments?.[0]?.number >= 1, part.raw);
check("paying more than is owed is refused", (await pay(billed?.id, { amount: 25001 })).json?.fields?.amount === "payment_above_owed" && (await bill3())?.payment?.owed === 25000);
const voided = await call(`/purchases/payments/${part.json?.payments?.[0]?.id}/void`, { method: "POST", cookie: a });
check("a voided payment stays on the bill, crossed out, and no longer counts", voided.status === 200 && voided.json?.payments?.[0]?.voided === true && voided.json.payment.owed === 45000 && voided.json.payment.state === "unpaid", voided.raw);
check("a payment is voided only once", (await call(`/purchases/payments/${part.json?.payments?.[0]?.id}/void`, { method: "POST", cookie: a })).status === 404);
check("the database brings no voided payment back, and the app can't change an amount", refuses(`update purchase_payments set voided_at = null where id = '${part.json?.payments?.[0]?.id}'`) && refusesAsApp(`update purchase_payments set amount_minor = 1`) && refusesAsApp(`delete from purchase_payments`));
const full = await pay(billed?.id, { amount: 45000 });
check("paid in full, it's paid", full.json?.payment?.state === "paid" && full.json.payment.owed === 0, full.raw);
check("another shop can't pay A's bill", (await call(`/purchases/${billed?.id}/payments`, { method: "POST", cookie: b, body: { amount: 1, paidOn: bill([]).purchasedOn, method: "cash" } })).status !== 200);
const paidNow = await buy(bill([{ variantId: dollarItem, quantity: 1, unitCost: 700 }], { payment: { method: "khqr" } }));
check("a bill paid now is paid in full, on its own day", paidNow.json?.payment?.state === "paid" && paidNow.json.payments?.[0]?.amountMinor === 700 && paidNow.json.payments[0].method === "khqr", paidNow.raw);
const late = await buy(bill([{ variantId: dollarItem, quantity: 1, unitCost: 300 }], { purchasedOn: "2026-01-02", dueOn: "2026-01-31" }));
check("a bill on credit past its due day is overdue", late.json?.payment?.state === "overdue" && late.json.dueOn === "2026-01-31", late.raw);
check("a due day with paid now, or before the bill, is refused", (await buy(bill([{ variantId: dollarItem, quantity: 1, unitCost: 1 }], { payment: { method: "cash" }, dueOn: "2099-01-01" }))).json?.fields?.dueOn === "date_invalid");
const overdueList = (await call("/purchases/page?f.payment=overdue", { cookie: a })).json;
check("the list filters by payment, and says what the shop owes", overdueList?.rows?.length === 1 && overdueList.rows[0].id === late.json?.id && overdueList.owed?.USD >= 300 && overdueList.filterCounts?.payment?.paid >= 2, JSON.stringify({ rows: overdueList?.rows?.length, owed: overdueList?.owed, counts: overdueList?.filterCounts?.payment }));
check("the migration's fill-in works out what a bill still owed after its returns", sql(`select bill.total_minor - coalesce(sent.total, 0) from purchases bill left join (select returns_id, sum(total_minor) as total from purchases where kind = 'return' group by returns_id) sent on sent.returns_id = bill.id where bill.id = '${billed?.id}'`) === "45000");

// Suppliers: one name per shop, whatever the case; archived ones aren't picked for new bills.
check("a supplier's name is taken whatever the case", (await call("/suppliers", { method: "POST", cookie: a, body: { name: "chhay auto parts" } })).json?.fields?.name === "name_duplicate");
await call(`/suppliers/${chhay}/archive`, { method: "PATCH", cookie: a, body: { archived: true } });
check("an archived supplier can't go on a new bill", (await buy(bill([{ variantId: bread, quantity: 1, unitCost: 2600 }], { supplierId: chhay }))).json?.fields?.supplierId === "choice_invalid");
const restored = await call(`/suppliers/${chhay}/archive`, { method: "PATCH", cookie: a, body: { archived: false } });
check("it comes back, with its bills", restored.json?.archived === false && restored.json.purchaseCount >= 3, restored.raw);
const takeover = await call(`/suppliers/${chhay}`, { method: "PATCH", cookie: b, body: { name: "Taken over" } });
const summary = (await call("/stock/summary", { cookie: a })).json;
const balancesNow = (await call("/purchases/page?pageSize=100", { cookie: a })).json?.rows ?? [];
check(
  "the Stock area's badges count what needs attention: to reorder, bills not paid (overdue among them), suppliers in use",
  summary?.unpaidBills === balancesNow.filter((row) => row.payment && row.payment.state !== "paid").length &&
    summary.overdueBills === balancesNow.filter((row) => row.payment?.state === "overdue").length &&
    summary.suppliers >= 1 &&
    summary.toReorder === ((await call("/stock", { cookie: a })).json?.items ?? []).filter((entry) => entry.onHand !== null && entry.low).length,
  JSON.stringify(summary),
);
const chhayPage = await call(`/suppliers/${chhay}`, { cookie: a });
check("a supplier's page has their numbers", chhayPage.status === 200 && chhayPage.json?.name === "Chhay Auto Parts" && chhayPage.json.purchaseCount >= 3, chhayPage.raw);
const breadPage = await call(`/stock/items/${bread}`, { cookie: a });
check("an item's page has its count, its history and the bills that bought it", breadPage.status === 200 && breadPage.json?.item?.variantId === bread && breadPage.json.movements?.length > 0 && breadPage.json.bills?.some((line) => line.purchaseId === billed?.id), JSON.stringify(breadPage.json?.bills?.length));
check("another shop finds neither A's item page nor A's supplier", (await call(`/stock/items/${bread}`, { cookie: b })).status === 404 && (await call(`/suppliers/${chhay}`, { cookie: b })).status === 404);
check("another shop can't change A's supplier", takeover.status !== 200 && (await call("/suppliers", { cookie: a })).json?.suppliers?.find((entry) => entry.id === chhay)?.name === "Chhay Auto Parts", takeover.raw);

// The database's own rules, whatever the API does.
check("the app can't change a saved bill", refuses(`update purchases set total_minor = 1 where id = '${billed?.id}'`, { asApp: true }));
check("the app can't delete a bill's line", refuses(`delete from purchase_lines where purchase_id = '${billed?.id}'`, { asApp: true }));
check("a line's total is always quantity × cost", refuses(`insert into purchase_lines (store_id, purchase_id, variant_id, quantity, unit_cost_minor, line_total_minor) select store_id, purchase_id, variant_id, 2, 100, 1 from purchase_lines where purchase_id = '${billed?.id}' limit 1`));

// A stock count (design/screens.md S13 "Count stock"): a numbered draft, continued on any device; applied once.
const countFrom = ((await call("/stock", { cookie: a })).json?.items ?? []).find((entry) => entry.onHand === null)?.variantId;
const freshBefore = (await levels()).get(fresh);
const breadBefore = (await levels()).get(bread);
const correctionsOf = (variantId) => sql(`select count(*) from stock_movements where variant_id = '${variantId}' and reason = 'count_correction'`);
const freshCorrections = correctionsOf(fresh);
const started = await call("/stock/counts", { method: "POST", cookie: a, body: {} });
const countId = started.json?.id;
check("a count starts as a numbered draft over every item", started.status === 200 && started.json?.status === "draft" && started.json.number >= 1 && started.json.categoryIds.length === 0, started.raw);
check("starting again continues the open draft (one per shop)", (await call("/stock/counts", { method: "POST", cookie: a, body: {} })).json?.id === countId);
const lines = (body, id = countId, cookie = a) => call(`/stock/counts/${id}/lines`, { method: "PUT", cookie, body: { lines: body } });
const typed = await lines([{ variantId: bread, counted: breadBefore - 5 }, { variantId: fresh, counted: freshBefore }, { variantId: countFrom, counted: 6 }]);
const breadLine = typed.json?.lines?.find((line) => line.variantId === bread);
check("each item counted keeps what the app had when it was typed; nothing moves yet", typed.status === 200 && typed.json.lines.length === 3 && breadLine?.expectedOnHand === breadBefore && (await levels()).get(bread) === breadBefore, typed.raw);
check("its value so far: one item lost", typed.json?.value?.lostItems === 1 && typed.json.value.foundItems === 0, JSON.stringify(typed.json?.value));
check("a blank takes an item's line away", (await lines([{ variantId: fresh, counted: null }])).json?.lines?.length === 2 && (await lines([{ variantId: fresh, counted: freshBefore }])).json?.lines?.length === 3);
const badLine = await lines([{ variantId: bread, counted: 99 }, { variantId: randomUUID(), counted: 1 }]);
check("one bad line refuses the whole save", badLine.json?.fields?.["lines.1.variantId"] === "product_unavailable" && (await call(`/stock/counts/${countId}`, { cookie: a })).json?.lines?.find((line) => line.variantId === bread)?.counted === breadBefore - 5, badLine.raw);
check("an item listed twice is refused", (await lines([{ variantId: bread, counted: 1 }, { variantId: bread, counted: 2 }])).json?.fields?.["lines.1.variantId"] === "option_duplicate");
check("another shop can't see or fill A's count", (await call(`/stock/counts/${countId}`, { cookie: b })).status === 404 && (await lines([{ variantId: bread, counted: 1 }], countId, b)).status !== 200);
// Sold while counting: the sale isn't taken for a loss.
const soldWhileCounting = await counter(1);
const applied = await call(`/stock/counts/${countId}/apply`, { method: "POST", cookie: a });
const afterCount = await levels();
check(
  "applied: counted − expected goes onto today's stock — a sale made while counting isn't a loss",
  applied.status === 200 && applied.json?.status === "applied" && afterCount.get(bread) === breadBefore - 5 - 1 && afterCount.get(countFrom) === 6,
  JSON.stringify({ status: applied.json?.status, bread: afterCount.get(bread), breadBefore }),
);
await call(`/counter/sales/${soldWhileCounting.json?.id}/void`, { method: "POST", cookie: a });
check("the difference is a count correction, linked to its count", sql(`select type || ',' || quantity from stock_movements where variant_id = '${bread}' and reason = 'count_correction' and stock_count_id = '${countId}'`) === "adjust_out,5");
check("an item that matched writes nothing; one not tracked starts from its count", correctionsOf(fresh) === freshCorrections && afterCount.get(fresh) === freshBefore && sql(`select count(*) from stock_movements where stock_count_id = '${countId}'`) === "1");
check("each line's cost is fixed as it's applied", applied.json?.lines?.find((line) => line.variantId === bread)?.costMinor !== null && sql(`select count(*) from stock_count_lines where count_id = '${countId}' and variant_id = '${bread}' and cost_minor is not null`) === "1");
check("it's applied once: again, or its lines, are refused", (await call(`/stock/counts/${countId}/apply`, { method: "POST", cookie: a })).status === 409 && (await lines([{ variantId: bread, counted: 1 }])).status === 409 && (await levels()).get(bread) === breadBefore - 5);
check("the count list has it, applied", (await call("/stock/counts", { cookie: a })).json?.counts?.some((count) => count.id === countId && count.status === "applied"));
// A count of chosen categories: nothing outside it is counted; cancelled, nothing moves.
const breadCategory = ((await call("/stock", { cookie: a })).json?.items ?? []).find((entry) => entry.variantId === bread)?.categoryId;
const otherCategory = ((await call("/catalog", { cookie: a })).json?.categories ?? []).find((category) => category.id !== breadCategory)?.id;
const narrow = await call("/stock/counts", { method: "POST", cookie: a, body: { categoryIds: [otherCategory] } });
check("a new count starts once the last is applied, over its chosen categories", narrow.json?.id !== countId && narrow.json?.status === "draft" && narrow.json.number === started.json.number + 1 && narrow.json.categoryIds[0] === otherCategory, narrow.raw);
check("an item outside the count's categories is refused", (await lines([{ variantId: bread, counted: 1 }], narrow.json?.id)).json?.fields?.["lines.0.variantId"] === "product_unavailable");
const cancelledCount = await call(`/stock/counts/${narrow.json?.id}/cancel`, { method: "POST", cookie: a });
check("cancelled: kept as cancelled, nothing moved, and it can't be cancelled or applied again", cancelledCount.json?.status === "cancelled" && (await call(`/stock/counts/${narrow.json?.id}/apply`, { method: "POST", cookie: a })).status === 409 && (await call(`/stock/counts/${narrow.json?.id}/cancel`, { method: "POST", cookie: a })).status === 409 && (await levels()).get(bread) === breadBefore - 5);
// The database's own rules, whatever the API does.
// As the app's own user, inside shop A (as the API acts): row security shows its counts, so the rules are what refuse.
const [countStore, countMerchant] = sql(`select store_id || ',' || started_by_id from stock_counts where id = '${countId}'`).split(",");
const asShopA = (statement) => `select set_config('app.merchant_id', '${countMerchant}', false), set_config('app.store_id', '${countStore}', false); ${statement}`;
check("the app sees its own count (so the next checks mean something)", psql(asShopA(`select count(*) from stock_count_lines where count_id = '${countId}'`), { asApp: true }).trim().split("\n").at(-1) === "3");
check("the app can't change or remove an applied count's lines, or delete a count", refusesAsApp(asShopA(`update stock_count_lines set counted = 1 where count_id = '${countId}'`)) && refusesAsApp(asShopA(`delete from stock_count_lines where count_id = '${countId}'`)) && refusesAsApp(asShopA(`delete from stock_counts where id = '${countId}'`)));
check("an applied count never goes back to a draft", refuses(`update stock_counts set status = 'draft', applied_at = null where id = '${countId}'`));
check("a shop has one draft at most", refuses(`insert into stock_counts (store_id, number, location_id) select store_id, 99999, location_id from stock_counts where id = '${countId}' union all select store_id, 99998, location_id from stock_counts where id = '${countId}'`));

// Reorder levels (the minimum/maximum rule): to reorder at the minimum, order up to the maximum.
const reorder = (items, cookie = a) => call("/stock/reorder", { method: "POST", cookie, body: { items } });
const set = await reorder([{ variantId: bread, min: 10, max: 40 }]);
check("reorder levels save; 30 on hand above a minimum of 10 isn't to reorder", set.status === 200 && (await item())?.reorderMin === 10 && (await item())?.low === false && (await item())?.suggested === null, set.raw);
await reorder([{ variantId: bread, min: 30, max: 40 }]);
const due = await item();
check("at its minimum it's to reorder, up to the maximum, from where it was last bought", due?.low === true && due.suggested === 10 && due.lastSupplierName === "Chhay Auto Parts" && due.lastCostMinor === 2900, JSON.stringify(due));
check("a maximum below the minimum is refused", (await reorder([{ variantId: bread, min: 30, max: 20 }])).json?.fields?.["items.0.max"] === "reorder_max_below_min" && (await item())?.reorderMax === 40);
const untrackedNow = ((await call("/stock", { cookie: a })).json?.items ?? []).find((entry) => entry.onHand === null)?.variantId;
check("an item not tracked has no reorder level", (await reorder([{ variantId: untrackedNow, min: 1, max: 2 }])).json?.fields?.["items.0.variantId"] === "product_unavailable");
check("another shop can't set A's levels", (await reorder([{ variantId: bread, min: 0, max: 0 }], b)).status !== 200 && (await item())?.reorderMin === 30);
check("the database refuses a maximum below the minimum", refuses(`update stock_levels set reorder_min = 5, reorder_max = 1 where variant_id = '${bread}'`));
await reorder([{ variantId: bread, min: null, max: null }]);
check("cleared, it's back on the shop's rule", (await item())?.reorderMin === null && (await item())?.low === false);

// A tracked option's cost is its bills' average: saving the product form doesn't change it.
const breadProduct = (await call("/products", { cookie: a })).json.find((product) => product.titleEn === "Bread");
const breadVariant = breadProduct.variants[0];
const resaved = await call(`/products/${breadProduct.id}`, {
  method: "PUT",
  cookie: a,
  body: {
    product: {
      titleKm: breadProduct.titleKm,
      titleEn: breadProduct.titleEn,
      categoryId: breadProduct.categoryId,
      isVisible: breadProduct.isVisible,
      ...(breadVariant.priceUsdCents === null ? {} : { retailPriceUsdCents: breadVariant.priceUsdCents }),
      ...(breadVariant.priceKhr === null ? {} : { retailPriceKhr: breadVariant.priceKhr }),
      costMinor: 1,
      costCurrency: "USD",
    },
    photoKeys: [],
  },
});
check("the product form can't change a tracked option's cost", resaved.status === 200 && (await item())?.costMinor === 2600, resaved.raw);

// A bill in the other currency: each line turned once into the item's cost currency, at the bill's rate (kept on the bill).
const beforeTurn = (await call("/stock", { cookie: a })).json?.items?.find((entry) => entry.variantId === dollarItem);
const turned = await buy(bill([{ variantId: dollarItem, quantity: 2, unitCost: 41000 }], { currency: "KHR", exchangeRate: 4100, payment: { method: "cash" } }));
const turnedLine = turned.json?.lines?.[0];
const afterTurn = (await call("/stock", { cookie: a })).json?.items?.find((entry) => entry.variantId === dollarItem);
const expectedAverage = Math.round((beforeTurn.onHand * beforeTurn.costMinor + 2 * 1000) / (beforeTurn.onHand + 2));
check(
  "a riel bill for a dollar item: ៛41,000 at 4,100 is $10.00, averaged in dollars; the bill stays in riel and keeps its rate",
  turned.status === 200 && turned.json.currency === "KHR" && turned.json.totalMinor === 82000 && turned.json.exchangeRateUsed === 4100 &&
    turnedLine?.unitCostMinor === 41000 && turnedLine.itemCostMinor === 1000 && turnedLine.itemCostCurrency === "USD" &&
    afterTurn?.costCurrency === "USD" && afterTurn.costMinor === expectedAverage && afterTurn.onHand === beforeTurn.onHand + 2,
  JSON.stringify({ line: turnedLine, before: beforeTurn?.costMinor, after: afterTurn?.costMinor, expectedAverage }),
);
const turnedMove = (await call("/stock", { cookie: a })).json?.movements?.find((entry) => entry.purchaseId === turned.json?.id);
check("its history shows the dollar cost and the rate it was turned at", turnedMove?.unitCostMinor === 1000 && turnedMove.costCurrency === "USD" && turnedMove.billCurrency === "KHR" && turnedMove.billRate === 4100, JSON.stringify(turnedMove));
const sameCurrency = await buy(bill([{ variantId: dollarItem, quantity: 1, unitCost: 900 }], { exchangeRate: 4100 }));
check("a bill with nothing to turn keeps no rate", sameCurrency.json?.exchangeRateUsed === null && sameCurrency.json.lines?.[0]?.itemCostMinor === 900, sameCurrency.raw);
const turnedBack = await call(`/purchases/${turned.json?.id}/returns`, { method: "POST", cookie: a, body: { lines: [{ variantId: dollarItem, quantity: 1 }] } });
const returnLine = (await call(`/purchases/${turnedBack.json?.returnedBy?.[0]?.id}`, { cookie: a })).json?.lines?.[0];
check("a return from it is valued as bought: the riel price and the same dollar cost, average kept", returnLine?.unitCostMinor === 41000 && returnLine.itemCostMinor === 1000 && returnLine.itemCostCurrency === "USD" && (await call("/stock", { cookie: a })).json?.items?.find((entry) => entry.variantId === dollarItem)?.costMinor === Math.round(((afterTurn.onHand * afterTurn.costMinor + 900) / (afterTurn.onHand + 1))), JSON.stringify(returnLine));
check("the database refuses an item cost without its currency", refuses(`update purchase_lines set item_cost_currency = null where purchase_id = '${turned.json?.id}'`));

// The stock report (design/screens.md S17 "Stock"): each item's opening, in, out and closing, against the database.
const storeA = `(select id from stores where slug = '${slugA}')`;
const report = (search, cookie = a) => call(`/stock/report?${search}`, { cookie });
const everything = (await report("period=all")).json;
const breadRow = everything?.rows?.find((row) => row.variantId === bread);
const dbIn = Number(sql(`select coalesce(sum(quantity), 0) from stock_movements where variant_id = '${bread}' and type in ('purchase', 'adjust_in')`));
const dbOut = Number(sql(`select coalesce(sum(quantity), 0) from stock_movements where variant_id = '${bread}' and type in ('sale', 'adjust_out')`));
check(
  "every movement: an item's in and out match the database, and its closing is what's on hand",
  breadRow?.in === dbIn && breadRow.out === dbOut && breadRow.closing === (await levels()).get(bread) && breadRow.opening === breadRow.closing - dbIn + dbOut,
  JSON.stringify({ breadRow, dbIn, dbOut }),
);
const dbValue = Number(sql(`select coalesce(sum(l.on_hand * v.cost_minor), 0) from stock_levels l join product_variants v on v.id = l.variant_id where l.store_id = ${storeA} and v.cost_currency = 'USD' and v.deleted_at is null`));
check("what the shelf is worth now: on hand × cost, in dollars, matches the database", everything?.figures?.value?.USD === dbValue, JSON.stringify({ report: everything?.figures?.value, dbValue }));
check("units in and out add up the bars", everything?.series?.reduce((sum, point) => sum + point.in, 0) === everything?.figures?.inUnits && everything.series.reduce((sum, point) => sum + point.out, 0) === everything.figures.outUnits);
check("each item tracked has a row; an untracked one counts only as untracked", everything?.rows?.length === everything?.levels?.out + everything?.levels?.low + everything?.levels?.ok);
const before2000 = (await report("period=custom&from=2000-01-01&to=2000-01-31")).json?.rows?.find((row) => row.variantId === bread);
check("a period long before anything moved: nothing in or out, and opening = closing = what was there then (nothing)", before2000?.in === 0 && before2000.out === 0 && before2000.closing === breadRow.closing - dbIn + dbOut, JSON.stringify(before2000));
const todayOnly = (await report("period=today")).json;
check("today: its own bars and what moved today only", todayOnly?.series?.length === 1 && todayOnly.figures.inUnits <= everything.figures.inUnits, JSON.stringify(todayOnly?.series));
check("a bad period, or a range in the wrong order, is refused", (await report("period=forever")).status === 400 && (await report("period=custom&from=2026-02-01&to=2026-01-01")).status === 400);
check("another shop's report never has A's items", !((await report("period=all", b)).json?.rows ?? []).some((row) => row.variantId === bread));

// The stock counts report (design/screens.md S17 "Stock counts"): what the applied counts found missing or extra, against the database.
const countReport = (search, cookie = a) => call(`/stock/counts/report?${search}`, { cookie });
const counted = await countReport("period=all");
const appliedLines = `from stock_count_lines l join stock_counts c on c.id = l.count_id where c.store_id = ${storeA} and c.status = 'applied' and l.expected_on_hand is not null`;
const dbLost = Number(sql(`select coalesce(sum(l.expected_on_hand - l.counted), 0) ${appliedLines} and l.counted < l.expected_on_hand`));
const dbFound = Number(sql(`select coalesce(sum(l.counted - l.expected_on_hand), 0) ${appliedLines} and l.counted > l.expected_on_hand`));
const dbLostUsd = Number(sql(`select coalesce(sum((l.counted - l.expected_on_hand) * l.cost_minor), 0) ${appliedLines} and l.counted < l.expected_on_hand and l.cost_currency = 'USD'`));
check("the counts report answers on its own route (not taken for a count's id)", counted.status === 200 && counted.json?.counts?.some((row) => row.id === countId), counted.raw);
check("only applied counts, and units lost and found match the database", counted.json?.counts?.length === Number(sql(`select count(*) from stock_counts where store_id = ${storeA} and status = 'applied'`)) && counted.json.figures.lostUnits === dbLost && counted.json.figures.foundUnits === dbFound, JSON.stringify({ figures: counted.json?.figures, dbLost, dbFound }));
check("what was lost is worth its fixed cost: the dollars match the database", counted.json?.figures?.lost?.USD === dbLostUsd, JSON.stringify({ lost: counted.json?.figures?.lost, dbLostUsd }));
check("the item counted short is among the most often short, with its 5 units", counted.json?.items?.some((entry) => entry.variantId === bread && entry.unitsLost >= 5 && entry.timesShort >= 1), JSON.stringify(counted.json?.items));
check("a period long before any count is empty", (await countReport("period=custom&from=2000-01-01&to=2000-01-31")).json?.figures?.counts === 0);
check("the counts report refuses a bad period", (await countReport("period=forever")).status === 400);
check("another shop's counts report never has A's counts", !((await countReport("period=all", b)).json?.counts ?? []).some((row) => row.id === countId));

const stopped = await call(`/stock/track/${bread}`, { method: "DELETE", cookie: a });
check("stopping tracking sells without a limit again", stopped.status === 200 && (await onHand()) === null && (await call(`/public/stores/${slugA}`)).json?.stock?.[bread] === undefined);

sql(`update platform_settings set beta_all_basic = ${beta === "true"} where id = 1`);
sql(`update subscriptions set plan = '${before[0]}', status = '${before[1]}' where ${subscriptionOf}`);
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
