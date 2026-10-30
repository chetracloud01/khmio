// Catalog structure end-to-end through the real API (Features for my
// business; product option groups and choices): modules switched on and off,
// and the API refusing what a switched-off module needs; a product with
// Size × Colour variants and choice groups; the shop page offering choices
// only while they're on; orders and counter sales with choices and a note,
// priced by the API with each extra, and refused when a choice is missing or
// wrong; edits keeping ids. PASS/FAIL lines.
// Usage: node tests/e2e/catalog.mjs <api url>   (after stock on the same database)
import { randomUUID } from "node:crypto";
import { psql } from "./lib.mjs";

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
const slugA = (await call("/auth/me", { cookie: a })).json.store.slug;
const before = (await call("/store/modules", { cookie: a })).json?.modules ?? [];
const setModules = (modules) => call("/store/modules", { method: "PUT", cookie: a, body: { modules } });

// --- modules
check("a shop starts with its business type's modules", Array.isArray(before) && before.includes("options"), JSON.stringify(before));
check("an unknown module is refused", (await setModules(["options", "accounting"])).status === 400);
const on = await setModules(["choices", "options", "choices"]);
check("modules save once each, in a fixed order", on.status === 200 && JSON.stringify(on.json?.modules) === JSON.stringify(["options", "choices"]), on.raw);
check("the shop's details carry its modules", JSON.stringify((await call("/store", { cookie: a })).json?.modules) === JSON.stringify(["options", "choices"]));

// --- a product with Size × Colour and choices
const categoryId = (await call("/catalog", { cookie: a })).json.categories[0].id;
const product = (overrides = {}) => ({
  product: {
    titleKm: "កាហ្វេទឹកកក",
    titleEn: "Iced coffee",
    categoryId,
    variantGroups: [
      { id: "size", nameKm: "ទំហំ", nameEn: "Size", values: [{ id: "s", labelKm: "តូច", labelEn: "S" }, { id: "m", labelKm: "មធ្យម", labelEn: "M" }] },
      { id: "cup", nameKm: "កែវ", nameEn: "Cup", values: [{ id: "glass", labelKm: "កែវ", labelEn: "Glass" }] },
    ],
    choiceGroups: [
      { id: "sugar", nameKm: "ស្ករ", nameEn: "Sugar", pick: "one", required: true, values: [{ id: "less", labelKm: "តិច", labelEn: "Less" }, { id: "normal", labelKm: "ធម្មតា", labelEn: "Normal" }] },
      { id: "add", nameKm: "បន្ថែម", nameEn: "Add-ons", pick: "many", required: false, values: [{ id: "shot", labelKm: "កាហ្វេបន្ថែម", labelEn: "+1 shot", extraUsdCents: 50 }, { id: "jelly", labelKm: "ចាហួយ", labelEn: "Jelly", extraKhr: 1000 }] },
    ],
    options: [
      { id: "o1", sku: "", labelKm: "", labelEn: "", valueIds: ["s", "glass"], retailPriceUsdCents: 300 },
      { id: "o2", sku: "", labelKm: "", labelEn: "", valueIds: ["m", "glass"], retailPriceUsdCents: 350 },
    ],
    ...overrides,
  },
  photoKeys: [],
});
const created = await call("/products", { method: "POST", cookie: a, body: product() });
const productId = created.json?.id;
check("a product with variant groups and choice groups saves", created.status === 201 && !!productId, created.raw);
const saved = (await call(`/products/${productId}`, { cookie: a })).json;
const small = saved?.variants?.find((variant) => variant.labelEn === "S · Glass");
check("each variant is named from its values", !!small && saved.variants.some((variant) => variant.labelEn === "M · Glass" && variant.labelKm === "មធ្យម · កែវ"), JSON.stringify(saved?.variants));
check("and keeps one value per group, in the groups' order", small?.valueIds?.length === 2 && small.valueIds[0] === saved.variantGroups[0].values[0].id);
const sugar = saved?.choiceGroups?.find((group) => group.nameEn === "Sugar");
const addOns = saved?.choiceGroups?.find((group) => group.nameEn === "Add-ons");
const less = sugar?.values.find((value) => value.labelEn === "Less")?.id;
const normal = sugar?.values.find((value) => value.labelEn === "Normal")?.id;
const shot = addOns?.values.find((value) => value.labelEn === "+1 shot")?.id;
check("choice groups keep their rules and extra prices", sugar?.required === true && sugar.pick === "one" && addOns?.pick === "many" && addOns.values.some((value) => value.extraUsdCents === 50));

