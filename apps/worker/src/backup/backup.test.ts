import { describe, expect, it } from "vitest";
import { ALWAYS_KEEP, backupKey, backupsToDelete, pgDumpCommand, pgEnvironment } from "./backup";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-30T20:00:00Z");
const daysAgo = (days: number) => ({ Key: backupKey(new Date(now.getTime() - days * DAY)), LastModified: new Date(now.getTime() - days * DAY) });

describe("database backups", () => {
  it("names each backup by its time, sortable and safe for any bucket", () => {
    expect(backupKey(new Date("2026-10-02T20:00:00.123Z"))).toBe("daily/2026-10-02T20-00-00Z.dump");
  });

  it("removes backups older than the days kept", () => {
    const objects = Array.from({ length: 20 }, (_, day) => daysAgo(day));
    const removed = backupsToDelete(objects, now, 14);
    expect(removed).toEqual(objects.filter((_, day) => day > 14).map((object) => object.Key));
  });

  it("never removes the newest few, however old — if backups stopped, the last good ones stay", () => {
    const objects = [daysAgo(40), daysAgo(41), daysAgo(42), daysAgo(43), daysAgo(44)];
    expect(backupsToDelete(objects, now, 14)).toEqual([daysAgo(43).Key, daysAgo(44).Key]);
    expect(ALWAYS_KEEP).toBe(3);
  });

  it("only ever touches files under daily/", () => {
    expect(backupsToDelete([{ Key: "other/old.dump", LastModified: new Date(0) }, ...[1, 2, 3].map(daysAgo)], now, 1)).toEqual([]);
  });

  it("gives pg_dump the password through its environment, never on the command line", () => {
    const dump = pgDumpCommand("pg_dump", "postgresql://owner:p%40ss@db.example.com:6543/shop?sslmode=require");
    expect(dump.args.join(" ")).not.toContain("p@ss");
    expect(dump.args).toContain("--exclude-schema=pgboss");
    expect(dump.env).toEqual({ PGHOST: "db.example.com", PGPORT: "6543", PGUSER: "owner", PGPASSWORD: "p@ss", PGDATABASE: "shop", PGSSLMODE: "require" });
    expect(pgEnvironment("postgresql://u:p@localhost/x").PGPORT).toBe("5432");
  });
});
