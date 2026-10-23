"use client";

import { BottomSheet, Button, DetailList, EmptyState, TONE_STYLES } from "@khmio/ui";
import { ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { DataGrid, type DataGridColumn } from "@/components/data-grid";
import { adminAuditPageSchema, type AdminAuditEntry } from "@/lib/admin-api";
import { api } from "@/lib/api";
import { useDateText } from "@/components/use-date-text";
import { LoadState, PageHeader, Pill } from "../admin-ui";
import { useAuditText } from "../audit-text";

/** Quick filters: the first part of an action ("subscription.extended" → subscription). */
const CATEGORIES = [
  { value: "subscription", key: "filterSubscriptions" },
  { value: "admin", key: "filterLogins" },
  { value: "platform", key: "filterSettings" },
  { value: "order", key: "filterOrders" },
  { value: "store", key: "filterShops" },
  { value: "backup", key: "filterBackups" },
] as const;
const ACTORS = ["admin", "merchant", "system"] as const;
const ACTOR_TONE = { admin: TONE_STYLES.brand, merchant: TONE_STYLES.muted, system: TONE_STYLES.warning } as const;
/** Loaded at a time; the grid searches and filters what's loaded, "Load older" adds the next page. */
const BATCH = 500;

// Every recorded change, newest first (design/screens.md A5), in the shared
// data grid. Read-only: the table can't be edited, by anyone.
export default function AuditLogPage() {
  const t = useTranslations("AdminApp");
  const tAdmin = useTranslations("Admin");
  const { dateTime } = useDateText();
  const { describe } = useAuditText();
  const [entries, setEntries] = useState<AdminAuditEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<AdminAuditEntry | null>(null);

  const load = useCallback((before?: string) => {
    setFailed(false);
    const query = new URLSearchParams({ limit: String(BATCH), ...(before ? { before } : {}) }).toString();
    return api(`/admin/audit-log?${query}`, adminAuditPageSchema).then(
      (page) => {
        setEntries((previous) => (before && previous ? [...previous, ...page.entries] : page.entries));
        setMore(page.more);
      },
      () => setFailed(true),
    );
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const note = (entry: AdminAuditEntry) => (typeof entry.after?.note === "string" ? entry.after.note : "");
  const actorPill = (entry: AdminAuditEntry) => <Pill className={ACTOR_TONE[entry.actorType]}>{t(`actor_${entry.actorType}`)}</Pill>;

  const columns: DataGridColumn<AdminAuditEntry>[] = [
    {
      key: "when",
      header: tAdmin("colWhen"),
      hideable: false,
      sortable: true,
      value: (entry) => Date.parse(entry.at),
      exportValue: (entry) => entry.at,
      cell: (entry) => <span className="whitespace-nowrap tabular-nums text-muted">{dateTime(entry.at)}</span>,
    },
    {
      key: "who",
      header: t("auditColWho"),
      sortable: true,
      value: (entry) => entry.actorName ?? "",
      exportValue: (entry) => `${t(`actor_${entry.actorType}`)}: ${entry.actorName ?? ""}`,
      cell: (entry) => (
        <span className="flex flex-wrap items-center gap-2">
          {actorPill(entry)}
          <span className="font-medium">{entry.actorName ?? "—"}</span>
        </span>
      ),
    },
    {
      key: "what",
      header: t("auditColWhat"),
      hideable: false,
      value: (entry) => describe(entry),
      exportValue: (entry) => [describe(entry), note(entry)].filter(Boolean).join(" — "),
      cell: (entry) => (
        <span className="flex flex-col">
          <span>{describe(entry)}</span>
          {note(entry) && <span className="text-xs text-muted">“{note(entry)}”</span>}
        </span>
      ),
    },
    { key: "shop", header: tAdmin("colStore"), sortable: true, value: (entry) => entry.storeName ?? "", cell: (entry) => entry.storeName ?? "—" },
    {
      key: "change",
      header: t("auditColChange"),
      exportValue: (entry) => changedFields(entry).map(([key, from, to]) => `${key}: ${from} → ${to}`).join("; "),
      cell: (entry) => <Change entry={entry} />,
    },
  ];

  return (
    <>
      <PageHeader title={t("auditTitle")} description={tAdmin("auditDescription")} />
      {!entries ? (
        <LoadState failed={failed} onRetry={() => void load()} />
      ) : entries.length === 0 ? (
        <EmptyState icon={ScrollText} title={tAdmin("noActivity")} />
      ) : (
        <>
          <DataGrid
            rows={entries}
            getRowId={(entry) => entry.id}
            columns={columns}
            searchText={(entry) => [entry.actorName, entry.storeName, describe(entry), note(entry), entry.action].filter(Boolean).join(" ")}
            searchPlaceholder={t("auditSearch")}
            chips={CATEGORIES.map((category) => ({
              value: category.value,
              label: t(category.key),
              predicate: (entry: AdminAuditEntry) => entry.action.startsWith(`${category.value}.`),
            }))}
            filters={[
              {
                key: "actor",
                label: t("auditColWho"),
                options: ACTORS.map((actor) => ({ value: actor, label: t(`actor_${actor}`) })),
                predicate: (entry, value) => entry.actorType === value,
              },
            ]}
            onRowClick={setOpen}
            initialSort={{ key: "when", direction: "desc" }}
            renderCard={(entry) => (
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {actorPill(entry)}
                  <span className="font-medium">{entry.actorName ?? "—"}</span>
                  <span className="ml-auto text-xs text-muted tabular-nums">{dateTime(entry.at)}</span>
                </div>
                <span>{describe(entry)}</span>
                {(entry.storeName || note(entry)) && <span className="text-xs text-muted">{[entry.storeName, note(entry) && `“${note(entry)}”`].filter(Boolean).join(" · ")}</span>}
              </div>
            )}
            exportFileName="audit-log"
            storageKey="admin-live-audit"
            emptyTitle={tAdmin("noMatches")}
          />
          <div className="flex flex-col items-center gap-2 text-sm text-muted">
            <span>{t("auditLoaded", { count: entries.length })}</span>
            {more && (
              <Button
                variant="secondary"
                loading={loadingMore}
                onClick={() => {
                  setLoadingMore(true);
                  void load(entries[entries.length - 1]?.at).finally(() => setLoadingMore(false));
                }}
              >
                {t("older")}
              </Button>
            )}
          </div>
        </>
      )}

      <BottomSheet open={open !== null} onClose={() => setOpen(null)} closeLabel={tAdmin("close")} title={open ? describe(open) : undefined} placement="side">
        {open && (
          <div className="flex flex-col gap-4 text-sm">
            <DetailList
              items={[
                { label: tAdmin("colWhen"), value: dateTime(open.at) },
                { label: t("auditColWho"), value: <span className="flex flex-wrap items-center gap-2">{actorPill(open)}{open.actorName ?? "—"}</span> },
                { label: tAdmin("colStore"), value: open.storeName ?? "—" },
                { label: t("auditColAction"), value: <code className="text-xs">{open.action}</code> },
              ]}
            />
            {note(open) && <p className="rounded-DEFAULT bg-border/10 p-3">“{note(open)}”</p>}
            {changedFields(open).length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="font-semibold">{t("auditColChange")}</h3>
                <dl className="flex flex-col gap-1 font-mono text-xs">
                  {changedFields(open).map(([key, from, to]) => (
                    <div key={key} className="flex flex-wrap gap-x-2">
                      <dt className="text-muted">{key}:</dt>
                      <dd>
                        {from} → {to}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}

/** The fields a change touched, as [field, before, after] — never the note. */
function changedFields(entry: AdminAuditEntry): [string, string, string][] {
  const { before, after } = entry;
  if (!before || !after) return [];
  const show = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : value === null || value === undefined ? "—" : String(value));
  return Object.keys(before)
    .filter((key) => key !== "note" && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => [key, show(before[key]), show(after[key])]);
}

/** "status: paused → trialing": only the fields that changed. */
function Change({ entry }: { entry: AdminAuditEntry }) {
  const changed = changedFields(entry);
  if (changed.length === 0) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-col font-mono text-xs text-muted">
      {changed.map(([key, from, to]) => (
        <span key={key}>
          {key}: {from} → {to}
        </span>
      ))}
    </span>
  );
}
