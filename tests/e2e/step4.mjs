// Step 4 part A end-to-end through the real API: delivery settings, store
// settings, placing cash orders as a buyer (totals, idempotency, refusals),
// the buyer's order page and the seller's order list. PASS/FAIL lines.
// Usage: node tests/e2e/step4.mjs <api url>   (run after step2/3 on the same database)
import { randomUUID } from "node:crypto";
import { saveShopDetails } from "./lib.mjs";

const B = process.argv[2] ?? "http://localhost:4105";
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
};
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
const slugB = (await call("/auth/me", { cookie: b })).json.store.slug;

// ---------------------------------------------------------------- products to sell
const catA = (await call("/catalog", { cookie: a })).json.categories[0].id;
const make = async (cookie, category, product) =>
  (await call("/products", { method: "POST", cookie, body: { product: { categoryId: category, isVisible: true, ...product }, photoKeys: [] } })).json.id;
const simpleId = await make(a, catA, { titleKm: "នំបុ័ង", titleEn: "Bread", retailPriceUsdCents: 125, retailPriceKhr: 5000 });
const coffeeId = await make(a, catA, {
  titleKm: "កាហ្វេ",
  titleEn: "Coffee",
  options: [
    { id: "d1", sku: "", labelKm: "តូច", labelEn: "Small", retailPriceUsdCents: 100 },
    { id: "d2", sku: "", labelKm: "ធំ", labelEn: "Large", retailPriceKhr: 7000 },
  ],
});
const hiddenId = await make(a, catA, { titleKm: "លាក់", titleEn: "Hidden thing", retailPriceUsdCents: 300, isVisible: false });
const productsA = (await call("/products", { cookie: a })).json;
const variantOf = (id, index = 0) => productsA.find((p) => p.id === id).variants[index].id;
const bread = variantOf(simpleId);
const coffeeLarge = variantOf(coffeeId, 1);
const hidden = variantOf(hiddenId);
const catB = (await call("/catalog", { cookie: b })).json.categories[0].id;
const bProductId = await make(b, catB, { titleKm: "សេវា", titleEn: "Haircut", retailPriceUsdCents: 500 });
const bVariant = (await call(`/products/${bProductId}`, { cookie: b })).json.variants[0].id;

const checkout = (extra = {}) => ({
  name: "សុខា",
  phone: "097 123 4567",
  currency: "USD",
  fulfilment: "delivery",
  area: "phnom_penh",
  districtId: "daun-penh",
  landmark: "Opposite Wat Phnom",
  paymentMethod: "cod",
  ...extra,
});
const order = (lines, extra = {}, key = randomUUID(), slug = slugA) =>
  call(`/public/stores/${slug}/orders`, { method: "POST", body: { idempotencyKey: key, lines, checkout: checkout(extra) } });

// ---------------------------------------------------------------- before delivery is saved
check("the shop page says ordering isn't open before delivery is saved", (await call(`/public/stores/${slugA}`)).json?.ordering?.deliveryConfigured === false);
const early = await order([{ variantId: bread, quantity: 1 }]);
check("an order before delivery is saved is refused (not_accepting_orders)", early.status === 409 && early.json?.error === "not_accepting_orders", early.raw);