const missing = await call("/products", { method: "POST", cookie: a, body: product({ options: [{ id: "x", sku: "", labelKm: "", labelEn: "", valueIds: ["s"], retailPriceUsdCents: 300 }] }) });
check("an option missing a group's value is refused", missing.json?.fields?.["options.0.valueIds"] === "option_values_invalid", missing.raw);

// --- editing keeps ids (a buyer's cart may hold them)
const edited = await call(`/products/${productId}`, {
  method: "PUT",
  cookie: a,
  body: {
    product: {
      titleKm: saved.titleKm,
      titleEn: saved.titleEn,
      categoryId,
      variantGroups: saved.variantGroups,
      choiceGroups: saved.choiceGroups.map((group) => ({ ...group, values: group.values.map(({ extraUsdCents, extraKhr, ...value }) => ({ ...value, ...(extraUsdCents === null ? {} : { extraUsdCents }), ...(extraKhr === null ? {} : { extraKhr }) })) })),
      options: saved.variants.map((variant) => ({ id: variant.id, sku: variant.sku, labelKm: "", labelEn: "", valueIds: variant.valueIds, retailPriceUsdCents: variant.priceUsdCents })),
    },
    photoKeys: [],
  },
});
const again = (await call(`/products/${productId}`, { cookie: a })).json;
check("saving it again keeps every group, value and variant id", edited.status === 200 && again?.choiceGroups?.[0]?.values?.[0]?.id === saved.choiceGroups[0].values[0].id && again.variants[0].id === saved.variants[0].id, edited.raw);

// --- the shop page and orders
const shopProduct = async () => (await call(`/public/stores/${slugA}`)).json?.products?.find((entry) => entry.id === productId);
check("the shop page offers the choices", (await shopProduct())?.choiceGroups?.length === 2);
const order = (lines) =>
  call(`/public/stores/${slugA}/orders`, {
    method: "POST",
    body: {
      idempotencyKey: randomUUID(),
      lines,
      checkout: { name: "Dara", phone: "097 123 4567", currency: "USD", fulfilment: "pickup", area: "phnom_penh", landmark: "", paymentMethod: "cod" },
    },
  });
const placed = await order([
  { variantId: small.id, quantity: 2, choiceIds: [less, shot], note: "no ice" },
  { variantId: small.id, quantity: 1, choiceIds: [normal] },
]);
const page = (await call(`/public/orders/${placed.json?.token}`)).json;
const first = page?.items?.find((item) => item.note === "no ice");
check("one option twice with different choices is two lines", placed.status === 201 && page?.items?.length === 2, placed.raw);
check("a line keeps its choices, their extra and the note", first?.choices?.map((choice) => choice.labelEn).join(",") === "Less,+1 shot" && first.choices[1].extraMinor === 50, JSON.stringify(first));
check("the API adds each extra to the unit price", first?.unitPriceMinor === 350 && first.lineTotalMinor === 700 && page.subtotalMinor === 1000, JSON.stringify(page?.items));
const noSugar = await order([{ variantId: small.id, quantity: 1, choiceIds: [shot] }]);
check("a required choice left out is refused", noSugar.json?.fields?.["lines.0"] === "choice_required", noSugar.raw);
const both = await order([{ variantId: small.id, quantity: 1, choiceIds: [less, normal] }]);
check("two picks in a 'pick one' group are refused", both.json?.fields?.["lines.0"] === "choice_invalid", both.raw);

const sale = await call("/counter/sales", {
  method: "POST",
  cookie: a,
  body: { idempotencyKey: randomUUID(), currency: "USD", lines: [{ variantId: small.id, quantity: 1, choiceIds: [less, shot], note: "to go" }], payment: { method: "cash", receivedMinor: 1000 }, buyerName: "", buyerPhone: "" },
});
const sold = (await call(`/orders/${sale.json?.id}`, { cookie: a })).json;
check("a counter sale takes choices too", sale.status === 200 && sold?.items?.[0]?.choices?.length === 2 && sold.items[0].note === "to go" && sold.totalMinor === 350, sale.raw);

