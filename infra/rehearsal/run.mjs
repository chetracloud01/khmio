// pnpm rehearsal [-- --fresh] [-- --owner <telegram id>]
//
// The whole system as it will run live — production builds, https, Secure
// cookies, rate limits, Turnstile (Cloudflare's test keys), photos and
// backups in the local S3 — on a public address from a free Cloudflare quick
// tunnel (no account), so phones anywhere can use it and real "Log in with
// Telegram" works once the test bot's domain points at the tunnel.
//
// Uses its own database (kms_rehearsal on the same server: --fresh empties
// it first) and its own backup bucket. Needs: PostgreSQL running, the local
// S3 running (pnpm s3:up), and in .env TELEGRAM_BOT_TOKEN, ADMIN_SECRETS_KEY,
// DATABASE_URL and DATABASE_OWNER_URL. Stop the everyday worker first: a bot
// can only be listened to by one program. Ctrl+C stops everything.
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startProxy } from "./proxy.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// Not 8080: the local S3 (SeaweedFS, pnpm s3:up) already uses it inside.
const PORTS = { proxy: 8090, api: 4200, web: 3200 };
const S3 = "http://127.0.0.1:9000";
const DATABASE = "kms_rehearsal";
const LOGS = join(tmpdir(), "khmio-rehearsal");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const fresh = args.includes("--fresh");
const ownerIndex = args.indexOf("--owner");
const owner = ownerIndex >= 0 ? args[ownerIndex + 1] : undefined;
const children = [];

const fail = (message) => {
  console.error(`\n✗ ${message}`);
  stopAll(1);
};
function stopAll(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}
process.on("SIGINT", () => {
  console.log("\nStopping the rehearsal…");
  stopAll(0);
});

for (const name of ["TELEGRAM_BOT_TOKEN", "ADMIN_SECRETS_KEY", "DATABASE_URL", "DATABASE_OWNER_URL"]) {
  if (!process.env[name]) fail(`${name} isn't set in .env`);
}
if (!(await fetch(`${S3}/khmio-photos/x`).then(() => true, () => false))) fail('The local S3 isn\'t running: start it with "pnpm s3:up" in another window.');

const inDatabase = (url, name) => Object.assign(new URL(url), { pathname: `/${name}` }).toString();
const db = { app: inDatabase(process.env.DATABASE_URL, DATABASE), owner: inDatabase(process.env.DATABASE_OWNER_URL, DATABASE) };
const pgDump = process.env.PG_DUMP_PATH ?? (existsSync("C:/Program Files/PostgreSQL/16/bin/pg_dump.exe") ? "C:/Program Files/PostgreSQL/16/bin/pg_dump.exe" : "pg_dump");
mkdirSync(LOGS, { recursive: true });

