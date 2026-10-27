// Admin A13 Backups (design/screens.md): sample backups and a sample catalog
// restore preview. Mock only — the real list comes from the backup runs the
// worker records (roadmap step 8, after this screen is approved).

export type MockBackupKind = "nightly" | "manual";
export type MockBackupStatus = "queued" | "running" | "done" | "failed";
export type MockBackupFailure = "storage_unreachable" | "dump_failed" | "timed_out";

export interface MockBackup {
  id: string;
  kind: MockBackupKind;
  /** Manual backups only: the admin who pressed "Backup now". */
  startedBy?: string;
  /** How long ago it started. */
  hoursAgo: number;
  status: MockBackupStatus;
  sizeBytes?: number;
  durationSeconds?: number;
  failure?: MockBackupFailure;
}

export const BACKUP_KEEP_DAYS = 14;
export const BACKUP_ALWAYS_KEEP = 3;
/** The red banner shows when the newest good backup is older than this. */
export const BACKUP_STALE_HOURS = 26;

const MB = 1024 * 1024;

// Nightly at 03:00 for the last two weeks, one failure, two manual backups.
export const mockBackups: MockBackup[] = [
  { id: "b-15", kind: "nightly", hoursAgo: 9, status: "done", sizeBytes: 48.6 * MB, durationSeconds: 74 },
  { id: "b-14", kind: "manual", startedBy: "Sophea", hoursAgo: 28, status: "done", sizeBytes: 48.1 * MB, durationSeconds: 71 },
  { id: "b-13", kind: "nightly", hoursAgo: 33, status: "done", sizeBytes: 47.9 * MB, durationSeconds: 70 },
  { id: "b-12", kind: "nightly", hoursAgo: 57, status: "done", sizeBytes: 47.2 * MB, durationSeconds: 69 },
  { id: "b-11", kind: "nightly", hoursAgo: 81, status: "failed", failure: "storage_unreachable" },
  { id: "b-10", kind: "nightly", hoursAgo: 105, status: "done", sizeBytes: 46.4 * MB, durationSeconds: 66 },
  { id: "b-09", kind: "nightly", hoursAgo: 129, status: "done", sizeBytes: 45.8 * MB, durationSeconds: 65 },
  { id: "b-08", kind: "manual", startedBy: "Sophea", hoursAgo: 140, status: "done", sizeBytes: 45.5 * MB, durationSeconds: 64 },
  { id: "b-07", kind: "nightly", hoursAgo: 153, status: "done", sizeBytes: 45.1 * MB, durationSeconds: 63 },
  { id: "b-06", kind: "nightly", hoursAgo: 177, status: "done", sizeBytes: 44.3 * MB, durationSeconds: 62 },
  { id: "b-05", kind: "nightly", hoursAgo: 201, status: "done", sizeBytes: 43.7 * MB, durationSeconds: 60 },
  { id: "b-04", kind: "nightly", hoursAgo: 225, status: "done", sizeBytes: 43.0 * MB, durationSeconds: 59 },
  { id: "b-03", kind: "nightly", hoursAgo: 249, status: "done", sizeBytes: 42.2 * MB, durationSeconds: 58 },
  { id: "b-02", kind: "nightly", hoursAgo: 273, status: "done", sizeBytes: 41.6 * MB, durationSeconds: 57 },
  { id: "b-01", kind: "nightly", hoursAgo: 297, status: "done", sizeBytes: 40.9 * MB, durationSeconds: 55 },
];

/** "The nightly backup didn't run": last night failed, and the newest good one is a day older. */
export function staleBackups(backups: MockBackup[]): MockBackup[] {
  return [
    { id: "b-stale", kind: "nightly", hoursAgo: 4, status: "failed", failure: "dump_failed" },
    ...backups.map((backup) => ({ ...backup, hoursAgo: backup.hoursAgo + 24 })),
  ];
}

/** When the monthly restore test last passed (blueprint "The routine"). */
export const mockRestoreTestDaysAgo = 12;

export type CatalogPart = "products" | "groups" | "settings";
export const CATALOG_PARTS: CatalogPart[] = ["products", "groups", "settings"];

export interface MockCatalogChange {
  part: CatalogPart;
  change: "back" | "removed" | "changed";
  nameKm: string;
  nameEn: string;
  /** Products with orders since the backup are hidden rather than removed. */
  hasOrders?: boolean;
}

// What a restore to the chosen backup would do to the chosen shop.
export const mockCatalogPreview: MockCatalogChange[] = [
  { part: "products", change: "back", nameKm: "កន្សែងសូត្រ (ក្រហម)", nameEn: "Silk scarf (red)" },
  { part: "products", change: "back", nameKm: "កាបូបស្បែក", nameEn: "Leather handbag" },
  { part: "products", change: "back", nameKm: "អាវយឺតកុមារ", nameEn: "Kids' T-shirt" },
  { part: "products", change: "removed", nameKm: "អាវវែងថ្មី", nameEn: "New long dress", hasOrders: true },
  { part: "products", change: "removed", nameKm: "ផលិតផលសាកល្បង", nameEn: "Test product" },
  { part: "products", change: "changed", nameKm: "ស្បែកជើងប៉ាតា — តម្លៃ", nameEn: "Sneakers — price" },
  { part: "groups", change: "back", nameKm: "ប្រភេទ៖ កាបូប", nameEn: "Category: Bags" },
  { part: "settings", change: "changed", nameKm: "តំបន់ដឹកជញ្ជូន៖ ភ្នំពេញ — តម្លៃដឹក", nameEn: "Delivery zone: Phnom Penh — fee" },
];
