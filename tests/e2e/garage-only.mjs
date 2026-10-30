// pnpm data:garage-only end to end (docs/blueprint.md "Garage first"), run
// last, on the database every other check has filled (shops with job cards,
// stock, counter sales, KHQR payments…): it only lists without --yes, refuses
// production, and with --yes deletes every shop that isn't a garage — with
// its photo files and the merchants left without a shop — while the Demo
// Garage and the platform's own data stay. PASS/FAIL lines.
// Usage: node tests/e2e/garage-only.mjs    (needs FILES_DIR, as tests/e2e/run.mjs sets it)
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { psql, ROOT } from "./lib.mjs";

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
};
const sql = (query) => psql(query).trim();
const count = (query) => Number(sql(query));
const tsx = join(ROOT, "apps/api/node_modules/tsx/dist/cli.mjs");
const cli = (script, args = [], extraEnv = {}) =>
  // INIT_CWD: where pnpm would have been run, so demo:garage finds sample/garage's photos.
  spawnSync(process.execPath, [tsx, `src/cli/${script}.ts`, ...args], { cwd: join(ROOT, "apps/api"), env: { ...process.env, INIT_CWD: ROOT, ...extraEnv }, encoding: "utf8" });
const photoFolder = (storeId) => join(process.env.FILES_DIR ?? "", "stores", storeId);
const hasPhotos = (storeId) => existsSync(photoFolder(storeId)) && readdirSync(photoFolder(storeId)).length > 0;

const made = cli("demo-garage", ["--reset"]);
check("the Demo Garage is made", made.status === 0, made.stderr.slice(-300));
const garage = sql("select id from stores where slug = 'mekong-auto-garage'");
const otherShops = count("select count(*) from stores where business_type <> 'garage'");
const others = sql("select id from stores where business_type <> 'garage'").split("\n").filter(Boolean);
check("the other checks left shops that aren't garages, with job cards among their data", otherShops > 0 && count("select count(*) from job_cards where store_id in (select id from stores where business_type <> 'garage')") > 0);
check(
  "the Demo Garage comes with its stock: suppliers, bills paid and on credit, a return, reorder levels, a count",
  count(`select count(*) from suppliers where store_id = '${garage}'`) === 4 &&
    count(`select count(*) from purchases where store_id = '${garage}' and kind = 'purchase'`) === 8 &&
    count(`select count(*) from purchases where store_id = '${garage}' and kind = 'return'`) === 1 &&
    count(`select count(*) from purchases where store_id = '${garage}' and due_on is not null`) === 3 &&
    count(`select count(*) from stock_levels where store_id = '${garage}' and reorder_min is not null`) === 7 &&
    count(`select count(*) from stock_movements where store_id = '${garage}' and reason = 'count_correction'`) >= 4,
);
const again = cli("demo-garage", ["--stock"]);
check("--stock on the made garage adds nothing twice", again.status === 0 && again.stdout.includes("nothing added") && count(`select count(*) from purchases where store_id = '${garage}'`) === 9, again.stdout.slice(-300));
const garageOrders = count(`select count(*) from orders where store_id = '${garage}'`);
const admins = count("select count(*) from admin_users");

const listed = cli("garage-only");
check("without --yes it only lists what it would delete", listed.status === 0 && listed.stdout.includes("Nothing deleted yet") && count("select count(*) from stores where business_type <> 'garage'") === otherShops, listed.stdout.slice(-300));

const refused = cli("garage-only", ["--yes"], { NODE_ENV: "production" });
check("it refuses to run in production", refused.status !== 0 && count("select count(*) from stores where business_type <> 'garage'") === otherShops);

const someWithPhotos = others.filter(hasPhotos);
const cleared = cli("garage-only", ["--yes"]);
check("with --yes it finishes", cleared.status === 0 && cleared.stdout.includes("Done:"), (cleared.stderr || cleared.stdout).slice(-400));
check("only garages are left", count("select count(*) from stores where business_type <> 'garage'") === 0 && count("select count(*) from stores") >= 1);
check("the Demo Garage keeps everything", sql(`select id from stores where slug = 'mekong-auto-garage'`) === garage && count(`select count(*) from orders where store_id = '${garage}'`) === garageOrders);
check("nothing of the deleted shops is left behind", count("select count(*) from orders where store_id not in (select id from stores)") === 0 && count("select count(*) from job_cards where store_id not in (select id from stores)") === 0 && count("select count(*) from customers where store_id not in (select id from stores)") === 0);
check("no merchant is left without a shop", count("select count(*) from merchants m where not exists (select 1 from store_members s where s.merchant_id = m.id)") === 0);
check("the platform's own data stays (admins)", count("select count(*) from admin_users") === admins && admins > 0);
check("the deleted shops' photo files are gone", someWithPhotos.length === 0 || someWithPhotos.every((storeId) => !hasPhotos(storeId)), `${someWithPhotos.length} shop(s) had photos`);
check("the garage's photos stay", hasPhotos(garage));

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
