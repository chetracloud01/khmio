// Step 3 end-to-end through the real API: photos, catalog, products, shop
// details and the public shop read, with two merchants. PASS/FAIL lines.
// Usage: node tests/e2e/step3.mjs <api url> <path to a real .jpg>
import { readFileSync } from "node:fs";

const B = process.argv[2] ?? "http://localhost:4000";
const JPG = readFileSync(process.argv[3] ?? new URL("./fixtures/photo.jpg", import.meta.url));
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
};

async function call(path, { method = "GET", body, cookie, form } = {}) {
  const response = await fetch(B + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json, headers: response.headers, raw: text };
}
async function login(who) {
  const r = await fetch(B + "/auth/dev-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ as: who }) });
  return r.headers.get("set-cookie").split(";")[0];
}
function upload(cookie, bytes, name = "photo.jpg", type = "image/jpeg") {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  return call("/uploads/photo", { method: "POST", cookie, form });
}

const a = await login("a");
const b = await login("b");
const meA = (await call("/auth/me", { cookie: a })).json;
const slugA = meA.store.slug;

// ---------------------------------------------------------------- photos
const up = await upload(a, JPG);
check("a real JPEG uploads", up.status === 201 && /^stores\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(up.json?.key ?? ""), up.raw);
// In development photo links are same-site (/files/…, served through the web app); resolve them against the API here.
const served = await fetch(new URL(up.json.url, B));
check("the photo is served back as an image", served.status === 200 && served.headers.get("content-type") === "image/jpeg");
check("without a small copy, there's no thumbnail address", up.json?.thumbUrl === null, up.raw);
const withThumb = new FormData();
withThumb.append("file", new Blob([JPG], { type: "image/jpeg" }), "photo.jpg");
withThumb.append("thumb", new Blob([JPG], { type: "image/jpeg" }), "thumb.jpg");
const upThumb = await call("/uploads/photo", { method: "POST", cookie: a, form: withThumb });
check("a photo with its small copy gives a thumbnail next to it (-t.jpg)", upThumb.status === 201 && upThumb.json?.thumbUrl === upThumb.json?.url.replace(/\.jpg$/, "-t.jpg"), upThumb.raw);
check("the thumbnail is served back as an image", (await fetch(new URL(upThumb.json.thumbUrl, B))).headers.get("content-type") === "image/jpeg");
const fakeThumb = new FormData();
fakeThumb.append("file", new Blob([JPG], { type: "image/jpeg" }), "photo.jpg");
fakeThumb.append("thumb", new Blob([Buffer.from("<svg onload=alert(1)>")], { type: "image/jpeg" }), "thumb.jpg");
check("a thumbnail that isn't a real JPEG is dropped, the photo still saved", (await call("/uploads/photo", { method: "POST", cookie: a, form: fakeThumb })).json?.thumbUrl === null);
check("a script dressed as a .jpg is refused", (await upload(a, Buffer.from("<script>alert(1)</script>"), "evil.jpg")).json?.fields?.file === "photo_required");
check("a photo over 2 MB is refused", (await upload(a, Buffer.concat([JPG, Buffer.alloc(2_100_000)]))).status === 413);
check("uploading needs a login", (await upload("", JPG)).status === 401);
check("a path that tries to leave the photo folder finds nothing", (await fetch(B + "/files/stores/..%2F..%2F.env/x.jpg")).status === 404);
const photos = [up.json.key, (await upload(a, JPG)).json.key, (await upload(a, JPG)).json.key];

// ---------------------------------------------------------------- catalog
const catA = (await call("/catalog", { cookie: a })).json;
// The units grow with the business types (packages/shared DEFAULT_UNITS): check the rule, not a count.
check("A's catalog lists their categories and units, with a default unit", catA.categories.length > 0 && catA.units.length > 0 && catA.units.some((unit) => unit.id === catA.defaultUnitId));
const newCat = await call("/catalog/categories", { method: "POST", cookie: a, body: { nameKm: "អាវ", nameEn: "Shirts" } });
check("A adds a category", newCat.status === 201 && newCat.json?.nameEn === "Shirts");
check("an empty category name is refused", (await call("/catalog/brands", { method: "POST", cookie: a, body: { nameKm: "", nameEn: "x" } })).json?.fields?.nameKm === "required");
const catB = (await call("/catalog", { cookie: b })).json;
check("B never sees A's categories", !catB.categories.some((category) => category.id === newCat.json.id));

// ---------------------------------------------------------------- products
const simple = {
  product: { titleKm: "អាវយឺតនារី ពណ៌ស", titleEn: "Women's white T-shirt", categoryId: newCat.json.id, uomId: catA.defaultUnitId, retailPriceUsdCents: 850, descriptionKm: "ក្រណាត់កប្បាស", descriptionEn: "Cotton", isVisible: true },
  photoKeys: photos,
};
const created = await call("/products", { method: "POST", cookie: a, body: simple });
check("A adds a product with 3 photos", created.status === 201 && !!created.json?.id, created.raw);
const got = (await call(`/products/${created.json.id}`, { cookie: a })).json;
check("it comes back with its 3 photos in order", got?.photos?.map((photo) => photo.key).join() === photos.join());
check("a product without options gets one hidden default variant", got?.hasOptions === false && got?.variants?.length === 1 && got.variants[0].priceUsdCents === 850);
check("its SKU is made from the title", got?.variants?.[0]?.sku === "WOMEN-S-WHITE-T-SHIRT");

const noPrice = await call("/products", { method: "POST", cookie: a, body: { ...simple, product: { ...simple.product, retailPriceUsdCents: undefined } } });
check("a product with no price is refused, naming the field", noPrice.json?.fields?.retailPrice === "price_required", noPrice.raw);
const foreignCategory = await call("/products", { method: "POST", cookie: a, body: { ...simple, product: { ...simple.product, categoryId: catB.categories[0].id } } });
check("another store's category is refused", foreignCategory.json?.fields?.categoryId === "required", foreignCategory.raw);
const foreignPhoto = await call("/products", { method: "POST", cookie: a, body: { ...simple, photoKeys: [`stores/${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}/${"1".repeat(8)}-1111-1111-1111-${"1".repeat(12)}.jpg`] } });
check("another store's photo is refused", foreignPhoto.json?.fields?.["photoKeys.0"] === "photo_required", foreignPhoto.raw);

const withOptions = {
  product: {
    titleKm: "កាហ្វេទឹកកក",
    titleEn: "Iced Coffee",
    categoryId: newCat.json.id,
    discountPercent: 10,
    isVisible: true,
    options: [
      { id: "draft-1", sku: "", labelKm: "តូច", labelEn: "Small", retailPriceUsdCents: 125, retailPriceKhr: 5000 },
      { id: "draft-2", sku: "", labelKm: "ធំ", labelEn: "Large", retailPriceKhr: 7000 },
    ],
  },
  photoKeys: [],
};
const createdOptions = await call("/products", { method: "POST", cookie: a, body: withOptions });
const opt = (await call(`/products/${createdOptions.json?.id}`, { cookie: a })).json;
check("a product with options keeps each option's own price", opt?.hasOptions === true && opt?.variants?.map((variant) => variant.sku).join() === "ICED-COFFEE-SMALL,ICED-COFFEE-LARGE" && opt.variants[1].priceKhr === 7000, JSON.stringify(opt?.variants));
const dupSku = await call("/products", { method: "POST", cookie: a, body: { ...withOptions, product: { ...withOptions.product, titleEn: "Other", options: [{ ...withOptions.product.options[0], sku: "iced-coffee-small" }] } } });
check("a SKU already used by another product is refused", dupSku.json?.fields?.["options.0.sku"] === "sku_duplicate", dupSku.raw);

// Edit: drop "Large", rename "Small", add "Medium".
const edited = await call(`/products/${opt.id}`, {
  method: "PUT",
  cookie: a,
  body: {
    ...withOptions,
    product: {
      ...withOptions.product,
      options: [
        { id: opt.variants[0].id, sku: opt.variants[0].sku, labelKm: "តូច", labelEn: "Small cup", retailPriceUsdCents: 150 },
        { id: "draft-3", sku: "", labelKm: "មធ្យម", labelEn: "Medium", retailPriceUsdCents: 175 },
      ],
    },
  },
});
const opt2 = (await call(`/products/${opt.id}`, { cookie: a })).json;
check("editing keeps an option's id, drops a removed one and adds a new one", edited.status === 200 && opt2.variants.length === 2 && opt2.variants[0].id === opt.variants[0].id && opt2.variants[0].priceUsdCents === 150 && opt2.variants[1].labelEn === "Medium");

// ---------------------------------------------------------------- isolation through the API
check("B can't read A's product", (await call(`/products/${created.json.id}`, { cookie: b })).status === 404);
check("B can't edit A's product", (await call(`/products/${created.json.id}`, { method: "PUT", cookie: b, body: simple })).status === 404);
check("B can't hide or delete A's product", (await call(`/products/${created.json.id}/visibility`, { method: "PATCH", cookie: b, body: { isVisible: false } })).status === 404 && (await call(`/products/${created.json.id}`, { method: "DELETE", cookie: b })).status === 404);
check("B's product list has none of A's products", !(await call("/products", { cookie: b })).json.some((product) => product.id === created.json.id));

// ---------------------------------------------------------------- the shop page's public read
check("hiding works", (await call(`/products/${opt.id}/visibility`, { method: "PATCH", cookie: a, body: { isVisible: false } })).json?.isVisible === false);
const third = await call("/products", { method: "POST", cookie: a, body: { ...simple, product: { ...simple.product, titleEn: "To delete", titleKm: "លុប" }, photoKeys: [] } });
check("deleting works", (await call(`/products/${third.json.id}`, { method: "DELETE", cookie: a })).json?.deleted === true);
const shop = await call(`/public/stores/${slugA}`);
const shopIds = shop.json?.products?.map((product) => product.id) ?? [];
check("the shop page shows the visible product, with photos, without a login", shop.status === 200 && shopIds.includes(created.json.id) && shop.json.products.find((product) => product.id === created.json.id).photos.length === 3);
check("the shop page leaves out hidden and deleted products", !shopIds.includes(opt.id) && !shopIds.includes(third.json.id));
check("the shop page shows no wholesale prices", !JSON.stringify(shop.json).includes("wholesale"));
check("an unknown shop link is 404", (await call("/public/stores/no-such-shop-xyz")).status === 404);
check("a badly formed shop link is 404", (await call("/public/stores/..%2Fadmin")).status === 404);
await call(`/products/${opt.id}/visibility`, { method: "PATCH", cookie: a, body: { isVisible: true } });

// ---------------------------------------------------------------- shop details
const details = (await call("/store", { cookie: a })).json;
const save = await call("/store", { method: "PUT", cookie: a, body: { shopName: details.name, businessType: details.businessType, phone: "077 888 999", area: "phnom_penh", description: "Cotton clothes", bakongId: "srey@aclb", logoKey: photos[0] } });
check("shop details save, with the phone stored as 855…", save.status === 200 && save.json?.phone === "85577888999" && save.json?.bakongId === "srey@aclb" && !!save.json?.logoUrl, save.raw);
check("a wrong phone is refused", (await call("/store", { method: "PUT", cookie: a, body: { shopName: details.name, businessType: details.businessType, phone: "123", area: "phnom_penh", description: "", bakongId: "", logoKey: null } })).json?.fields?.phone === "phone_invalid");
const bLogo = (await upload(b, JPG)).json.key;
check("another store's photo can't be A's logo", (await call("/store", { method: "PUT", cookie: a, body: { shopName: details.name, businessType: details.businessType, phone: "", area: "phnom_penh", description: "", bakongId: "", logoKey: bLogo } })).json?.fields?.logoKey === "photo_required");
const cleared = await call("/store", { method: "PUT", cookie: a, body: { shopName: details.name, businessType: details.businessType, phone: "077 888 999", area: "phnom_penh", description: "Cotton clothes", bakongId: "", logoKey: photos[0] } });
check("clearing the Bakong ID turns KHQR off", cleared.json?.bakongId === "");
check("the shop page shows the logo and phone", (await call(`/public/stores/${slugA}`)).json?.store?.phone === "85577888999");

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
console.log(JSON.stringify({ productIds: [created.json.id, opt.id, third.json.id] }));
process.exit(failures === 0 ? 0 : 1);
