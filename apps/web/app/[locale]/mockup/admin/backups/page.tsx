"use client";

import { adminRoleSchema, type AdminRole } from "@khmio/shared";
import { BottomSheet, Button, Card, Checkbox, cn, ConfirmDialog, Input, SegmentedControl, Switch, TONE_STYLES } from "@khmio/ui";
import { AlertTriangle, ArchiveRestore, CircleCheck, DatabaseBackup, ExternalLink, Lock, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import {
  BACKUP_ALWAYS_KEEP,
  BACKUP_KEEP_DAYS,
  BACKUP_STALE_HOURS,
  CATALOG_PARTS,
  mockBackups,
  mockCatalogPreview,
  mockRestoreTestDaysAgo,
  staleBackups,
  type CatalogPart,
  type MockBackup,
  type MockCatalogChange,
} from "@/mock/mock-backups";
import { PageHeader, Pill, SectionTitle } from "../admin-ui";
import { DetailList } from "../money-ui";
import { useAdminData, useTimeAgo } from "../use-admin-data";

const ROLES = adminRoleSchema.options;
const STATUS_STYLES: Record<MockBackup["status"], string> = {
  queued: TONE_STYLES.muted,
  running: TONE_STYLES.brand,
  done: TONE_STYLES.success,
  failed: TONE_STYLES.danger,
};
const CHANGES: MockCatalogChange["change"][] = ["back", "removed", "changed"];
/** The monthly restore test (blueprint "The routine") is late after this. */
const RESTORE_TEST_LATE_DAYS = 35;
const GO_LIVE_STEPS_URL = "https://github.com/chetracloud01/khmio/blob/main/docs/go-live.md";

/** A shop's link, as the seller typed it at onboarding (mock: made from the English name). */
const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Admin A13 (design/screens.md): the nightly backup made visible, "Backup
// now", the full-restore procedure, and restoring one shop's catalog.
// Mock only. Who sees what follows the planned permissions: backups_view
// (owner, support, finance), backups_run (owner, support), shop_restore (owner).
export default function AdminBackupsPage() {
  const t = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const locale = useLocale();
  const timeAgo = useTimeAgo();

  const [role, setRole] = useState<AdminRole>("owner");
  const [stale, setStale] = useState(false);
  const [added, setAdded] = useState<MockBackup[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const canRun = role !== "finance";
  const canRestore = role === "owner";

  const backups = useMemo(() => [...added, ...(stale ? staleBackups(mockBackups) : mockBackups)], [added, stale]);
  const latest = backups.find((backup) => backup.status === "done");
  const lastFailure = backups.find((backup) => backup.status === "failed");
  const isStale = !latest || latest.hoursAgo > BACKUP_STALE_HOURS;
  const busy = backups.some((backup) => backup.status === "queued" || backup.status === "running");
  const newest = useMemo(
    () => new Set(backups.filter((backup) => backup.status === "done").slice(0, BACKUP_ALWAYS_KEEP).map((backup) => backup.id)),
    [backups],
  );

  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const size = (backup: MockBackup) => (backup.sizeBytes ? `${number(backup.sizeBytes / (1024 * 1024))} MB` : "—");
  const duration = (backup: MockBackup) => {
    const seconds = backup.durationSeconds;
    if (seconds === undefined) return "—";
    return seconds < 60 ? t("bakSeconds", { s: seconds }) : t("bakMinutes", { m: Math.floor(seconds / 60), s: seconds % 60 });
  };
  const when = (backup: MockBackup) => timeAgo(Math.max(1, backup.hoursAgo * 60));
  const kind = (backup: MockBackup) => (backup.startedBy ? t("bakManualBy", { name: backup.startedBy }) : t(`bakKind_${backup.kind}`));
  const kept = (backup: MockBackup) => {
    if (backup.status !== "done") return t("bakNoFile");
    const days = BACKUP_KEEP_DAYS - Math.floor(backup.hoursAgo / 24);
    return days <= 0 && newest.has(backup.id) ? t("bakKeptNewest") : t("bakKeptDays", { count: Math.max(0, days) });
  };
  const statusPill = (backup: MockBackup) => (
    <Pill className={STATUS_STYLES[backup.status]}>
      {backup.status === "failed" && backup.failure ? t("bakFailedWith", { reason: t(`bakFail_${backup.failure}`) }) : t(`bakStatus_${backup.status}`)}
    </Pill>
  );

  function backupNow() {
    setConfirmOpen(false);
    const id = `b-now-${Date.now()}`;
    const set = (patch: Partial<MockBackup>) => setAdded((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setAdded((rows) => [{ id, kind: "manual", startedBy: t("bakYou"), hoursAgo: 0, status: "queued" }, ...rows]);
    timers.current.push(setTimeout(() => set({ status: "running" }), 1200));
    timers.current.push(setTimeout(() => set({ status: "done", sizeBytes: 48.7 * 1024 * 1024, durationSeconds: 72 }), 4200));
  }

  const columns: DataGridColumn<MockBackup>[] = [
    {
      key: "when",
      header: t("colWhen"),
      hideable: false,
      sortable: true,
      value: (backup) => backup.hoursAgo,
      exportValue: when,
      cell: (backup) => <span className="tabular-nums">{when(backup)}</span>,
    },
    { key: "kind", header: t("bakColKind"), sortable: true, value: kind, cell: kind },
    { key: "size", header: t("bakColSize"), align: "right", value: (backup) => backup.sizeBytes ?? 0, exportValue: size, cell: (backup) => <span className="tabular-nums">{size(backup)}</span> },
    { key: "took", header: t("bakColDuration"), align: "right", value: (backup) => backup.durationSeconds ?? 0, exportValue: duration, cell: (backup) => <span className="tabular-nums">{duration(backup)}</span> },
    { key: "status", header: t("colStatus"), sortable: true, value: (backup) => t(`bakStatus_${backup.status}`), cell: statusPill },
    { key: "kept", header: t("bakColKept"), value: kept, cell: (backup) => <span className="text-muted">{kept(backup)}</span> },
  ];

  return (
    <>
      <PageHeader
        title={tNav("backups")}
        description={tNav("backupsDescription")}
        actions={
          canRun && (
            <Button variant="primary" loading={busy} disabled={busy} onClick={() => setConfirmOpen(true)}>
              <DatabaseBackup className="h-4 w-4" aria-hidden="true" />
              {busy ? t("bakNowRunning") : t("bakNow")}
            </Button>
          )
        }
      />

      {/* Mockup only: preview the page per role, and the "didn't run" banner. */}
      <div className="flex flex-col gap-3 rounded-DEFAULT border border-dashed border-border p-3 text-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <span className="shrink-0 text-muted">{t("bakViewAs")}</span>
          <SegmentedControl
            className="md:w-80"
            options={ROLES.map((value) => ({ value, label: t(`role_${value}`) }))}
            value={role}
            onChange={(value) => setRole(value as AdminRole)}
          />
        </div>
        <Switch checked={stale} onChange={setStale} label={t("bakShowStale")} className="md:max-w-md" />
      </div>

      {isStale ? (
        <div role="alert" className="flex items-start gap-3 rounded-DEFAULT border border-danger/40 bg-danger/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-danger">{t("bakStaleTitle")}</p>
            <p>
              {latest ? t("bakStaleNewest", { when: when(latest) }) : t("bakStaleNone")}{" "}
              {lastFailure?.failure && t("bakStaleReason", { reason: t(`bakFail_${lastFailure.failure}`) })}
            </p>
            <p className="text-muted">{canRun ? t("bakStaleDo") : t("bakStaleTell")}</p>
          </div>
        </div>
      ) : (
        latest && (
          <Card className="flex items-start gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
              <CircleCheck className="h-5 w-5 text-success" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{t("bakLatest", { when: when(latest) })}</p>
              <p className="text-sm text-muted">{t("bakLatestLine", { size: size(latest), duration: duration(latest), kind: kind(latest) })}</p>
            </div>
          </Card>
        )
      )}

      <div className="flex items-start gap-3 rounded-DEFAULT border border-border bg-bg p-3 text-sm">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <p className="text-muted">{t("bakNoDownload")}</p>
      </div>

      <SectionTitle>{t("bakListTitle")}</SectionTitle>
      <DataGrid
        rows={backups}
        getRowId={(backup) => backup.id}
        columns={columns}
        searchText={(backup) => `${kind(backup)} ${backup.startedBy ?? ""}`}
        searchPlaceholder={t("bakSearch")}
        chips={[
          { value: "failed", label: t("bakStatus_failed"), predicate: (backup: MockBackup) => backup.status === "failed" },
          { value: "manual", label: t("bakKind_manual"), predicate: (backup: MockBackup) => backup.kind === "manual" },
        ]}
        initialSort={{ key: "when", direction: "asc" }}
        renderCard={(backup) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium tabular-nums">{when(backup)}</p>
                <p className="truncate text-sm text-muted">{kind(backup)}</p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{size(backup)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {statusPill(backup)}
              <span className="tabular-nums">{duration(backup)}</span>
              <span>· {kept(backup)}</span>
            </div>
          </div>
        )}
        exportFileName="backups"
        storageKey="admin-backups"
        emptyTitle={t("bakEmpty")}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand" aria-hidden="true" />
            <h2 className="font-semibold">{t("bakFullTitle")}</h2>
          </div>
          <p className="text-muted">{t("bakFullBody")}</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>{t("bakFullStep1")}</li>
            <li>{t("bakFullStep2")}</li>
            <li>{t("bakFullStep3")}</li>
          </ol>
          <a
            href={GO_LIVE_STEPS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-touch items-center gap-2 self-start font-medium text-brand hover:underline"
          >
            {t("bakFullLink")}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <p className={cn("rounded-DEFAULT p-3", mockRestoreTestDaysAgo > RESTORE_TEST_LATE_DAYS ? "bg-warning/10 text-warning" : "bg-border/10")}>
            {t("bakTestPassed", { when: timeAgo(mockRestoreTestDaysAgo * 1440) })}
            {mockRestoreTestDaysAgo > RESTORE_TEST_LATE_DAYS && ` ${t("bakTestLate")}`}
          </p>
        </Card>

        {canRestore && (
          <Card className="flex flex-col gap-3 p-4 text-sm">
            <div className="flex items-center gap-2">
              <ArchiveRestore className="h-5 w-5 text-brand" aria-hidden="true" />
              <h2 className="font-semibold">{t("bakShopTitle")}</h2>
            </div>
            <p className="text-muted">{t("bakShopBody")}</p>
            <p className="rounded-DEFAULT bg-border/10 p-3">{t("bakNever")}</p>
            <Button variant="secondary" className="self-start" onClick={() => setRestoreOpen(true)}>
              {t("bakShopStart")}
            </Button>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t("bakConfirmTitle")}
        body={t("bakConfirmBody")}
        confirmLabel={t("bakConfirm")}
        cancelLabel={t("cancel")}
        onConfirm={backupNow}
        onClose={() => setConfirmOpen(false)}
      />

      {restoreOpen && <RestoreShopSheet backups={backups.filter((backup) => backup.status === "done")} onClose={() => setRestoreOpen(false)} when={when} />}
    </>
  );
}

type Step = 1 | 2 | 3 | 4 | "done";

/** Choose the shop → the backup → what comes back → preview and type the shop's link. */
function RestoreShopSheet({ backups, onClose, when }: { backups: MockBackup[]; onClose: () => void; when: (backup: MockBackup) => string }) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const { rows, storeName } = useAdminData();
  const [step, setStep] = useState<Step>(1);
  const [search, setSearch] = useState("");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [backupId, setBackupId] = useState<string | null>(backups[0]?.id ?? null);
  const [parts, setParts] = useState<Set<CatalogPart>>(new Set(CATALOG_PARTS));
  const [typed, setTyped] = useState("");

  const store = rows.find((row) => row.id === storeId);
  const backup = backups.find((candidate) => candidate.id === backupId);
  const slug = store ? slugOf(store.nameEn) : "";
  const shown = rows.filter((row) => `${row.nameKm} ${row.nameEn} ${slugOf(row.nameEn)}`.toLowerCase().includes(search.trim().toLowerCase()));
  const preview = mockCatalogPreview.filter((change) => parts.has(change.part));
  const changeName = (change: MockCatalogChange) => (locale === "km" ? change.nameKm : change.nameEn);

  const canNext = step === 1 ? store !== undefined : step === 2 ? backup !== undefined : step === 3 ? parts.size > 0 : typed.trim() === slug;
  const choice = (selected: boolean) =>
    cn(
      "flex min-h-touch w-full items-center justify-between gap-3 rounded-DEFAULT border px-3 py-2 text-left",
      selected ? "border-brand bg-brand/5" : "border-border hover:bg-border/20",
    );

  const footer =
    step === "done" ? (
      <Button variant="primary" fullWidth onClick={onClose}>
        {t("close")}
      </Button>
    ) : (
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => (step === 1 ? onClose() : setStep((step - 1) as Step))}>
          {step === 1 ? t("cancel") : t("bakBack")}
        </Button>
        <Button
          variant={step === 4 ? "danger" : "primary"}
          className="flex-1"
          disabled={!canNext}
          onClick={() => setStep(step === 4 ? "done" : ((step + 1) as Step))}
        >
          {step === 4 ? t("bakRestore") : t("bakNext")}
        </Button>
      </div>
    );

  return (
    <BottomSheet open onClose={onClose} closeLabel={t("close")} title={t("bakShopTitle")} placement="side" footer={footer}>
      <div className="flex flex-col gap-4 text-sm">
        {step !== "done" && <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("bakStep", { step })}</p>}

        {step === 1 && (
          <>
            <h3 className="font-semibold">{t("bakStepShop")}</h3>
            <Input label={t("bakShopSearch")} value={search} onChange={(e) => setSearch(e.target.value)} />
            <div role="radiogroup" aria-label={t("bakStepShop")} className="flex flex-col gap-2">
              {shown.map((row) => (
                <button key={row.id} type="button" role="radio" aria-checked={row.id === storeId} onClick={() => setStoreId(row.id)} className={choice(row.id === storeId)}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{storeName(row)}</span>
                    <span className="block truncate text-xs text-muted">/s/{slugOf(row.nameEn)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{t("bakProducts", { count: row.productCount })}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && store && (
          <>
            <h3 className="font-semibold">{t("bakStepBackup")}</h3>
            <div role="radiogroup" aria-label={t("bakStepBackup")} className="flex flex-col gap-2">
              {backups.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="radio"
                  aria-checked={candidate.id === backupId}
                  onClick={() => setBackupId(candidate.id)}
                  className={choice(candidate.id === backupId)}
                >
                  <span className="font-medium tabular-nums">{when(candidate)}</span>
                  <span className="text-xs text-muted">{candidate.startedBy ? t("bakKind_manual") : t("bakKind_nightly")}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="font-semibold">{t("bakStepParts")}</h3>
            {CATALOG_PARTS.map((part) => (
              <Checkbox
                key={part}
                checked={parts.has(part)}
                onChange={(e) =>
                  setParts((current) => {
                    const next = new Set(current);
                    if (e.target.checked) next.add(part);
                    else next.delete(part);
                    return next;
                  })
                }
                label={t(`bakPart_${part}`)}
              />
            ))}
            {parts.size === 0 && <p className="text-danger">{t("bakChooseOne")}</p>}
            <p className="rounded-DEFAULT bg-border/10 p-3">{t("bakNever")}</p>
          </>
        )}

        {step === 4 && store && backup && (
          <>
            <h3 className="font-semibold">{t("bakStepPreview")}</h3>
            <DetailList
              items={[
                { label: t("colStore"), value: storeName(store) },
                { label: t("bakBackupDate"), value: when(backup) },
              ]}
            />
            {CHANGES.map((change) => {
              const items = preview.filter((item) => item.change === change);
              if (items.length === 0) return null;
              return (
                <div key={change} className="flex flex-col gap-1">
                  <p className="font-medium">
                    {t(`bakChange_${change}`)} · {items.length}
                  </p>
                  <ul className="flex flex-col gap-1 rounded-DEFAULT border border-border p-3">
                    {items.map((item) => (
                      <li key={item.nameEn} className="flex flex-wrap items-center gap-2">
                        <span>{changeName(item)}</span>
                        {item.hasOrders && <Pill className="bg-warning/10 text-warning">{t("bakHasOrders")}</Pill>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {parts.has("products") && <p className="text-muted">{t("bakPhotosNote", { days: BACKUP_KEEP_DAYS })}</p>}
            <p className="rounded-DEFAULT bg-brand/5 p-3">{t("bakSafety")}</p>
            <Input
              label={t("bakTypeSlug", { slug })}
              value={typed}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => setTyped(e.target.value)}
            />
          </>
        )}

        {step === "done" && store && backup && (
          <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
            <CircleCheck className="h-10 w-10 text-success" aria-hidden="true" />
            <p className="font-semibold">{t("bakDoneTitle")}</p>
            <p className="text-muted">{t("bakDoneBody", { store: storeName(store), when: when(backup) })}</p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
