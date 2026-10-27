// Step 3 part B: what GET /store gives the dashboard (plan, rate, checklist
// facts), run after step3 on the same database.
const B = process.argv[2] ?? "http://localhost:4105";
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
};
async function login(who) {
  const r = await fetch(B + "/auth/dev-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ as: who }) });
  return r.headers.get("set-cookie").split(";")[0];
}
const get = async (path, cookie) => (await fetch(B + path, { headers: cookie ? { cookie } : {} })).json();

const a = await login("a");
const b = await login("b");
const storeA = await get("/store", a);
const productsA = await get("/products", a);
const visible = productsA.filter((p) => p.isVisible);
check("the plan in force is Basic while the beta setting is on", storeA.plan === "basic", storeA.plan);
check("the store's exchange rate comes back for the price boxes", storeA.usdToKhrRate === 4100, String(storeA.usdToKhrRate));
check("a trialing store is not paused", storeA.paused === false);
check("visible products are counted", storeA.readiness.visibleProducts === visible.length, JSON.stringify(storeA.readiness));
check("visible products with a photo are counted", storeA.readiness.productsWithPhoto === visible.filter((p) => p.photos.length > 0).length);
check("KHQR follows the Bakong ID", storeA.readiness.khqrReady === (storeA.bakongId !== ""));
check("cash on delivery is on for a new store", storeA.readiness.codEnabled === true);
check("delivery isn't configured yet (its page is a later step)", storeA.readiness.deliveryConfigured === false);
const storeB = await get("/store", b);
const productsB = await get("/products", b);
check("B's counts are B's own, never A's products", storeB.readiness.visibleProducts === productsB.filter((p) => p.isVisible).length, JSON.stringify(storeB.readiness));
check("the store details need a login", (await fetch(B + "/store")).status === 401);
check("the public shop never shows the plan or checklist facts", !JSON.stringify(await get(`/public/stores/${storeA.slug}`)).match(/readiness|"plan"|bakong/i));
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
