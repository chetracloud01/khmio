// Step 7 part A end-to-end through the real API: the admin login with
// two-step codes (enrol, backup codes, replay, lockout), roles, and the
// admin actions (merchants, extend/unblock, plan, audit log, settings, backups).
// Usage: node tests/e2e/step7.mjs <api url>    (after add-owner on that database)
import { createHash, createHmac, randomBytes } from "node:crypto";
import { psql } from "./lib.mjs";

const B = process.argv[2] ?? "http://localhost:4105";
const sql = (query) => psql(query).trim();
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
};
async function call(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(B + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json, raw: text, setCookie: response.headers.get("set-cookie") };
}

// An authenticator app, in a few lines (RFC 6238, SHA-1, 6 digits).
function base32Decode(text) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const out = [];
  for (const char of text) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function code(secret, offsetSteps = 0) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offsetSteps));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0");
}
const cookieOf = (setCookie) => setCookie.split(";")[0];

// ---------------------------------------------------------------- step one, then enrolment
const start = await call("/admin/auth/dev-login", { method: "POST" });
check("step one: the development login starts an admin login and asks to set up the app", start.status === 200 && start.json?.next === "enrol" && /khmio_admin=/.test(start.setCookie ?? ""), start.raw);
check("the admin cookie is only for /admin, HttpOnly and SameSite=Strict", /Path=\/admin/.test(start.setCookie) && /HttpOnly/.test(start.setCookie) && /SameSite=Strict/.test(start.setCookie));
let admin = cookieOf(start.setCookie);
check("after step one alone, the admin data stays shut", (await call("/admin/overview", { cookie: admin })).status === 401);
check("me says: waiting for the code, app not set up", (await call("/admin/auth/me", { cookie: admin })).json?.stage === "pending_2fa");

