// Go-live step B1 end to end: security headers, rate limits (checkout per
// phone, seller login per address, 429 with Retry-After), the Turnstile bot
// check on checkout (Cloudflare's always-fail and always-pass test keys),
// order tokens kept out of the log, and production refusing to start
// without its settings. Starts its own API copies on port 4106.
// Usage: node tests/e2e/b1.mjs   (DATABASE_URL / DATABASE_OWNER_URL exported; run after the step scripts)
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { psql, ROOT } from "./lib.mjs";


const PORT = 4106;
const B = `http://localhost:${PORT}`;
const LOG = process.env.E2E_B1_LOG ?? join(tmpdir(), "khmio-e2e-b1-api.log");
const ALWAYS_FAILS = "2x0000000000000000000000000000000AA";
const ALWAYS_PASSES = "1x0000000000000000000000000000000AA";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

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
  return { status: r.status, headers: r.headers, json, raw: text };
}

let logText = "";
async function startApi(extra) {
  const child = spawn(process.execPath, ["--env-file-if-exists=.env", "apps/api/dist/main.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), FILES_DIR: ".uploads-verify", FILES_PUBLIC_URL: `${B}/files`, RATE_LIMITS: "on", ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => (logText += chunk));
  child.stderr.on("data", (chunk) => (logText += chunk));
  for (let i = 0; i < 40; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      if ((await fetch(`${B}/health`)).ok) return child;
    } catch {}
  }
  throw new Error("API didn't start");
}
const stopApi = (child) => new Promise((resolve) => {
  child.once("exit", resolve);
  child.kill();
});

let slugA = "";
const order = (phone, botCheck) => ({
  idempotencyKey: randomUUID(),
  lines: [{ variantId: variant, quantity: 1 }],
  checkout: { name: "Dara", phone, currency: "USD", fulfilment: "pickup", area: "phnom_penh", landmark: "", paymentMethod: "cod" },
  ...(botCheck ? { botCheck } : {}),
});
let variant = "";

// ---------------------------------------------------------------- headers, and a bot check that always fails
let api = await startApi({ TURNSTILE_SECRET_KEY: ALWAYS_FAILS });
const devA = (await fetch(B + "/auth/dev-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ as: "a" }) })).headers.get("set-cookie")?.split(";")[0] ?? "";
slugA = (await call("/auth/me", { cookie: devA })).json?.store?.slug ?? "";
const health = await call("/health");
check("API answers carry nosniff, no framing and a closed CSP", health.headers.get("x-content-type-options") === "nosniff" && health.headers.get("x-frame-options") === "DENY" && health.headers.get("content-security-policy") === "default-src 'none'; frame-ancestors 'none'");
check("the API doesn't say what it runs on", health.headers.get("x-powered-by") === null);
check("no HSTS outside production (plain http)", health.headers.get("strict-transport-security") === null);
const shop = (await call(`/public/stores/${slugA}`)).json;
variant = shop?.products?.find((p) => !p.hasOptions)?.variants?.[0]?.id ?? "";
check("the test shop is open with a simple product", shop?.open === true && Boolean(variant), slugA);
const noToken = await call(`/public/stores/${slugA}/orders`, { method: "POST", body: order("012 300 001") });
check("with Turnstile on, a checkout without a token is refused (403 bot_check_failed)", noToken.status === 403 && noToken.json?.error === "bot_check_failed", noToken.raw);
const badToken = await call(`/public/stores/${slugA}/orders`, { method: "POST", body: order("012 300 002", DUMMY_TOKEN) });
check("a token Cloudflare rejects is refused too", badToken.status === 403 && badToken.json?.error === "bot_check_failed", badToken.raw);
await stopApi(api);

// ---------------------------------------------------------------- a bot check that passes; limits per phone and per address
api = await startApi({ TURNSTILE_SECRET_KEY: ALWAYS_PASSES });
const phone = `097 ${String(Date.now()).slice(-3)} ${String(Date.now()).slice(-7, -3)}`;
const first = await call(`/public/stores/${slugA}/orders`, { method: "POST", body: order(phone, DUMMY_TOKEN) });
check("a token Cloudflare accepts places the order", first.status === 201 && Boolean(first.json?.token), first.raw);
let lastStatus = first.status;
for (let i = 2; i <= 10; i += 1) lastStatus = (await call(`/public/stores/${slugA}/orders`, { method: "POST", body: order(phone, DUMMY_TOKEN) })).status;
check("ten orders an hour from one phone are fine", lastStatus === 201, String(lastStatus));
const eleventh = await call(`/public/stores/${slugA}/orders`, { method: "POST", body: order(phone, DUMMY_TOKEN) });
const retryAfter = Number(eleventh.headers.get("retry-after"));
check("the eleventh is refused: 429 too_many_requests", eleventh.status === 429 && eleventh.json?.error === "too_many_requests", eleventh.raw);
check("with Retry-After: seconds until the hour's window ends", retryAfter > 0 && retryAfter <= 3600, String(retryAfter));
const otherPhone = await call(`/public/stores/${slugA}/orders`, { method: "POST", body: order("012 300 003", DUMMY_TOKEN) });
check("another phone from the same address still orders", otherPhone.status === 201, otherPhone.raw);
const digits = phone.replace(/\D/g, "").replace(/^0/, "");
check("the counters keep no phone number, only hashes", sql(`select count(*) from rate_limit_hits where bucket like '%${digits}%'`) === "0" && sql("select count(*) from rate_limit_hits where bucket like 'checkoutPhone:%'") !== "0");
check("the app user can't read the counters", (() => {
  try {
    psql("select count(*) from rate_limit_hits", { asApp: true });
    return false;
  } catch {
    return true;
  }
})());

let loginStatuses = [];
for (let i = 0; i < 21; i += 1) loginStatuses.push((await call("/auth/telegram", { method: "POST", body: { id: 1 } })).status);
check("20 seller logins in 10 minutes from one address are answered normally", loginStatuses.slice(0, 20).every((status) => status !== 429), loginStatuses.join(","));
check("the 21st gets 429", loginStatuses[20] === 429, String(loginStatuses[20]));

const token = first.json?.token ?? "none";
await call(`/public/orders/${token}`);
await new Promise((resolve) => setTimeout(resolve, 500));
check("the log never holds a buyer's order token", !logText.includes(token) && logText.includes("/public/orders/:token"));
await stopApi(api);

// ---------------------------------------------------------------- production refuses to start without its settings
const refused = await new Promise((resolve) => {
  const child = spawn(process.execPath, ["apps/api/dist/main.js"], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: "production", PORT: String(PORT), DATABASE_URL: process.env.DATABASE_URL, DATABASE_OWNER_URL: process.env.DATABASE_OWNER_URL, WEB_ORIGIN: "http://shop.example.com", RATE_LIMITS: "off" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (chunk) => (out += chunk));
  child.stderr.on("data", (chunk) => (out += chunk));
  child.on("exit", (code) => resolve({ code, out }));
});
check("production with http and missing settings stops at start-up", refused.code !== 0, String(refused.code));
check("and names each setting to fix", ["WEB_ORIGIN.0", "TELEGRAM_BOT_TOKEN", "ADMIN_SECRETS_KEY", "TURNSTILE_SECRET_KEY", "RATE_LIMITS"].every((name) => refused.out.includes(name)), refused.out.slice(0, 300));
check("without printing any value", !refused.out.includes("shop.example.com") && !refused.out.includes("khmer_micro_store_app"));

writeFileSync(LOG, logText);
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