// --- switching a module off
await setModules(["options"]);
check("with choices off, the shop page offers none", (await shopProduct())?.choiceGroups?.length === 0);
check("an order naming one is refused", (await order([{ variantId: small.id, quantity: 1, choiceIds: [less] }])).json?.fields?.["lines.0"] === "choice_invalid");
check("and without, it's taken (nothing is required while off)", (await order([{ variantId: small.id, quantity: 1 }])).status === 201);
const offSave = await call("/products", { method: "POST", cookie: a, body: product() });
check("a product can't add choice groups while they're off", offSave.status === 403 && offSave.json?.error === "module_off", offSave.raw);
check("what the product had is kept", (await call(`/products/${productId}`, { cookie: a })).json?.choiceGroups?.length === 2);

// --- the shop's own fields
await setModules(["options", "customFields"]);
const fieldsSaved = await call("/custom-fields", {
  method: "PUT",
  cookie: a,
  body: {
    fields: [
      { id: "warranty", target: "product", type: "number", labelKm: "ធានា", labelEn: "Warranty (months)", options: [], required: false, public: true },
      { id: "supplier", target: "product", type: "text", labelKm: "អ្នកផ្គត់ផ្គង់", labelEn: "Supplier", options: [], required: false, public: false },
      { id: "imei", target: "orderLine", type: "text", labelKm: "IMEI", labelEn: "IMEI", options: [], required: true, public: false },
    ],
  },
});
const fieldId = (name) => fieldsSaved.json?.fields?.find((field) => field.labelEn.startsWith(name))?.id;
check("the shop saves its own fields", fieldsSaved.status === 200 && fieldsSaved.json?.fields?.length === 3, fieldsSaved.raw);
check("a field on each item sold is never shown to buyers", fieldsSaved.json?.fields?.find((field) => field.labelEn === "IMEI")?.public === false);
const phone = (customValues) => ({ product: { titleKm: "ទូរស័ព្ទ", titleEn: "Phone", categoryId, retailPriceUsdCents: 15000, customValues }, photoKeys: [] });
const wrong = await call("/products", { method: "POST", cookie: a, body: phone({ [fieldId("Warranty")]: "twelve" }) });
check("a value of the wrong kind is refused under its field", wrong.json?.fields?.[`customValues.${fieldId("Warranty")}`] === "number_invalid", wrong.raw);
const phoneSaved = await call("/products", { method: "POST", cookie: a, body: phone({ [fieldId("Warranty")]: 12, [fieldId("Supplier")]: "Wholesaler #4" }) });
const phoneId = phoneSaved.json?.id;
check("a product keeps its own fields' values", (await call(`/products/${phoneId}`, { cookie: a })).json?.customValues?.[fieldId("Supplier")] === "Wholesaler #4", phoneSaved.raw);
const publicPhone = (await call(`/public/stores/${slugA}`)).json;
check(
  "the shop page shows the public field and never the private one",
  publicPhone?.products?.find((entry) => entry.id === phoneId)?.customValues?.[fieldId("Warranty")] === 12 && !JSON.stringify(publicPhone).includes("Wholesaler #4") && !JSON.stringify(publicPhone).includes("IMEI"),
);
const phoneVariant = (await call(`/products/${phoneId}`, { cookie: a })).json.variants[0].id;
const phoneOrder = await order([{ variantId: phoneVariant, quantity: 1 }]);
const orderId = (await call("/orders", { cookie: a })).json?.find((entry) => entry.orderNumber === phoneOrder.json?.orderNumber)?.id;
const detail = (await call(`/orders/${orderId}`, { cookie: a })).json;
const lineId = detail?.items?.[0]?.id;
const missingImei = await call(`/orders/${orderId}/items/${lineId}/fields`, { method: "PUT", cookie: a, body: { values: {} } });
check("a required line field must be filled in", missingImei.json?.fields?.[`customValues.${fieldId("IMEI")}`] === "required", missingImei.raw);
const imei = await call(`/orders/${orderId}/items/${lineId}/fields`, { method: "PUT", cookie: a, body: { values: { [fieldId("IMEI")]: "356938035643809" } } });
check("the seller fills in an item's own field on the order", imei.status === 200 && imei.json?.items?.[0]?.customValues?.[fieldId("IMEI")] === "356938035643809", imei.raw);
check("the buyer's order page never shows it", !JSON.stringify((await call(`/public/orders/${phoneOrder.json?.token}`)).json).includes("356938035643809"));
await setModules(["options"]);
check("with own fields off, saving them is refused", (await call("/custom-fields", { method: "PUT", cookie: a, body: { fields: [] } })).json?.error === "module_off");

