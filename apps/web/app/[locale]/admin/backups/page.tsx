"use client";

import { adminCan, backupIsStale, RESTORE_TEST_LATE_DAYS, type BackupRunView } from "@khmio/shared";
import { Button, Card, cn, ConfirmDialog, EmptyState, IconBadge, Notice, SectionTitle, TONE_STYLES } from "@khmio/ui";
import { ArchiveRestore, CircleCheck, DatabaseBackup, ExternalLink, Lock, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { adminBackupsSchema, restoreTestSchema, type AdminBackups } from "@/lib/admin-api";
import { api, ApiError, apiSend } from "@/lib/api";
import { useDateText } from "@/components/use-date-text";
import { useAdminMe } from "../admin-context";
import { LoadState, PageHeader, Pill } from "../admin-ui";

const STATUS_STYLES: Record<BackupRunView["status"], string> = {
  queued: TONE_STYLES.muted,
  running: TONE_STYLES.brand,
  done: TONE_STYLES.success,
  failed: TONE_STYLES.danger,
};
/** While a backup waits or runs, the page asks again this often. */
const REFRESH_MS = 3_000;
/** A "Backup now" still waiting after this means the worker isn't picking it up. */
const WAITING_TOO_LONG_MS = 2 * 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const GO_LIVE_STEPS_URL = "https://github.com/chetracloud01/khmio/blob/main/docs/go-live.md";

// A13 (design/screens.md): the nightly backup made visible, "Backup now",
// and the full-restore procedure with its monthly test. Restoring one shop's
// catalog comes after go-live. There is never a download button: a backup
// holds every buyer's phone and address.
export default function BackupsPage() {
  const t = useTranslations("Admin");
  const tApp = useTranslations("AdminApp");
  const tNav = useTranslations("AdminNav");
  const locale = useLocale();
  const me = useAdminMe();
  const { date, dateTime } = useDateText();
  const canRun = adminCan(me.role, "backups_run");
  const canRecordTest = adminCan(me.role, "settings_manage");
  const canRestore = adminCan(me.role, "shop_restore");

  const [data, setData] = useState<AdminBackups | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirm, setConfirm] = useState<"backup" | "test" | null>(null);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback((before?: string) => {
    setFailed(false);
    return api(`/admin/backups${before ? `?before=${encodeURIComponent(before)}` : ""}`, adminBackupsSchema).then(
      (page) => setData((previous) => (before && previous ? { ...page, runs: [...previous.runs, ...page.runs] } : page)),
      () => setFailed(true),
    );
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const active = data?.runs.find((run) => run.status === "queued" || run.status === "running");
  // Follow a backup while it waits or runs, then stop asking.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, load]);

  async function backupNow() {
    setConfirm(null);
    setStarting(true);
    setProblem(null);
    try {
      await apiSend("/admin/backups", { method: "POST" });
    } catch (error) {
      setProblem(error instanceof ApiError && error.status === 409 ? t("bakAlreadyRunning") : tApp("saveFailed"));
    }
    await load();
    setStarting(false);
  }

  async function recordTest() {
    setConfirm(null);
    setProblem(null);
    try {
      const { restoreTestPassedAt } = await api("/admin/backups/restore-test", restoreTestSchema, { method: "POST" });
      setData((previous) => (previous ? { ...previous, restoreTestPassedAt } : previous));
    } catch {
      setProblem(tApp("saveFailed"));
    }
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={tNav("backups")} description={tNav("backupsDescription")} />
        <LoadState failed={failed} onRetry={() => void load()} />
      </div>
    );
  }

  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const size = (run: BackupRunView) => (run.sizeBytes === null ? "—" : `${number(run.sizeBytes / (1024 * 1024))} MB`);
  const took = (run: BackupRunView) => {
    if (!run.startedAt || !run.finishedAt) return "—";
    const seconds = Math.max(1, Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000));
    return seconds < 60 ? t("bakSeconds", { s: seconds }) : t("bakMinutes", { m: Math.floor(seconds / 60), s: seconds % 60 });
  };
  const kind = (run: BackupRunView) => (run.kind === "manual" ? t("bakManualBy", { name: run.startedByName ?? "—" }) : t("bakKind_nightly"));
  const file = (run: BackupRunView) => (run.status !== "done" ? t("bakNoFile") : run.fileDeletedAt ? t("bakFileRemoved") : t("bakFileKept"));
  const statusPill = (run: BackupRunView) => (
    <Pill className={STATUS_STYLES[run.status]}>
      {run.status === "failed" && run.failure ? t("bakFailedWith", { reason: t(`bakFail_${run.failure}`) }) : t(`bakStatus_${run.status}`)}
    </Pill>
  );

  const latest = data.latestDone;
  const stale = backupIsStale(latest?.finishedAt ? new Date(latest.finishedAt) : null);
  const lastTry = data.runs.find((run) => run.status === "done" || run.status === "failed");
  const waitingTooLong = active?.status === "queued" && Date.now() - Date.parse(active.createdAt) > WAITING_TOO_LONG_MS;
  const testAt = data.restoreTestPassedAt;
  const testLate = !testAt || Date.now() - Date.parse(testAt) > RESTORE_TEST_LATE_DAYS * DAY_MS;
  const when = (run: BackupRunView) => dateTime(run.startedAt ?? run.createdAt);

  const columns: DataGridColumn<BackupRunView>[] = [
    {
      key: "when",
      header: t("colWhen"),
      hideable: false,
      sortable: true,
      value: (run) => Date.parse(run.startedAt ?? run.createdAt),
      exportValue: (run) => run.startedAt ?? run.createdAt,
      cell: (run) => <span className="whitespace-nowrap font-medium tabular-nums">{when(run)}</span>,
    },
    { key: "kind", header: t("bakColKind"), sortable: true, value: kind, cell: (run) => <span className="text-muted">{kind(run)}</span> },
    { key: "size", header: t("bakColSize"), align: "right", sortable: true, value: (run) => run.sizeBytes ?? 0, exportValue: size, cell: (run) => <span className="tabular-nums">{size(run)}</span> },
    { key: "took", header: t("bakColDuration"), align: "right", value: took, cell: (run) => <span className="tabular-nums text-muted">{took(run)}</span> },
    { key: "status", header: t("colStatus"), sortable: true, value: (run) => t(`bakStatus_${run.status}`), cell: statusPill },
    { key: "file", header: t("bakColKept"), value: file, cell: (run) => <span className="text-muted">{file(run)}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={tNav("backups")}
        description={tNav("backupsDescription")}
        actions={
          canRun && (
            <Button variant="primary" loading={starting || active !== undefined} disabled={starting || active !== undefined} onClick={() => setConfirm("backup")}>
              <DatabaseBackup className="h-4 w-4" aria-hidden="true" />
              {active ? t("bakNowRunning") : t("bakNow")}
            </Button>
          )
        }
      />

      {problem && (
        <Notice tone="danger" role="alert">
          {problem}
        </Notice>
      )}

      {stale ? (
        <Notice tone="danger" role="alert" title={t("bakStaleTitle")} className="p-4">
          <p>
            {latest?.finishedAt ? t("bakStaleNewest", { when: dateTime(latest.finishedAt) }) : t("bakStaleNone")}{" "}
            {lastTry?.status === "failed" && lastTry.failure && t("bakStaleReason", { reason: t(`bakFail_${lastTry.failure}`) })}
          </p>
          <p className="mt-1 text-muted">{canRun ? t("bakStaleDo") : t("bakStaleTell")}</p>
        </Notice>
      ) : (
        latest?.finishedAt && (
          <Card className="flex items-start gap-3 p-4">
            <IconBadge icon={CircleCheck} tone="success" shape="circle" />
            <div className="min-w-0">
              <p className="font-semibold">{t("bakLatest", { when: dateTime(latest.startedAt ?? latest.finishedAt) })}</p>
              <p className="text-sm text-muted">{t("bakLatestLine", { size: size(latest), duration: took(latest), kind: kind(latest) })}</p>
            </div>
          </Card>
        )
      )}

      {waitingTooLong && (
        <Notice tone="warning" role="status">
          {t("bakWaitingLong")}
        </Notice>
      )}

      <div className="flex items-start gap-3 rounded-DEFAULT border border-border bg-bg p-3 text-sm">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <p className="text-muted">{t("bakNoDownload")}</p>
      </div>

      <SectionTitle>{t("bakListTitle")}</SectionTitle>
      {data.runs.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon={DatabaseBackup} title={t("bakEmpty")} />
        </Card>
      ) : (
        <DataGrid
          rows={data.runs}
          getRowId={(run) => run.id}
          columns={columns}
          searchText={(run) => `${kind(run)} ${t(`bakStatus_${run.status}`)}`}
          searchPlaceholder={t("bakSearch")}
          chips={[
            { value: "failed", label: t("bakStatus_failed"), predicate: (run: BackupRunView) => run.status === "failed" },
            { value: "manual", label: t("bakKind_manual"), predicate: (run: BackupRunView) => run.kind === "manual" },
          ]}
          initialSort={{ key: "when", direction: "desc" }}
          renderCard={(run) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium tabular-nums">{when(run)}</p>
                  <p className="truncate text-sm text-muted">{kind(run)}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{size(run)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {statusPill(run)}
                <span className="tabular-nums">{took(run)}</span>
                <span>{file(run)}</span>
              </div>
            </div>
          )}
          exportFileName="backups"
          storageKey="admin-live-backups"
          emptyTitle={t("noMatches")}
        />
      )}
      {data.more && (
        <Button
          variant="secondary"
          className="self-center"
          loading={loadingMore}
          onClick={() => {
            setLoadingMore(true);
            void load(data.runs[data.runs.length - 1]?.createdAt).finally(() => setLoadingMore(false));
          }}
        >
          {tApp("older")}
        </Button>
      )}

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
          <a href={GO_LIVE_STEPS_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-touch items-center gap-2 self-start font-medium text-brand hover:underline">
            {t("bakFullLink")}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <p className={cn("rounded-DEFAULT p-3", testLate ? "bg-warning/10 text-warning" : "bg-border/10")}>
            {testAt ? t("bakTestPassedOn", { date: date(testAt) }) : t("bakTestNever")}
            {testLate && ` ${t("bakTestLate")}`}
          </p>
          {canRecordTest && (
            <Button variant="secondary" className="self-start" onClick={() => setConfirm("test")}>
              {t("bakTestRecord")}
            </Button>
          )}
        </Card>

        {canRestore && (
          <Card className="flex flex-col gap-3 p-4 text-sm">
            <div className="flex items-center gap-2">
              <ArchiveRestore className="h-5 w-5 text-brand" aria-hidden="true" />
              <h2 className="font-semibold">{t("bakShopTitle")}</h2>
            </div>
            <p className="text-muted">{t("bakShopBody")}</p>
            <p className="rounded-DEFAULT bg-border/10 p-3">{t("bakNever")}</p>
            <Pill className="self-start bg-border/30 text-muted">{t("bakShopLater")}</Pill>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "backup"}
        title={t("bakConfirmTitle")}
        body={t("bakConfirmBody")}
        confirmLabel={t("bakConfirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => void backupNow()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "test"}
        title={t("bakTestConfirmTitle")}
        body={t("bakTestConfirmBody")}
        confirmLabel={t("bakTestConfirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => void recordTest()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
