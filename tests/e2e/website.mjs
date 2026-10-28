// The website's waitlist end to end (POST /public/waitlist; docs/blueprint.md
// "Business roadmap"): a sign-up on a coming-soon solution page is saved as
// Khmio Shop for that business; the same phone again updates it, never a
// second row; a business the website doesn't list is refused by the API and
// by the database's own rule (migration waitlist_solutions). PASS/FAIL lines.
// Usage: node tests/e2e/website.mjs <api url>
import { randomInt } from "node:crypto";
import { psql } from "./lib.mjs";

const B = process.argv[2] ?? "http://localhost:4105";
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  (${detail})` : ""}`);
};
const sql = (query) => psql(query).trim();
const signUp = async (body) => {
  const r = await fetch(`${B}/public/waitlist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, text: await r.text() };
};

const local = `096${String(randomInt(1_000_000, 9_999_999))}`;
const saved = `855${local.slice(1)}`;
const row = () => sql(`select product || ',' || business_type || ',' || name from waitlist_signups where phone = '${saved}'`);

const cafe = await signUp({ product: "shop", businessType: "cafe", name: "Sophea", phone: local });
check("a café owner joins the waitlist", cafe.status === 200 && row() === "shop,cafe,Sophea", cafe.text);

const again = await signUp({ product: "shop", businessType: "salon", name: "Sophea N.", phone: local });
check("the same phone again updates the sign-up, never a second one", again.status === 200 && row() === "shop,salon,Sophea N." && sql(`select count(*) from waitlist_signups where phone = '${saved}'`) === "1", row());

const unknown = await signUp({ product: "shop", businessType: "cinema", name: "Dara", phone: local });
check("a business the website doesn't list is refused", unknown.status === 400 && unknown.text.includes("businessType"), unknown.text);

let refused = false;
try {
  sql(`insert into waitlist_signups (product, name, phone, business_type) values ('shop', 'Dara', '855${String(randomInt(10_000_000, 99_999_999))}', 'cinema')`);
} catch {
  refused = true;
}
check("the database refuses it too", refused);
check("older Class and Rent types are still allowed", (await signUp({ product: "class", businessType: "teacher", name: "Dara", phone: `012${String(randomInt(100_000, 999_999))}` })).status === 200);

sql(`delete from waitlist_signups where phone = '${saved}'`);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
