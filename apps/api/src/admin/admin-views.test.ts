import type { AuditLog, BackupRun } from "@khmio/db";
import { BACKUP_STALE_HOURS } from "@khmio/shared";
import { describe, expect, it } from "vitest";
import { toActivityEntries } from "./activity";
import { toBackupRunView } from "./backups";
import { merchantSearch, toMerchantDetail, toMerchantRow } from "./merchants";
import { toPlatformHealth } from "./overview";

// What the admin screens receive: names joined in, raw columns turned into
// the states a person reads, and nothing assumed about stored values.

const AT = new Date("2026-10-20T03:00:00Z");
const HOUR_MS = 60 * 60 * 1000;

describe("platform health", () => {
  const now = new Date("2026-10-23T03:00:00Z");

  it("calls backups stale once the newest good one is older than the limit, or there's none", () => {
    const fresh = toPlatformHealth({ workerSeenAt: now, latestBackupAt: new Date(now.getTime() - HOUR_MS), betaAllBasic: true, telegramOn: true }, now);
    expect(fresh).toMatchObject({ backupsStale: false, telegram: "on", khqr: "not_connected", betaAllBasic: true });
    expect(toPlatformHealth({ workerSeenAt: null, latestBackupAt: new Date(now.getTime() - (BACKUP_STALE_HOURS + 1) * HOUR_MS), betaAllBasic: false, telegramOn: true }, now).backupsStale).toBe(true);
    expect(toPlatformHealth({ workerSeenAt: null, latestBackupAt: null, betaAllBasic: false, telegramOn: true }, now).backupsStale).toBe(true);
  });

  it("shows Telegram as a dry run when there's no bot token", () => {
    expect(toPlatformHealth({ workerSeenAt: null, latestBackupAt: null, betaAllBasic: false, telegramOn: false }, now).telegram).toBe("dry_run");
  });
});

describe("the shop list and a shop's page", () => {
  const owner = { firstName: "Sokha", lastName: "", identities: [{ telegramUsername: null }, { telegramUsername: "sokha_shop" }] };
  const subscription = { plan: "free" as const, status: "trialing" as const, trialEndsAt: AT, currentPeriodStart: AT, currentPeriodEnd: null };
  const counts = { _count: { products: 4, orders: 9 } };

  it("names the owner by their full name and Telegram username, and the trial's end", () => {
    const row = toMerchantRow({ id: "s1", slug: "sokha", name: "Sokha Coffee", businessType: "restaurant", createdAt: AT, subscription, members: [{ merchant: owner }], ...counts });
    expect(row).toMatchObject({ owner: { name: "Sokha", telegramUsername: "sokha_shop" }, plan: "free", status: "trialing", endsAt: AT, products: 4, orders: 9 });
  });

  it("shows a shop with no owner or subscription yet without failing", () => {
    expect(toMerchantRow({ id: "s1", slug: "sokha", name: "Sokha", businessType: "shop", createdAt: AT, subscription: null, members: [], ...counts })).toMatchObject({ owner: null, plan: null, status: null, endsAt: null });
  });

  it("lists every member with their role on the shop's page", () => {
    const detail = toMerchantDetail(
      { id: "s1", slug: "sokha", name: "Sokha", businessType: "shop", phone: "", area: "phnom_penh", createdAt: AT, deliveryConfiguredAt: null, subscription, members: [{ role: "owner", merchant: { ...owner, lastName: "Chan" } }], ...counts },
      null,
      [],
    );
    expect(detail.members).toEqual([{ role: "owner", name: "Sokha Chan", telegramUsername: "sokha_shop" }]);
    expect(detail.subscription?.endsAt).toEqual(AT);
  });

  it("finds a shop by its owner's Telegram username with or without @", () => {
    expect(JSON.stringify(merchantSearch("@sokha_shop"))).toContain('"contains":"sokha_shop"');
    expect(merchantSearch(undefined)).toEqual({});
  });
});

describe("the Activity page", () => {
  const row = (overrides: Partial<AuditLog>): AuditLog => ({ id: "a1", actorType: "merchant", actorId: "m1", storeId: "s1", action: "store.details_saved", entity: "store", entityId: "s1", before: null, after: null, at: AT, ...overrides });

  it("puts names to people and shops it knows, and leaves the rest empty", () => {
    const entries = toActivityEntries([row({}), row({ id: "a2", actorType: "system", actorId: null, storeId: null })], new Map([["m1", "Sokha"]]), new Map([["s1", "Sokha Coffee"]]));
    expect(entries[0]).toMatchObject({ actorName: "Sokha", storeName: "Sokha Coffee" });
    expect(entries[1]).toMatchObject({ actorName: null, storeName: null });
  });
});

describe("a backup run", () => {
  const run = (overrides: Partial<BackupRun>): BackupRun => ({ id: "b1", kind: "manual", status: "done", startedById: "admin-1", objectKey: "k", sizeBytes: 2048n, failure: null, startedAt: AT, finishedAt: AT, fileDeletedAt: null, createdAt: AT, updatedAt: AT, ...overrides });

  it("says who started it and how big it is, as a plain number", () => {
    expect(toBackupRunView(run({}), new Map([["admin-1", "Chetra"]]))).toMatchObject({ kind: "manual", status: "done", startedByName: "Chetra", sizeBytes: 2048 });
  });

  it("refuses a stored name the table should never hold", () => {
    expect(() => toBackupRunView(run({ status: "exploded" }), new Map())).toThrow();
  });
});