// --- services and bookings
const haircut = (kind) => ({ product: { titleKm: "កាត់សក់", titleEn: "Haircut", categoryId, retailPriceUsdCents: 500, kind }, photoKeys: [] });
check("a service can't be made while services are off", (await call("/products", { method: "POST", cookie: a, body: haircut("service") })).json?.error === "module_off");
await setModules(["options", "services"]);
const serviceSaved = await call("/products", { method: "POST", cookie: a, body: haircut("service") });
check("a service never shows in the stock list: nothing on a shelf to count", !((await call("/stock", { cookie: a })).json?.items ?? []).some((entry) => entry.productId === serviceSaved.json?.id));
const serviceId = serviceSaved.json?.id;
const service = (await call(`/products/${serviceId}`, { cookie: a })).json;
check("a product can be a service", service?.kind === "service", serviceSaved.raw);
// Stock is a Pro feature: on Pro for this check, then back as it was.
const subscriptionOf = `store_id = (select id from stores where slug = '${slugA}')`;
const planBefore = psql(`select plan || ',' || status from subscriptions where ${subscriptionOf}`).trim().split(",");
const beta = psql("select beta_all_basic::text from platform_settings where id = 1").trim();
psql("update platform_settings set beta_all_basic = false where id = 1");
psql(`update subscriptions set plan = 'pro', status = 'active' where ${subscriptionOf}`);
const tracked = await call("/stock/track", { method: "POST", cookie: a, body: { variantId: service.variants[0].id, onHand: 1 } });
check("a service has no stock to count", tracked.status === 409, tracked.raw);
psql(`update platform_settings set beta_all_basic = ${beta === "true"} where id = 1`);
psql(`update subscriptions set plan = '${planBefore[0]}', status = '${planBefore[1]}' where ${subscriptionOf}`);
const book = (preferredAt) =>
  call(`/public/stores/${slugA}/orders`, {
    method: "POST",
    body: {
      idempotencyKey: randomUUID(),
      lines: [{ variantId: service.variants[0].id, quantity: 1 }],
      checkout: { name: "Dara", phone: "097 123 4567", currency: "USD", fulfilment: "pickup", area: "phnom_penh", landmark: "", paymentMethod: "cod", ...(preferredAt ? { preferredAt } : {}) },
    },
  });
check("a cart of only services needs a preferred time", (await book()).json?.fields?.preferredAt === "required");
check("one that hasn't passed", (await book(new Date(Date.now() - 3_600_000).toISOString())).json?.fields?.preferredAt === "booking_in_past");
const tomorrow = new Date(Date.now() + 26 * 3_600_000).toISOString();
const booked = await book(tomorrow);
check("a booking at the shop is taken with its time", booked.status === 201 && (await call(`/public/orders/${booked.json?.token}`)).json?.preferredAt === tomorrow, booked.raw);
check("a cart with goods too needs no time", (await order([{ variantId: service.variants[0].id, quantity: 1 }, { variantId: phoneVariant, quantity: 1 }])).status === 201);

