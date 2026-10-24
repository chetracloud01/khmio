// What the end-to-end scripts share: the database (as its owner, through
// psql) and where the repo is. Settings come from the environment, the same
// ones the API reads: DATABASE_OWNER_URL and DATABASE_URL. PSQL may name the
// psql program when it isn't on the PATH (Windows:
// C:/Program Files/PostgreSQL/16/bin/psql.exe).
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const PSQL = process.env.PSQL ?? "psql";

const OWNER_URL = process.env.DATABASE_OWNER_URL;
const APP_URL = process.env.DATABASE_URL;
if (!OWNER_URL || !APP_URL) {
  console.error("Set DATABASE_OWNER_URL and DATABASE_URL to a fresh database built from the migrations.");
  process.exit(2);
}

/** psql's raw output for one query, as the owner (no row-level security) or as the app user. */
export function psql(query, { asApp = false } = {}) {
  // Options first: psql on Windows stops reading options at the first plain argument.
  return execFileSync(PSQL, ["-tA", "-c", query, `--dbname=${asApp ? APP_URL : OWNER_URL}`], { stdio: ["ignore", "pipe", "pipe"] }).toString();
}

/**
 * PUT /store saves all of Shop details at once (packages/shared
 * shopDetailsSaveSchema): the shop as saved, with `changes` on top — like the
 * web app's lib/shop-details-save.ts. `call` is the script's own API helper.
 */
export async function saveShopDetails(call, cookie, changes = {}) {
  const store = (await call("/store", { cookie })).json;
  const body = {
    shopName: store.name,
    businessType: store.businessType,
    phone: store.phone,
    area: store.area,
    description: store.description,
    bakongId: store.bakongId,
    logoKey: store.logoKey,
    paymentQrKey: store.paymentQrKey,
    address: store.pickupAddress,
    mapUrl: store.mapUrl,
    pickupEnabled: store.pickupEnabled,
    pickupHours: store.pickupHours,
    defaultCurrency: store.defaultCurrency,
    usdToKhrRate: store.usdToKhrRate,
    allowCod: store.allowCod,
    vatPercent: store.vatPercent,
    taxNumber: store.taxNumber,
    invoiceNote: store.invoiceNote,
    telegramLink: store.telegramLink,
    facebookLink: store.facebookLink,
  };
  return call("/store", { method: "PUT", cookie, body: { ...body, ...changes } });
}