// ---------------------------------------------------------------- delivery settings
const nothing = await call("/delivery", { method: "PUT", cookie: a, body: { zones: [], pickup: { enabled: false, address: "", hours: "" }, province: { enabled: false, note: "" }, drivers: [] } });
check("delivery with nothing turned on is refused", nothing.json?.fields?.zones === "delivery_required", nothing.raw);
const deliveryBody = {
  zones: [
    { id: "z1", name: "Central", districtIds: ["daun-penh", "chamkar-mon"], feeUsdCents: 150 },
    { id: "z2", name: "Outer", districtIds: ["sen-sok"], feeKhr: 6000 },
  ],
  pickup: { enabled: true, address: "St. 271, near Aeon 2", hours: "8:00–18:00" },
  province: { enabled: true, note: "Virak Buntham, next day", feeUsdCents: 200 },
  drivers: [{ id: "new-1", name: "Dara", phone: "012 345 678", kind: "own" }],
};
const dup = await call("/delivery", { method: "PUT", cookie: a, body: { ...deliveryBody, zones: [deliveryBody.zones[0], { ...deliveryBody.zones[1], districtIds: ["daun-penh"] }] } });
check("a district in two zones is refused", dup.json?.fields?.["zones.1.districtIds"] === "district_duplicate", dup.raw);
const saved = await call("/delivery", { method: "PUT", cookie: a, body: deliveryBody });
check("delivery saves: zones, provinces and the driver", saved.status === 200 && saved.json?.settings?.zones?.length === 2 && saved.json.settings.drivers[0]?.phone === "85512345678" && saved.json.configured === true, saved.raw);
const driverId = saved.json.settings.drivers[0].id;
const resaved = await call("/delivery", { method: "PUT", cookie: a, body: { ...deliveryBody, drivers: [{ ...deliveryBody.drivers[0], id: driverId, name: "Dara S." }] } });
check("saving again keeps the driver's id", resaved.json?.settings?.drivers?.[0]?.id === driverId && resaved.json.settings.drivers[0].name === "Dara S.");
check("delivery doesn't switch pickup on: that's on Shop details", resaved.json?.settings?.pickup?.enabled === false);
// Pickup is set with the shop address on Shop details (design/screens.md S10).
const pickupOn = await saveShopDetails(call, a, { address: "St. 271, near Aeon 2", pickupEnabled: true, pickupHours: "8:00–18:00" });
check("pickup switches on with the shop address", pickupOn.status === 200 && pickupOn.json?.pickupEnabled === true && pickupOn.json.pickupAddress === "St. 271, near Aeon 2", pickupOn.raw);
const deliveryAgain = await call("/delivery", { method: "PUT", cookie: a, body: { ...deliveryBody, pickup: { enabled: false, address: "", hours: "" } } });
check("saving delivery leaves pickup as Shop details set it", deliveryAgain.json?.settings?.pickup?.enabled === true && deliveryAgain.json.settings.pickup.address === "St. 271, near Aeon 2", deliveryAgain.raw);
check("the setup checklist now counts delivery as done", (await call("/store", { cookie: a })).json?.readiness?.deliveryConfigured === true);
check("B's delivery page shows none of A's zones or drivers", (await call("/delivery", { cookie: b })).json?.settings?.zones?.length === 0);
const shopA = (await call(`/public/stores/${slugA}`)).json;
check("the shop page shows zones, pickup and provinces — and no drivers", shopA.delivery?.zones?.length === 2 && shopA.delivery.pickup.enabled && !JSON.stringify(shopA).includes("Dara"));

// ---------------------------------------------------------------- store settings
// Prices & tax are part of Shop details (design/screens.md S9 → S10).
const settings = (await call("/store", { cookie: a })).json;
check("shop details come with the platform's allowed rate band", settings?.usdToKhrRate === 4100 && settings.rateBand?.min > 0, JSON.stringify(settings));
const outOfBand = await saveShopDetails(call, a, { usdToKhrRate: 9999 });
check("a rate outside the band is refused", outOfBand.json?.fields?.usdToKhrRate === "rate_out_of_band", outOfBand.raw);
const badVat = await saveShopDetails(call, a, { usdToKhrRate: 4000, vatPercent: 25 });
check("VAT over 20% is refused", badVat.json?.fields?.vatPercent === "vat_range", badVat.raw);
const set = await saveShopDetails(call, a, { usdToKhrRate: 4000, allowCod: true, vatPercent: 10 });
check("prices & tax save (rate 4,000៛, VAT 10%)", set.json?.usdToKhrRate === 4000 && set.json.vatPercent === 10, set.raw);

// ---------------------------------------------------------------- a cash order, totals checked
const key = randomUUID();
const lines = [{ variantId: bread, quantity: 2 }, { variantId: coffeeLarge, quantity: 1 }];
const placed = await order(lines, { totalMinor: 1 }, key);
check("a cash order is placed (201) with a link token and number 1", placed.status === 201 && /^[A-Za-z0-9_-]{32}$/.test(placed.json?.token ?? "") && placed.json.orderNumber === 1, placed.raw);
const page = await call(`/public/orders/${placed.json.token}`);
const o = page.json;
// Bread $1.25 × 2 = 250; Large 7,000៛ at 4,000 = 175; goods 425; VAT 10% = round(42.5) = 43; Central fee 150. A total sent by the browser is ignored.
check("the total is recalculated by the API: 425 + VAT 43 + delivery 150 = $6.18", o?.totalMinor === 618 && o.subtotalMinor === 425 && o.vatMinor === 43 && o.deliveryFeeMinor === 150, JSON.stringify(o));
check("the rate used is frozen on the order", o?.exchangeRateUsed === 4000 && o.currency === "USD");
check("each line is a snapshot with its unit price", o?.items?.length === 2 && o.items[0].unitPriceMinor === 125 && o.items[0].lineTotalMinor === 250 && o.items[1].variantLabelEn === "Large");
check("a cash order starts as COD pending, with its history", o?.status === "cod_pending" && o.events?.[0]?.status === "cod_pending");
check("the order page doesn't show the buyer's phone", !JSON.stringify(o).includes("97123") && o?.buyerName === "សុខា");

