// Step 2 end-to-end through the real API: two merchants, sign-up, onboarding,
// link checks, isolation as seen from the API, logout. Prints PASS/FAIL lines.
const B = process.argv[2] ?? "http://localhost:4105";
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function call(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(B + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = response.headers.get("set-cookie");
  return { status: response.status, json: await response.json().catch(() => null), setCookie };
}

async function login(who) {
  const result = await call("/auth/dev-login", { method: "POST", body: { as: who } });
  return { ...result, cookie: result.setCookie?.split(";")[0] };
}

const suffix = Date.now().toString(36);

check("signed out: /auth/me is refused", (await call("/auth/me")).status === 401);
check("signed out: creating a store is refused", (await call("/stores", { method: "POST", body: {} })).status === 401);
check("a forged session cookie is refused", (await call("/auth/me", { cookie: "khmio_session=not-a-real-token" })).status === 401);

const a = await login("a");
check("merchant A signs in", a.status === 200 && !!a.cookie);
check("the session cookie is HttpOnly and SameSite=Lax", /HttpOnly/.test(a.setCookie ?? "") && /SameSite=Lax/.test(a.setCookie ?? ""));
check("A has no store yet", (await call("/auth/me", { cookie: a.cookie })).json?.store === null);

check("a reserved link is refused", (await call("/stores/slug-available?slug=admin", { cookie: a.cookie })).json?.available === false);
check("a badly formed link is refused", (await call("/stores/slug-available?slug=Bad_Link", { cookie: a.cookie })).json?.available === false);
check("a free link is offered", (await call(`/stores/slug-available?slug=shop-a-${suffix}`, { cookie: a.cookie })).json?.available === true);

const badCreate = await call("/stores", { method: "POST", cookie: a.cookie, body: { businessType: "boat", shopName: "x", slug: "admin" } });
check(
  "bad onboarding answers come back as field codes",
  badCreate.status === 400 && badCreate.json?.error === "invalid_input" && !!badCreate.json?.fields?.businessType && badCreate.json?.fields?.shopName === "too_short",
  JSON.stringify(badCreate.json),
);

const createA = await call("/stores", { method: "POST", cookie: a.cookie, body: { businessType: "shop", shopName: "ហាងសម្លៀកបំពាក់ A", slug: `shop-a-${suffix}` } });
check("A creates a shop", createA.status === 201 && !!createA.json?.storeId);
const meA = (await call("/auth/me", { cookie: a.cookie })).json;
check("A sees their shop, with its Khmer name intact", meA?.store?.name === "ហាងសម្លៀកបំពាក់ A");
check("the new shop is on a 14-day Free trial", meA?.store?.subscription?.plan === "free" && meA?.store?.subscription?.status === "trialing");
check("A can't open a second shop", (await call("/stores", { method: "POST", cookie: a.cookie, body: { businessType: "shop", shopName: "Second", slug: `second-${suffix}` } })).status === 409);

const b = await login("b");
check("merchant B signs in separately", b.status === 200 && b.cookie !== a.cookie);
check("B doesn't see A's shop", (await call("/auth/me", { cookie: b.cookie })).json?.store === null);
check("B is told A's link is taken", (await call(`/stores/slug-available?slug=shop-a-${suffix}`, { cookie: b.cookie })).json?.reason === "taken");
const steal = await call("/stores", { method: "POST", cookie: b.cookie, body: { businessType: "service", shopName: "Steal", slug: `shop-a-${suffix}` } });
check("B can't take A's link", steal.status === 400 && steal.json?.fields?.slug === "slug_taken", JSON.stringify(steal.json));
const createB = await call("/stores", { method: "POST", cookie: b.cookie, body: { businessType: "service", shopName: "Bright Cuts", slug: `shop-b-${suffix}` } });
check("B creates their own shop", createB.status === 201);
check("B still sees only their own shop", (await call("/auth/me", { cookie: b.cookie })).json?.store?.slug === `shop-b-${suffix}`);
check("A still sees only their own shop", (await call("/auth/me", { cookie: a.cookie })).json?.store?.slug === `shop-a-${suffix}`);

check("a tampered Telegram login is refused (or Telegram is off)", [401, 503].includes((await call("/auth/telegram", { method: "POST", body: { id: 1, first_name: "x", auth_date: 1, hash: "0".repeat(64) } })).status));

const cors = await fetch(B + "/health", { headers: { Origin: "https://evil.example" } });
check("CORS never names an unknown site", cors.headers.get("access-control-allow-origin") !== "https://evil.example");
const corsOk = await fetch(B + "/health", { headers: { Origin: "http://localhost:3000" } });
check("CORS names the web app", corsOk.headers.get("access-control-allow-origin") === "http://localhost:3000");

check("A signs out", (await call("/auth/logout", { method: "POST", cookie: a.cookie })).status === 200);
check("A's old cookie no longer works", (await call("/auth/me", { cookie: a.cookie })).status === 401);
check("B is still signed in", (await call("/auth/me", { cookie: b.cookie })).status === 200);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