const enrol = await call("/admin/auth/enrol", { method: "POST", cookie: admin });
const secret = enrol.json?.secret;
check("enrolling gives an otpauth link for the app", enrol.status === 200 && /^otpauth:\/\/totp\//.test(enrol.json?.otpauthUri ?? "") && /^[A-Z2-7]{32}$/.test(secret ?? ""), enrol.raw);
check("the secret is stored encrypted, never as it was given", sql("select totp_pending_enc from admin_users limit 1").length > 40 && !sql("select totp_pending_enc from admin_users limit 1").includes(secret));
check("a wrong code is refused (otp_invalid)", (await call("/admin/auth/verify", { method: "POST", cookie: admin, body: { code: code(secret, 5) } })).json?.fields?.code === "otp_invalid");
const verified = await call("/admin/auth/verify", { method: "POST", cookie: admin, body: { code: code(secret) } });
const backupCodes = verified.json?.backupCodes ?? [];
check("the right code finishes the login and gives 8 backup codes, once", verified.status === 200 && backupCodes.length === 8, verified.raw);
check("backup codes are stored hashed", Number(sql("select count(*) from admin_backup_codes")) === 8 && !sql("select string_agg(code_hash, ',') from admin_backup_codes").includes(backupCodes[0]));
const overview = await call("/admin/overview", { cookie: admin });
check("now the admin data opens", overview.status === 200);
const health = overview.json?.health;
check(
  "the overview reports platform health (no worker here, no backup yet, Telegram stand-in on, KHQR not connected, free beta)",
  health?.workerSeenAt === null && health.backupsStale === true && health.telegram === "on" && health.khqr === "not_connected" && health.betaAllBasic === true,
  JSON.stringify(health),
);
sql("update platform_settings set worker_seen_at = now()");
check("a worker heartbeat shows on the overview", typeof (await call("/admin/overview", { cookie: admin })).json?.health?.workerSeenAt === "string");
check("the menu badges answer", JSON.stringify((await call("/admin/badges", { cookie: admin })).json) === JSON.stringify({ trialsEnding: 0, backupsStale: 1 }));
check("enrolling again is refused", (await call("/admin/auth/enrol", { method: "POST", cookie: admin })).status === 401);

// ---------------------------------------------------------------- the next logins
const second = await call("/admin/auth/dev-login", { method: "POST" });
check("next time, step one asks for the code (the app is set up)", second.json?.next === "code");
const secondCookie = cookieOf(second.setCookie);
const replay = await call("/admin/auth/verify", { method: "POST", cookie: secondCookie, body: { code: code(secret) } });
check("the same code can't be used twice", replay.json?.fields?.code === "otp_invalid", replay.raw);
const viaBackup = await call("/admin/auth/verify", { method: "POST", cookie: secondCookie, body: { code: backupCodes[0].toLowerCase() } });
check("a backup code works (any case)", viaBackup.status === 200);
const third = cookieOf((await call("/admin/auth/dev-login", { method: "POST" })).setCookie);
check("a backup code works only once", (await call("/admin/auth/verify", { method: "POST", cookie: third, body: { code: backupCodes[0] } })).json?.fields?.code === "otp_invalid");

// Lockout: 5 wrong codes in a row (the one above was the first).
for (let i = 0; i < 3; i += 1) await call("/admin/auth/verify", { method: "POST", cookie: third, body: { code: "000000" } });
const locking = await call("/admin/auth/verify", { method: "POST", cookie: third, body: { code: "000000" } });
check("the 5th wrong code locks the login (429 code_locked)", locking.status === 429 && locking.json?.error === "code_locked", locking.raw);
check("while locked, even the right code is refused", (await call("/admin/auth/verify", { method: "POST", cookie: third, body: { code: code(secret, 1) } })).status === 429);
check("the lock raised an admin alert for the worker", Number(sql("select count(*) from outbox_events where kind = 'admin_alert' and payload->>'reason' = 'admin_locked'")) === 1);
check("wrong codes and the lock are in the audit log", Number(sql("select count(*) from audit_logs where action in ('admin.code_wrong', 'admin.login_locked')")) >= 5);
sql("update admin_users set locked_until = null");

// ---------------------------------------------------------------- who may open what
const seller = (await fetch(B + "/auth/dev-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ as: "a" }) })).headers.get("set-cookie").split(";")[0];
check("a seller's cookie never opens the admin area", (await call("/admin/overview", { cookie: seller })).status === 401);
check("no cookie, no admin", (await call("/admin/merchants")).status === 401);
// A Support admin, signed in (a session row made directly, as the login would).
const supportId = sql(`insert into admin_users (name, telegram_id, role) values ('Support test', '${String(Date.now()).slice(-12)}', 'support') returning id`).split(/\r?\n/)[0].trim();
const supportToken = randomBytes(32).toString("base64url");
sql(`insert into admin_sessions (admin_user_id, token_hash, stage, expires_at) values ('${supportId}', '${createHash("sha256").update(supportToken).digest("hex")}', 'active', now() + interval '1 hour')`);
const support = `khmio_admin=${supportToken}`;
check("Support can see merchants", (await call("/admin/merchants", { cookie: support })).status === 200);
check("Support can't change platform settings (403)", (await call("/admin/settings", { method: "PUT", cookie: support, body: {} })).status === 403);
sql(`update admin_users set disabled_at = now() where id = '${supportId}'`);
check("a disabled admin is out at once", (await call("/admin/merchants", { cookie: support })).status === 401);

// ---------------------------------------------------------------- merchants, extend, plan
const merchants = (await call("/admin/merchants", { cookie: admin })).json;
const shopA = merchants?.find((m) => m.owner?.name === "Dev A");
check("the merchant list shows every shop with owner, plan, status and counts", Array.isArray(merchants) && merchants.length >= 2 && shopA?.owner?.name === "Dev A" && shopA.plan === "free" && shopA.products > 0, JSON.stringify(shopA));
check("search finds a shop by name or link", (await call(`/admin/merchants?q=${merchants.find((m) => m.owner?.name === "Dev B").slug}`, { cookie: admin })).json?.length === 1);
sql(`update subscriptions set status = 'paused', trial_ends_at = now() - interval '2 days' where store_id = '${shopA.id}'`);
const badExtend = await call(`/admin/merchants/${shopA.id}/extend`, { method: "POST", cookie: admin, body: { days: 400, note: "" } });
check("an extension needs 1–365 days and a note", badExtend.json?.fields?.days === "quantity_invalid" && badExtend.json.fields.note === "required", badExtend.raw);
const extended = await call(`/admin/merchants/${shopA.id}/extend`, { method: "POST", cookie: admin, body: { days: 14, note: "Beta seller" } });
const daysLeft = (new Date(extended.json?.endsAt).getTime() - Date.now()) / 86400000;
check("extending a paused shop reopens it for exactly those days", extended.json?.status === "trialing" && daysLeft > 13.9 && daysLeft <= 14 + 1 / 1440, `${extended.raw} daysLeft=${daysLeft}`);
const shopPage = await fetch(`${B}/public/stores/${shopA.slug}`);
check("its shop page still answers (paused pages show \"closed\" from Release 2)", shopPage.status === 200);
const planned = await call(`/admin/merchants/${shopA.id}/plan`, { method: "POST", cookie: admin, body: { plan: "pro", note: "Test" } });
check("moving a trial to a paid plan starts a 30-day period", planned.json?.plan === "pro" && planned.json.status === "active", planned.raw);
check("Free can't be chosen by hand", (await call(`/admin/merchants/${shopA.id}/plan`, { method: "POST", cookie: admin, body: { plan: "free", note: "Test" } })).status === 400);
const detail = (await call(`/admin/merchants/${shopA.id}`, { cookie: admin })).json;
check("the merchant page shows the shop, members and its audit trail", detail?.members?.[0]?.role === "owner" && detail.audit.some((entry) => entry.action === "subscription.extended"));
check("an unknown shop is 404", (await call(`/admin/merchants/${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}`, { cookie: admin })).status === 404);
sql(`update subscriptions set plan = 'free', status = 'trialing', trial_ends_at = now() + interval '14 days', current_period_end = null where store_id = '${shopA.id}'`);

// ---------------------------------------------------------------- audit log, settings
const audit = (await call("/admin/audit-log?action=subscription", { cookie: admin })).json;
const ext = audit?.entries?.find((entry) => entry.action === "subscription.extended");
check("the audit log names who did it, the shop, and before/after", ext?.actorName === "Owner (verify)" && ext.storeName && ext.before?.status === "paused" && ext.after?.status === "trialing" && ext.after.note === "Beta seller", JSON.stringify(ext));
const settings = (await call("/admin/settings", { cookie: admin })).json;
check("settings come back, with the beta switch and the alert chat", settings?.betaAllBasic === true && /^\d+$/.test(settings.alertChatId ?? ""), JSON.stringify(settings));
const badBand = await call("/admin/settings", { method: "PUT", cookie: admin, body: { ...settings, usdToKhrMin: 4500, usdToKhrMax: 4000 } });
check("a rate band upside down is refused", badBand.json?.fields?.usdToKhrMax === "rate_out_of_band", badBand.raw);
const saved = await call("/admin/settings", { method: "PUT", cookie: admin, body: { ...settings, usdToKhrMin: 3950 } });
check("settings save, and the change is in the audit log", saved.json?.usdToKhrMin === 3950 && Number(sql("select count(*) from audit_logs where action = 'platform.settings_saved'")) === 1);
await call("/admin/settings", { method: "PUT", cookie: admin, body: settings });

// ---------------------------------------------------------------- backups (A13)
const emptyBackups = (await call("/admin/backups", { cookie: admin })).json;
check("the backups page answers, with no runs yet", Array.isArray(emptyBackups?.runs) && emptyBackups.latestDone === null && emptyBackups.restoreTestPassedAt === null, JSON.stringify(emptyBackups));
const started = await call("/admin/backups", { method: "POST", cookie: admin });
check("Backup now queues a manual backup", started.status === 200 && sql(`select kind || ':' || status from backup_runs where id = '${started.json?.id}'`) === "manual:queued", started.raw);
check("Backup now is in the audit log", Number(sql(`select count(*) from audit_logs where action = 'backup.started' and entity_id = '${started.json?.id}'`)) === 1);
const again = await call("/admin/backups", { method: "POST", cookie: admin });
check("a second Backup now while one waits is refused (409)", again.status === 409 && again.json?.error === "backup_running", again.raw);
const listed = (await call("/admin/backups", { cookie: admin })).json;
check("the list shows the waiting backup and who started it", listed?.runs?.[0]?.status === "queued" && listed.runs[0].startedByName === "Owner (verify)", JSON.stringify(listed?.runs?.[0]));
const financeId = sql(`insert into admin_users (name, telegram_id, role) values ('Finance test', '${String(Date.now() + 1).slice(-12)}', 'finance') returning id`).split(/\r?\n/)[0].trim();
const financeToken = randomBytes(32).toString("base64url");
sql(`insert into admin_sessions (admin_user_id, token_hash, stage, expires_at) values ('${financeId}', '${createHash("sha256").update(financeToken).digest("hex")}', 'active', now() + interval '1 hour')`);
const finance = `khmio_admin=${financeToken}`;
check("Finance can see the backups", (await call("/admin/backups", { cookie: finance })).status === 200);
check("Finance can't start one (403)", (await call("/admin/backups", { method: "POST", cookie: finance })).status === 403);
check("Finance can't record the restore test (403)", (await call("/admin/backups/restore-test", { method: "POST", cookie: finance })).status === 403);
sql(`update admin_users set disabled_at = now() where id = '${financeId}'`);
const tested = await call("/admin/backups/restore-test", { method: "POST", cookie: admin });
const afterTest = (await call("/admin/backups", { cookie: admin })).json;
check("the owner records the restore test, in the audit log too", tested.status === 200 && afterTest?.restoreTestPassedAt === tested.json?.restoreTestPassedAt && Number(sql("select count(*) from audit_logs where action = 'backup.restore_test_passed'")) === 1, tested.raw);
let appDenied = false;
try {
  psql("select count(*) from backup_runs", { asApp: true });
} catch (error) {
  appDenied = /permission denied/i.test(String(error.stderr ?? error));
}
check("the app user can't read the backup runs", appDenied);
sql("delete from backup_runs");

// ---------------------------------------------------------------- sign out
await call("/admin/auth/logout", { method: "POST", cookie: admin });
check("signing out closes the admin session", (await call("/admin/overview", { cookie: admin })).status === 401);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
