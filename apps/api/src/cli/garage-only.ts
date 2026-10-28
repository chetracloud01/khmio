import { createSystemDb } from "@khmio/db";
import type { BusinessType } from "@khmio/shared";
import { parseArgs } from "node:util";
import { getEnv } from "../config";
import { createFileStorage } from "../files/storage";
import { removeStore } from "./remove-store";

// pnpm data:garage-only [-- --yes]
//
// Garage first (docs/blueprint.md "Garage first"): leaves a development
// database with only garage shops, so every test starts from the Demo Garage
// — whatever business types sign-up offers (they're all open since
// 2026-10-28, so the offered list can't decide this). Every other shop is
// deleted with everything it owns
// and its photo files, then the test merchants left without a shop. Platform
// data stays: admin users, settings, the audit log, the waitlist, backups.
// The database's structure is never touched. Without --yes it only lists
// what it would delete. Development only.

/** The shops this keeps: garages, the business every change is tested on first. */
const KEPT_TYPES: BusinessType[] = ["garage"];

async function main() {
  const args = process.argv.slice(2);
  const { values } = parseArgs({ args: args[0] === "--" ? args.slice(1) : args, options: { yes: { type: "boolean" } } });
  if (process.env.NODE_ENV === "production") fail("data:garage-only is for development only.");
  const ownerUrl = process.env.DATABASE_OWNER_URL;
  if (!ownerUrl) fail("DATABASE_OWNER_URL is not set (see .env.example)");

  const db = createSystemDb(ownerUrl);
  try {
    const kept = await db.store.findMany({ where: { businessType: { in: KEPT_TYPES } }, select: { slug: true } });
    const doomed = await db.store.findMany({
      where: { businessType: { notIn: KEPT_TYPES } },
      select: { id: true, slug: true, businessType: true, _count: { select: { products: true, orders: true, customers: true } } },
      orderBy: { createdAt: "asc" },
    });
    // Merchants who belong to no shop that stays (dev A and B, and anyone who never finished sign-up).
    const keptMerchant = { memberships: { some: { store: { businessType: { in: KEPT_TYPES } } } } };
    const merchants = await db.merchant.count({ where: { NOT: keptMerchant } });

    process.stdout.write(`Keeping ${kept.length} shop(s): ${kept.map((store) => store.slug).join(", ") || "none — run pnpm demo:garage"}\n`);
    process.stdout.write(`Deleting ${doomed.length} shop(s):\n`);
    for (const store of doomed) {
      process.stdout.write(`  ${store.slug} (${store.businessType}): ${store._count.products} products, ${store._count.orders} orders, ${store._count.customers} customers\n`);
    }
    process.stdout.write(`Deleting ${merchants} merchant(s) left without a shop.\n`);
    if (!values.yes) {
      process.stdout.write("Nothing deleted yet. Run again with -- --yes to delete.\n");
      return;
    }

    const storage = createFileStorage(getEnv());
    let photoFiles = 0;
    for (const store of doomed) photoFiles += await removeStore(db, store.id, storage);
    const removed = await db.merchant.deleteMany({ where: { NOT: keptMerchant } });
    process.stdout.write(`Done: ${doomed.length} shop(s), ${photoFiles} photo files and ${removed.count} merchant(s) deleted.\n`);
  } finally {
    await db.$disconnect();
  }
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

main().catch((error: unknown) => {
  process.stderr.write(`data:garage-only failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exit(1);
});