const again = await order(lines, {}, key);
check("the same checkout sent again gives the same order (200), not a new one", again.status === 200 && again.json?.token === placed.json.token && again.json.orderNumber === 1, again.raw);
const raceKey = randomUUID();
const race = await Promise.all([1, 2, 3].map(() => order([{ variantId: bread, quantity: 1 }], {}, raceKey)));
check("three copies sent at the same moment make one order", new Set(race.map((r) => r.json?.token)).size === 1 && race.every((r) => r.status === 200 || r.status === 201), JSON.stringify(race.map((r) => [r.status, r.json?.orderNumber])));

const khr = await order([{ variantId: bread, quantity: 1 }], { currency: "KHR", districtId: "sen-sok" });
const khrOrder = (await call(`/public/orders/${khr.json?.token}`)).json;
// 5,000៛ native; VAT 500; Outer fee 6,000៛.
check("a riel order uses riel prices and the riel fee: 5,000 + 500 + 6,000 = 11,500៛", khrOrder?.totalMinor === 11500 && khrOrder.currency === "KHR", JSON.stringify(khrOrder));
const pickup = await order([{ variantId: bread, quantity: 1 }], { fulfilment: "pickup", districtId: undefined });
const pickupOrder = (await call(`/public/orders/${pickup.json?.token}`)).json;
check("a pickup order has no delivery fee and keeps the pickup address", pickupOrder?.deliveryFeeMinor === 0 && pickupOrder.pickupAddress === "St. 271, near Aeon 2", JSON.stringify(pickupOrder));

// ---------------------------------------------------------------- refusals
const khqr = await order([{ variantId: bread, quantity: 1 }], { paymentMethod: "khqr" });
check("KHQR isn't offered until step 5", khqr.json?.fields?.paymentMethod === "payment_unavailable", khqr.raw);
const provinceCod = await order([{ variantId: bread, quantity: 1 }], { area: "province", provinceId: "battambang", districtId: undefined });
check("cash on delivery to a province is refused (provinces prepay)", provinceCod.json?.fields?.paymentMethod === "cod_unavailable", provinceCod.raw);
const notCovered = await order([{ variantId: bread, quantity: 1 }], { districtId: "russey-keo" });
check("a district the shop doesn't deliver to is refused", notCovered.json?.fields?.districtId === "delivery_unavailable", notCovered.raw);
check("a hidden product can't be ordered", (await order([{ variantId: hidden, quantity: 1 }])).json?.fields?.["lines.0"] === "product_unavailable");
check("another shop's product can't be ordered here", (await order([{ variantId: bVariant, quantity: 1 }])).json?.fields?.["lines.0"] === "product_unavailable");
check("a quantity over 99 is refused", (await order([{ variantId: bread, quantity: 100 }])).json?.fields?.["lines.0.quantity"] === "quantity_invalid");
check("a wrong phone number is refused", (await order([{ variantId: bread, quantity: 1 }], { phone: "123" })).json?.fields?.phone === "phone_invalid");
check("an unknown shop link is 404", (await order([{ variantId: bread, quantity: 1 }], {}, randomUUID(), "no-such-shop-xyz")).status === 404);
check("an unknown order link is 404", (await call(`/public/orders/${"x".repeat(32)}`)).status === 404);
check("a malformed order link is 404", (await call("/public/orders/1")).status === 404);

await saveShopDetails(call, a, { usdToKhrRate: 4000, allowCod: false, vatPercent: 10 });
const noWayToPay = await order([{ variantId: bread, quantity: 1 }]);
check("with cash on delivery off and no KHQR yet, the shop doesn't take orders", noWayToPay.status === 409 && noWayToPay.json?.error === "not_accepting_orders", noWayToPay.raw);
await saveShopDetails(call, a, { usdToKhrRate: 4100, allowCod: true, vatPercent: 0 });

// ---------------------------------------------------------------- the seller's order list
const listA = (await call("/orders", { cookie: a })).json;
check("the seller sees their orders, newest first, with item counts", Array.isArray(listA) && listA.length === 4 && listA[0].orderNumber > listA[listA.length - 1].orderNumber && listA.find((x) => x.orderNumber === 1)?.itemCount === 3, JSON.stringify(listA?.map((x) => x.orderNumber)));
check("the seller sees the buyer's phone (stored as 855…)", listA?.[0]?.buyerPhone === "855971234567");
check("B's order list has none of A's orders", ((await call("/orders", { cookie: b })).json ?? []).length === 0);
check("the order list needs a login", (await call("/orders")).status === 401);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