/** Runs a command to the end; its output goes to a log file, and the last lines to the screen if it fails. */
function step(label, command, commandArgs, options = {}) {
  process.stdout.write(`• ${label}… `);
  return new Promise((done) => {
    const log = join(LOGS, `${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.log`);
    const out = createWriteStream(log);
    const windowsPnpm = process.platform === "win32" && command === "pnpm";
    const child = windowsPnpm
      ? spawn([command, ...commandArgs].join(" "), { cwd: ROOT, shell: true, ...options, env: { ...process.env, ...options.env } })
      : spawn(command, commandArgs, { cwd: ROOT, ...options, env: { ...process.env, ...options.env } });
    let tail = "";
    const keep = (chunk) => {
      out.write(chunk);
      tail = (tail + chunk).slice(-1500);
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    child.on("close", (code) => {
      out.end();
      if (code === 0) {
        console.log("done");
        done();
      } else {
        console.log("failed");
        fail(`${label} failed (log: ${log}):\n${tail}`);
      }
    });
  });
}

/** Starts a long-running service; its output goes to a log file. */
function service(label, command, commandArgs, env, cwd = ROOT) {
  const out = createWriteStream(join(LOGS, `${label}.log`));
  const child = spawn(command, commandArgs, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  child.on("exit", (code) => {
    if (code !== null && code !== 0) fail(`${label} stopped (log: ${join(LOGS, `${label}.log`)})`);
  });
  children.push(child);
  return child;
}

async function waitFor(url, label) {
  for (let i = 0; i < 120; i += 1) {
    if (await fetch(url).then((r) => r.status < 500, () => false)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(`${label} didn't start`);
}

// 1. The public address.
const cloudflared = join(ROOT, "infra/bin", process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
if (!existsSync(cloudflared)) {
  const asset = process.platform === "win32" ? "cloudflared-windows-amd64.exe" : process.platform === "darwin" ? "cloudflared-darwin-amd64.tgz" : "cloudflared-linux-amd64";
  await step("Downloading cloudflared", "curl", ["-L", "--fail", "-o", cloudflared, `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`]);
}
await startProxy({ port: PORTS.proxy, apiPort: PORTS.api, webPort: PORTS.web, s3Url: `${S3}/khmio-photos` });
process.stdout.write("• Opening the tunnel… ");
const tunnel = service("tunnel", cloudflared, ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${PORTS.proxy}`], {});
const origin = await new Promise((found) => {
  let seen = "";
  const giveUp = setTimeout(() => fail("the tunnel didn't give an address in 60 seconds"), 60_000);
  const look = (chunk) => {
    seen += chunk;
    const match = seen.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      clearTimeout(giveUp);
      tunnel.stdout.off("data", look);
      tunnel.stderr.off("data", look);
      found(match[0]);
    }
  };
  tunnel.stdout.on("data", look);
  tunnel.stderr.on("data", look);
});
console.log(origin);

// 2. The database and the builds, for this address.
if (fresh) await step("Emptying the rehearsal database", "pnpm", ["--filter", "@khmio/db", "prisma", "migrate", "reset", "--force", "--skip-seed"], { env: { DATABASE_OWNER_URL: db.owner, DATABASE_URL: db.app } });
await step("Applying migrations", "pnpm", ["db:deploy"], { env: { DATABASE_OWNER_URL: db.owner, DATABASE_URL: db.app } });
if (owner) await step("Adding the platform owner", "pnpm", ["admin:add-owner", "--", "--telegram-id", owner, "--name", "Owner"], { env: { DATABASE_OWNER_URL: db.owner, DATABASE_URL: db.app } });
await step("Building the API and worker", "pnpm", ["--filter", "@khmio/api", "--filter", "@khmio/worker", "build"]);
await step("Building the web app for this address", "pnpm", ["--filter", "@khmio/web", "build"], {
  // NODE_ENV from .env is "development"; Next.js must build as production.
  env: { NODE_ENV: "production", NEXT_PUBLIC_API_URL: `${origin}/api`, NEXT_PUBLIC_FILES_ORIGIN: origin, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA" },
});

// 3. Everything as production runs it.
const s3Env = { S3_ENDPOINT: S3, S3_REGION: "us-east-1", S3_ACCESS_KEY_ID: "localdev", S3_SECRET_ACCESS_KEY: "localdev-secret", S3_BUCKET: "khmio-photos" };
service("api", process.execPath, ["--enable-source-maps", "apps/api/dist/main.js"], {
  ...s3Env,
  NODE_ENV: "production",
  PORT: String(PORTS.api),
  DATABASE_URL: db.app,
  DATABASE_OWNER_URL: db.owner,
  WEB_ORIGIN: origin,
  FILE_STORAGE: "s3",
  FILES_PUBLIC_URL: `${origin}/photos`,
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  // Cloudflare's edge, then cloudflared, then this proxy: count from the right.
  TRUST_PROXY_HOPS: "2",
  RATE_LIMITS: "on",
});
service("worker", process.execPath, ["--enable-source-maps", "apps/worker/dist/index.js"], {
  ...s3Env,
  NODE_ENV: "production",
  DATABASE_OWNER_URL: db.owner,
  WEB_ORIGIN: origin,
  BACKUPS: "on",
  S3_BACKUP_BUCKET: "khmio-rehearsal-backups",
  PG_DUMP_PATH: pgDump,
});
service("web", process.execPath, [join(ROOT, "apps/web/node_modules/next/dist/bin/next"), "start", "-p", String(PORTS.web)], { NODE_ENV: "production" }, join(ROOT, "apps/web"));
await waitFor(`http://127.0.0.1:${PORTS.api}/health`, "the API");
await waitFor(`http://127.0.0.1:${PORTS.web}/km`, "the web app");
await waitFor(`${origin}/api/health`, "the tunnel");

const host = new URL(origin).host;
console.log(`
✓ Rehearsal running at ${origin}

  Shop owners:  ${origin}/km/m/login
  Admin:        ${origin}/km/admin
  Logs:         ${LOGS}

  For "Log in with Telegram", point the test bot at this address (each new tunnel needs it again):
    In Telegram, open @BotFather → /setdomain → choose your test bot → send:  ${host}

  Ctrl+C stops everything.`);