// --- tables and kitchen
await setModules(["options", "tables"]);
const twice = await call("/tables", { method: "PUT", cookie: a, body: { tables: [{ id: "t1", name: "A1" }, { id: "t2", name: "a1" }] } });
check("two tables can't share a name", twice.json?.fields?.["tables.1.name"] === "name_duplicate", twice.raw);
const savedTables = await call("/tables", { method: "PUT", cookie: a, body: { tables: [{ id: "t1", name: "A1" }, { id: "t2", name: "Terrace" }] } });
const terrace = savedTables.json?.tables?.find((table) => table.name === "Terrace");
check("the shop saves its tables", savedTables.status === 200 && savedTables.json?.tables?.length === 2, savedTables.raw);
const dineIn = await call("/counter/sales", {
  method: "POST",
  cookie: a,
  body: { idempotencyKey: randomUUID(), currency: "USD", lines: [{ variantId: phoneVariant, quantity: 1, note: "no rush" }], payment: { method: "cash", receivedMinor: 20000 }, buyerName: "", buyerPhone: "", tableId: terrace?.id },
});
check("a counter sale can be for a table, which the order keeps", dineIn.status === 200 && (await call(`/orders/${dineIn.json?.id}`, { cookie: a })).json?.tableName === "Terrace", dineIn.raw);
const kitchen = (await call("/kitchen", { cookie: a })).json?.orders ?? [];
const ticket = kitchen.find((entry) => entry.id === dineIn.json?.id);
check("the kitchen sees it with its table and note, and no prices", ticket?.tableName === "Terrace" && ticket.items[0].note === "no rush" && !JSON.stringify(ticket).includes("Minor"), JSON.stringify(ticket));
const doneOnce = await call(`/kitchen/${dineIn.json?.id}/done`, { method: "POST", cookie: a });
check("Done takes it off the kitchen screen", doneOnce.status === 200 && !doneOnce.json?.orders?.some((entry) => entry.id === dineIn.json?.id), doneOnce.raw);
check("and twice is refused", (await call(`/kitchen/${dineIn.json?.id}/done`, { method: "POST", cookie: a })).status === 404);
await setModules(["options"]);
check("with tables off, the kitchen is closed", (await call("/kitchen", { cookie: a })).json?.error === "module_off");
const offTable = await call("/counter/sales", {
  method: "POST",
  cookie: a,
  body: { idempotencyKey: randomUUID(), currency: "USD", lines: [{ variantId: phoneVariant, quantity: 1 }], payment: { method: "cash", receivedMinor: 20000 }, buyerName: "", buyerPhone: "", tableId: terrace?.id },
});
check("and a sale for a table is refused", offTable.json?.error === "module_off", offTable.raw);

// --- vehicles and job cards
await setModules(["options", "services", "jobCards"]);
const car = await call("/vehicles", { method: "POST", cookie: a, body: { plate: " pp 2a-1234 ", makeModel: "Toyota Prius", ownerName: "Dara", ownerPhone: "012 345 678" } });
check("a car is kept by its plate, upper-case", car.status === 201 && car.json?.plate === "PP 2A-1234" && car.json.ownerPhone === "85512345678", car.raw);
check("the same plate written another way is the same car", (await call("/vehicles", { method: "POST", cookie: a, body: { plate: "pp2a-1234", ownerPhone: "" } })).json?.fields?.plate === "name_duplicate");
const card = await call("/job-cards", {
  method: "POST",
  cookie: a,
  body: { vehicleId: car.json?.id, complaint: "Brakes squeak", mileageKm: 120500, lines: [{ variantId: phoneVariant, quantity: 1 }, { variantId: service.variants[0].id, quantity: 2, note: "front" }] },
});
check("a job card books the car in with its parts and labour", card.status === 201 && card.json?.status === "open" && card.json.lines.length === 2 && card.json.lines[1].labour === true, card.raw);
check("it can't jump straight to handed over", (await call(`/job-cards/${card.json?.id}/status`, { method: "POST", cookie: a, body: { status: "handed_over" } })).status === 409);
await call(`/job-cards/${card.json?.id}/status`, { method: "POST", cookie: a, body: { status: "in_progress" } });
const ready = await call(`/job-cards/${card.json?.id}/status`, { method: "POST", cookie: a, body: { status: "ready" } });
check("it moves open → in progress → ready", ready.json?.status === "ready", ready.raw);
const billSale = () =>
  call("/counter/sales", {
    method: "POST",
    cookie: a,
    body: {
      idempotencyKey: randomUUID(),
      currency: "USD",
      lines: [{ variantId: phoneVariant, quantity: 1 }, { variantId: service.variants[0].id, quantity: 2, note: "front" }],
      payment: { method: "cash", receivedMinor: 20000 },
      buyerName: "Dara",
      buyerPhone: "",
      jobCardId: card.json?.id,
    },
  });
const billed = await billSale();
const handedOver = (await call(`/job-cards/${card.json?.id}`, { cookie: a })).json;
check("billing it at the counter hands the car over, linked to the sale", billed.status === 200 && handedOver?.status === "handed_over" && handedOver.orderId === billed.json?.id, billed.raw);
check("a card can't be billed twice", (await billSale()).json?.fields?.jobCardId === "required");
await setModules(["options"]);
check("with job cards off, they're closed", (await call("/job-cards", { cookie: a })).json?.error === "module_off");

await call(`/products/${serviceId}`, { method: "DELETE", cookie: a });
await call(`/products/${phoneId}`, { method: "DELETE", cookie: a });
await call(`/products/${productId}`, { method: "DELETE", cookie: a });
await setModules(before);
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
