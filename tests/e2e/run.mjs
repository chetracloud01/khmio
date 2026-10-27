// pnpm test:e2e — every end-to-end check, through the real built API, on a
// fresh database built from the migrations (DATABASE_OWNER_URL and
// DATABASE_URL must point at it; run "pnpm build" first).
//
// Starts the API on port 4105 with rate limits off (the scripts place many
// orders from one machine), a stand-in for Telegram (no real bot or network
// needed), the stand-in KHQR bank (KHQR_PROVIDER=fake), a temporary photo
// folder and a throw-away admin key; runs the scripts in roadmap order, with
// the worker alongside the last one (payments); then b1.mjs, which starts its
// own API copies with rate limits and Turnstile on. Exits 1 if any check
// fails, and checks the logs never hold a secret or a phone number.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const PORT = 4105;
const API = `http://localhost:${PORT}`;
// "payments" runs last: the worker runs alongside it (it would deliver the messages the earlier scripts look at).
const SCRIPTS = ["step2", "step3", "step3b", "step4", "step6", "counter", "stock", "step7", "r1a", "home", "payments"];

if (!existsSync(join(ROOT, "apps/api/dist/main.js")) || !existsSync(join(ROOT, "apps/worker/dist/index.js"))) {
  console.error('Build first: pnpm build');
  process.exit(2);
}

// A stand-in for Telegram's Bot API: the bot's name for t.me links, "ok" for anything else.
const telegram = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(req.url?.endsWith("/getMe") ? { ok: true, result: { id: 1, is_bot: true, username: "khmio_e2e_bot" } } : { ok: true, result: true }));
});
await new Promise((resolve) => telegram.listen(0, "127.0.0.1", resolve));
const telegramUrl = `http://127.0.0.1:${telegram.address().port}`;

const work = mkdtempSync(join(tmpdir(), "khmio-e2e-"));
const apiLog = join(work, "api.log");
const workerLog = join(work, "worker.log");
const b1Log = join(work, "b1-api.log");
const env = {
  ...process.env,
  NODE_ENV: "development",
  FILE_STORAGE: "local",
  FILES_DIR: join(work, "uploads"),
  TELEGRAM_BOT_TOKEN: "123456789:e2e-stand-in-token-not-a-real-bot-x",
  TELEGRAM_API_URL: telegramUrl,
  TURNSTILE_SECRET_KEY: "",
  ADMIN_SECRETS_KEY: process.env.ADMIN_SECRETS_KEY ?? randomBytes(32).toString("base64"),
  // KHQR through the API's stand-in bank; shops offer it only once they set a Bakong account.
  KHQR_PROVIDER: "fake",
  E2E_B1_LOG: b1Log,
};

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: ROOT, env, ...options, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

async function startApi() {
  const log = createWriteStream(apiLog);
  const child = spawn(process.execPath, ["--env-file-if-exists=.env", "apps/api/dist/main.js"], {
    cwd: ROOT,
    env: { ...env, PORT: String(PORT), RATE_LIMITS: "off", FILES_PUBLIC_URL: `${API}/files` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  for (let i = 0; i < 60; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (await fetch(`${API}/health`).then((r) => r.ok, () => false)) return child;
  }
  child.kill();
  console.error(`The API didn't start:\n${readFileSync(apiLog, "utf8").slice(-2000)}`);
  process.exit(1);
}

/** The worker, checking KHQR payments at the API's stand-in bank. */
function startWorker() {
  const log = createWriteStream(workerLog);
  const child = spawn(process.execPath, ["--env-file-if-exists=.env", "apps/worker/dist/index.js"], {
    cwd: ROOT,
    env: { ...env, BACKUPS: "off", FAKE_BANK_URL: `${API}/dev/fake-bank` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return child;
}

let failed = 0;
function report(name, { code, output }) {
  const passes = (output.match(/^PASS/gm) ?? []).length;
  const fails = output.match(/^FAIL.*$/gm) ?? [];
  const crashed = code !== 0 && fails.length === 0;
  failed += fails.length + (crashed ? 1 : 0);
  console.log(`${fails.length || crashed ? "✗" : "✓"} ${name}: ${passes} passed${fails.length ? `, ${fails.length} failed` : ""}${crashed ? " — crashed" : ""}`);
  for (const line of fails) console.log(`    ${line}`);
  if (crashed) console.log(output.split("\n").slice(-15).map((line) => `    ${line}`).join("\n"));
}

const api = await startApi();
let worker = null;
for (const script of SCRIPTS) {
  if (script === "payments") worker = startWorker();
  if (script === "step7") {
    // The admin checks sign in as the first owner, made the only way owners are made.
    const tsx = join(ROOT, "apps/api/node_modules/tsx/dist/cli.mjs");
    const owner = await run(process.execPath, [tsx, "src/cli/add-owner.ts", "--telegram-id", "900000001", "--name", "Owner (verify)"], { cwd: join(ROOT, "apps/api") });
    if (owner.code !== 0) report("add-owner", owner);
  }
  report(script, await run(process.execPath, [join("tests/e2e", `${script}.mjs`), API]));
}
worker?.kill();
api.kill();
await new Promise((resolve) => setTimeout(resolve, 1000));

report("b1", await run(process.execPath, [join("tests/e2e", "b1.mjs")]));
telegram.close();

// Nothing secret, and no phone number, in what the API wrote.
const logs = [apiLog, workerLog, b1Log].filter(existsSync).map((file) => readFileSync(file, "utf8")).join("\n");
const leaks = logs.split("\n").filter((line) => /bot\d{6,}:|e2e-stand-in-token|password|855\d{8,9}/i.test(line));
console.log(`${leaks.length ? "✗" : "✓"} logs: ${leaks.length ? `${leaks.length} line(s) with a secret or phone` : "no secrets or phone numbers"}`);
failed += leaks.length;

rmSync(work, { recursive: true, force: true });
console.log(failed === 0 ? "\nAll end-to-end checks passed." : `\n${failed} end-to-end problem(s).`);
process.exit(failed === 0 ? 0 : 1);
