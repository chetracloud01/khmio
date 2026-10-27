"use client";

import { workerState, type HealthState } from "@khmio/shared";
import { Card, cn, SectionTitle } from "@khmio/ui";
import { AlertTriangle, CalendarClock, ChevronRight, MessageSquareWarning, PauseCircle, ShoppingBag, Sparkles, Store, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { adminAuditPageSchema, adminOverviewSchema, type AdminAuditEntry, type AdminOverview } from "@/lib/admin-api";
import { api } from "@/lib/api";
import { useDateText } from "@/components/use-date-text";
import { LoadState, PageHeader, Pill, StatCard } from "./admin-ui";
import { useAuditText } from "./audit-text";

const HEALTH_DOT: Record<HealthState, string> = { ok: "bg-success", warning: "bg-danger", off: "bg-muted" };
const RECENT = 6;

// The admin overview (design/screens.md A1): the numbers that say whether the
// platform is healthy, the system's health, what needs a person (each linked
// to where it's handled), and the latest changes. Money cards say "Free beta"
// until billing exists (Release 2), so nothing shows a made-up number.
export default function AdminOverviewPage() {
  const t = useTranslations("AdminApp");
  const tAdmin = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const locale = useLocale();
  const { dateTime, timeAgo: ago } = useDateText();
  const { describe } = useAuditText();
  const [data, setData] = useState<{ overview: AdminOverview; recent: AdminAuditEntry[] } | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([api("/admin/overview", adminOverviewSchema), api(`/admin/audit-log?limit=${RECENT}`, adminAuditPageSchema)])
      .then(([overview, audit]) => setData({ overview, recent: audit.entries }))
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);


  if (!data) {
    return (
      <>
        <PageHeader title={tNav("overview")} description={t("overviewDescription")} />
        <LoadState failed={failed} onRetry={load} />
      </>
    );
  }

  const { overview, recent } = data;
  const { health } = overview;
  const base = `/${locale}/admin`;
  const worker = workerState(health.workerSeenAt ? new Date(health.workerSeenAt) : null);

  const healthItems: { key: string; label: string; state: HealthState; value: string; href?: string }[] = [
    {
      key: "worker",
      label: t("healthWorker"),
      state: worker,
      value: worker === "ok" ? t("healthWorkerOk", { when: ago(health.workerSeenAt!) }) : health.workerSeenAt ? t("healthWorkerDown", { when: ago(health.workerSeenAt) }) : t("healthWorkerNever"),
    },
    {
      key: "backups",
      label: tNav("backups"),
      state: health.backupsStale ? "warning" : "ok",
      value: health.latestBackupAt ? (health.backupsStale ? t("healthBackupLate", { when: ago(health.latestBackupAt) }) : t("healthBackupOk", { when: ago(health.latestBackupAt) })) : t("healthBackupNone"),
      href: `${base}/backups`,
    },
    { key: "telegram", label: t("healthTelegram"), state: health.telegram === "on" ? "ok" : "warning", value: health.telegram === "on" ? t("healthTelegramOn") : t("healthTelegramDryRun") },
    { key: "khqr", label: t("healthKhqr"), state: "off", value: t("healthKhqrOff") },
  ];

  // Everything that needs a person, linked to where it's handled.
  const attention: { key: string; count?: number; text: string; tone: "warning" | "danger"; href?: string }[] = [
    worker !== "ok" && { key: "worker", text: t("attentionWorker"), tone: "danger" as const },
    health.backupsStale && { key: "backups", text: t("attentionBackups"), tone: "danger" as const, href: `${base}/backups` },
    overview.messagesGaveUp > 0 && { key: "messages", count: overview.messagesGaveUp, text: t("attentionMessagesShort"), tone: "danger" as const, href: `${base}/audit-log` },
    overview.paused > 0 && { key: "paused", count: overview.paused, text: t("attentionPausedShort"), tone: "danger" as const, href: `${base}/merchants?status=paused` },
    overview.trialsEndingSoon > 0 && { key: "trials", count: overview.trialsEndingSoon, text: t("attentionTrialsShort"), tone: "warning" as const, href: `${base}/merchants?status=endingSoon` },
  ].filter((item): item is Exclude<typeof item, false> => item !== false);

  return (
    <>
      <PageHeader title={tNav("overview")} description={t("overviewDescription")} />

      <section className="flex flex-col gap-3">
        <SectionTitle>{tAdmin("overviewTitle")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Store} label={t("statShops")} value={String(overview.shops)} />
          <StatCard icon={Sparkles} label={t("statNewThisWeek")} value={String(overview.newThisWeek)} tone="success" />
          <StatCard icon={CalendarClock} label={t("statTrialsEnding")} value={String(overview.trialsEndingSoon)} tone={overview.trialsEndingSoon ? "warning" : "muted"} />
          <StatCard icon={PauseCircle} label={t("statPaused")} value={String(overview.paused)} tone={overview.paused ? "danger" : "muted"} />
          <StatCard icon={ShoppingBag} label={t("statOrdersToday")} value={String(overview.ordersToday)} />
          <StatCard icon={ShoppingBag} label={t("statWaitingOrders")} value={String(overview.waitingOrders)} tone={overview.waitingOrders ? "warning" : "muted"} />
          <StatCard icon={MessageSquareWarning} label={t("statMessagesFailed")} value={String(overview.messagesGaveUp)} tone={overview.messagesGaveUp ? "danger" : "muted"} />
          <StatCard icon={Wallet} label={t("statRevenue")} value={health.betaAllBasic ? t("freeBeta") : "—"} tone="muted" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>{tAdmin("healthTitle")}</SectionTitle>
        <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
          {healthItems.map((item) => {
            const body: ReactNode = (
              <>
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", HEALTH_DOT[item.state])} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted">{item.label}</span>
                  <span className={cn("block font-semibold", item.state === "warning" && "text-danger", item.state === "off" && "text-muted")}>{item.value}</span>
                  <span className="sr-only">{t(`healthState_${item.state}`)}</span>
                </span>
              </>
            );
            return (
              <div key={item.key} className="lg:px-4 lg:first:pl-0 lg:last:pr-0">
                {item.href ? (
                  <Link href={item.href} className="-m-2 flex min-h-touch items-start gap-3 rounded-DEFAULT p-2 hover:bg-border/10">
                    {body}
                    <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                ) : (
                  <div className="flex items-start gap-3">{body}</div>
                )}
              </div>
            );
          })}
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <SectionTitle>{tAdmin("attentionTitle")}</SectionTitle>
          <Card className="p-0">
            {attention.length === 0 ? (
              <p className="p-4 text-sm text-muted">{tAdmin("attentionNone")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {attention.map((item) => {
                  const inner = (
                    <>
                      <span
                        className={cn(
                          "flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold",
                          item.tone === "danger" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning",
                        )}
                      >
                        {item.count ?? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                      </span>
                      <span className="flex-1">{item.text}</span>
                    </>
                  );
                  return (
                    <li key={item.key}>
                      {item.href ? (
                        <Link href={item.href} className="flex min-h-touch items-center gap-3 px-4 py-3 text-sm hover:bg-border/10">
                          {inner}
                          <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
                        </Link>
                      ) : (
                        <div className="flex min-h-touch items-center gap-3 px-4 py-3 text-sm">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle
            aside={
              <Link href={`${base}/audit-log`} className="-my-3 flex min-h-touch items-center text-sm font-medium text-brand">
                {tAdmin("viewAll")}
              </Link>
            }
          >
            {tAdmin("activityTitle")}
          </SectionTitle>
          <Card className="p-0">
            {recent.length === 0 ? (
              <p className="p-4 text-sm text-muted">{tAdmin("noActivity")}</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {recent.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="font-medium">{entry.actorName ?? t(`actor_${entry.actorType}`)}</span>
                        <span>{describe(entry)}</span>
                      </span>
                      {entry.storeName && <Pill tone="muted" className="mt-1">{entry.storeName}</Pill>}
                    </span>
                    <span className="shrink-0 text-xs text-muted tabular-nums" title={dateTime(entry.at)}>
                      {ago(entry.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
