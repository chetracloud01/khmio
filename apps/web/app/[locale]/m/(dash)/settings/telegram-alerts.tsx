"use client";

import { Button, Card, IconButton } from "@khmio/ui";
import { Check, ExternalLink, Send, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type StaffGroup, type TelegramLink } from "@/lib/api";

/**
 * Where order alerts go: the seller's own chat with the bot (signing in with
 * Telegram turns it on), and any staff groups linked with a one-time link.
 * Removing the bot from a group unlinks it too.
 */
export function TelegramAlerts({ signedInWithTelegram }: { signedInWithTelegram: boolean }) {
  const t = useTranslations("Telegram");
  const tApp = useTranslations("App");
  const [groups, setGroups] = useState<StaffGroup[] | null>(null);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(() => {
    api<StaffGroup[]>("/store/telegram-groups").then(setGroups, () => setGroups([]));
  }, []);
  useEffect(load, [load]);

  async function makeLink() {
    setBusy(true);
    setProblem(null);
    try {
      setLink(await api<TelegramLink>("/store/telegram-groups/link", { method: "POST" }));
    } catch (failure) {
      setProblem(
        failure instanceof ApiError && failure.code === "telegram_not_configured"
          ? t("notConfigured")
          : failure instanceof ApiError && failure.code === "store_paused"
            ? tApp("storePaused")
            : failure instanceof ApiError && failure.code === "too_many_requests"
              ? tApp("tooManyTries")
              : tApp("saveFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function unlink(id: string) {
    await api(`/store/telegram-groups/${id}`, { method: "DELETE" }).catch(() => undefined);
    load();
  }

  return (
    <Card id="alerts" className="flex scroll-mt-4 flex-col gap-4 p-4">
      <div>
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted">{t("body")}</p>
      </div>
      <p className="flex items-start gap-2 text-sm">
        {signedInWithTelegram ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" /> : <Send className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
        {signedInWithTelegram ? t("privateOn") : t("privateOff")}
      </p>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("groupsTitle")}</h3>
        {groups?.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-DEFAULT border border-border">
            {groups.map((group) => (
              <li key={group.id} className="flex items-center gap-3 px-3 py-2">
                <Users className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{group.title || t("unnamedGroup")}</span>
                <IconButton icon={Trash2} tone="danger" label={t("unlink", { group: group.title || t("unnamedGroup") })} onClick={() => void unlink(group.id)} />
              </li>
            ))}
          </ul>
        ) : (
          groups && <p className="text-sm text-muted">{t("noGroups")}</p>
        )}
      </div>

      {link ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-brand/40 bg-brand/5 p-3">
          <ol className="list-decimal pl-5 text-sm text-muted">
            <li>{t("step1")}</li>
            <li>{t("step2")}</li>
            <li>{t("step3")}</li>
          </ol>
          <a href={link.link} target="_blank" rel="noreferrer" className="flex min-h-touch items-center justify-center gap-2 rounded-DEFAULT bg-brand px-4 text-sm font-semibold text-on-brand">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {t("openTelegram")}
          </a>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{t("linkExpires")}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setLink(null);
                load();
              }}
            >
              {t("done")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="self-start" loading={busy} onClick={() => void makeLink()}>
          <Users className="h-4 w-4" aria-hidden="true" />
          {t("addGroup")}
        </Button>
      )}
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
    </Card>
  );
}
