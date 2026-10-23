"use client";

import {
  promotionTiming,
  SITE_SECTION_SCHEMAS,
  toFieldErrors,
  type FormErrorCode,
  type SiteSection,
  type SiteSectionOf,
} from "@khmio/shared";
import { BottomSheet, Button, Card, cn, ConfirmDialog, Select, Switch, TONE_STYLES } from "@khmio/ui";
import { Pencil, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { focusFirstInvalidField } from "@/components/form-ui";
import { useDateText } from "@/components/use-date-text";
import { useAdmin } from "../../admin-context";
import { SITE_PAGE_KEYS, useWebsite, type SitePageKey } from "../../website-context";
import { EmptyState, PageHeader, Pill } from "../admin-ui";
import { emptyFor, IconButton, SchemaFields } from "../website/site-form";

// A11. Promotions (design/screens.md A11): every promotion banner on every
// website page, in one list. A promotion is a "promotion" section of a page,
// so A10 and A11 always agree; edits go to that page's draft and go live when
// the page is published. Promotions are switched off, never removed, so the
// record of what ran when is kept.

type Promotion = SiteSectionOf<"promotion">;
type Status = "showing" | "scheduled" | "ended" | "off" | "unpublished";
const FILTERS = ["all", "showing", "scheduled", "ended", "off", "unpublished"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_STYLE: Record<Status, string> = {
  showing: TONE_STYLES.success,
  scheduled: TONE_STYLES.info,
  ended: "bg-border/40 text-muted",
  off: "bg-border/40 text-muted",
  unpublished: TONE_STYLES.warning,
};

interface Row {
  pageKey: SitePageKey;
  index: number;
  promo: Promotion;
  status: Status;
  changed: boolean;
}

/** A Phnom Penh date-and-time as an ISO string with its offset. */
function phnomPenhIso(time: number): string {
  return `${new Date(time + 7 * 3600_000).toISOString().slice(0, 16)}:00+07:00`;
}

type Editing = { pageKey: SitePageKey; index: number | null; position: number; value: Promotion };

export default function AdminPromotionsPage() {
  const t = useTranslations("SiteEditor");
  const tNav = useTranslations("AdminNav");
  const locale = useLocale();
  const website = useWebsite();
  const { logWebsiteChange } = useAdmin();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const [publishing, setPublishing] = useState<SitePageKey | null>(null);
  const [notice, setNotice] = useState("");

  const now = new Date();
  const { dateTime } = useDateText();
  const when = (iso: string) => (Number.isNaN(Date.parse(iso)) ? "—" : dateTime(iso));

  const rows: Row[] = SITE_PAGE_KEYS.flatMap((pageKey) => {
    const { draft, published } = website.pages[pageKey];
    return draft.sections.flatMap((section, index) => {
      if (section.type !== "promotion") return [];
      const live = published.sections.find((candidate) => candidate.id === section.id);
      const status: Status =
        live?.type !== "promotion" ? "unpublished" : !live.visible ? "off" : promotionTiming(live, now);
      return [{ pageKey, index, promo: section, status, changed: JSON.stringify(live) !== JSON.stringify(section) }];
    });
  });
  const shown = rows.filter((row) => filter === "all" || row.status === filter);
  const count = (which: Filter) => (which === "all" ? rows.length : rows.filter((row) => row.status === which).length);

  const pageName = (key: SitePageKey) => t(`page_${key}`);
  const typeName = (section: SiteSection) => t(`type_${section.type}`);

  function where(row: Row): string {
    const before = website.pages[row.pageKey].draft.sections[row.index - 1];
    return before ? t("promoWhereAfter", { page: pageName(row.pageKey), section: typeName(before) }) : t("promoWhereTop", { page: pageName(row.pageKey) });
  }

  function setVisible(row: Row, visible: boolean) {
    const draft = website.pages[row.pageKey].draft;
    website.saveDraft(row.pageKey, { ...draft, sections: draft.sections.map((section, i) => (i === row.index ? ({ ...section, visible } as SiteSection) : section)) });
    setNotice(t("promoSavedDraft", { page: pageName(row.pageKey) }));
  }

  function startNew() {
    // Starts at the next full hour and runs a week: easy to change, never empty.
    const start = Math.ceil(Date.now() / 3600_000) * 3600_000;
    const blank = emptyFor(SITE_SECTION_SCHEMAS.promotion) as Promotion;
    const taken = new Set(SITE_PAGE_KEYS.flatMap((key) => website.pages[key].draft.sections.map((section) => section.id)));
    let n = 1;
    while (taken.has(`promotion-${n}`)) n += 1;
    const sections = website.pages.home.draft.sections;
    const afterHero = sections.findIndex((section) => section.type === "hero") + 1;
    setErrors({});
    setEditing({
      pageKey: "home",
      index: null,
      position: afterHero,
      value: { ...blank, id: `promotion-${n}`, type: "promotion", visible: true, startsAt: phnomPenhIso(start), endsAt: phnomPenhIso(start + 7 * 86_400_000) },
    });
  }

  function save() {
    if (!editing) return;
    const result = SITE_SECTION_SCHEMAS.promotion.safeParse(editing.value);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(document.querySelector<HTMLElement>("[role=dialog]"));
      return;
    }
    const draft = website.pages[editing.pageKey].draft;
    // Take it out of its old place (when editing), then put it where the admin chose.
    const others = editing.index === null ? draft.sections : draft.sections.filter((_, i) => i !== editing.index);
    const at = Math.min(editing.position, others.length);
    website.saveDraft(editing.pageKey, { ...draft, sections: [...others.slice(0, at), result.data, ...others.slice(at)] });
    setNotice(t("promoSavedDraft", { page: pageName(editing.pageKey) }));
    setEditing(null);
  }

  function publish(pageKey: SitePageKey) {
    const next = (website.pages[pageKey].history[0]?.version ?? 0) + 1;
    const outcome = website.publish(pageKey, t("mockBy"));
    setPublishing(null);
    if (!outcome.ok) return setNotice(t("problemsTitle"));
    logWebsiteChange("websitePublished", pageKey, next);
    setNotice(t("publishedNow"));
  }

  /** The sections the promotion can follow on the chosen page, without the promotion itself. */
  const positionSections = editing
    ? website.pages[editing.pageKey].draft.sections.filter((_, i) => editing.index === null || i !== editing.index)
    : [];
  const changedPages = SITE_PAGE_KEYS.filter((key) => rows.some((row) => row.pageKey === key && (row.changed || row.status === "unpublished")));

  return (
    <>
      <PageHeader
        title={tNav("promotions")}
        description={tNav("promotionsDescription")}
        actions={
          <Button onClick={startNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("promoNew")}
          </Button>
        }
      />
      <p className="text-sm text-muted">{t("promoTimeNote")}</p>
      <p role="status" aria-live="polite" className={cn("text-sm text-success", !notice && "sr-only")}>
        {notice}
      </p>

      {changedPages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-DEFAULT bg-warning/10 px-3 py-2 text-sm text-warning">
          <span className="mr-auto">{t("draftNote")}</span>
          {changedPages.map((key) => (
            <Button key={key} onClick={() => setPublishing(key)}>
              {t("promoPublishPage", { page: pageName(key) })}
            </Button>
          ))}
        </div>
      )}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label={t("colStatus")}>
        {FILTERS.map((which) => (
          <button
            key={which}
            type="button"
            onClick={() => setFilter(which)}
            aria-pressed={filter === which}
            className={cn(
              "flex min-h-touch shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium",
              filter === which ? "border-brand bg-brand text-on-brand" : "border-border bg-bg text-fg hover:bg-border/30",
            )}
          >
            {t(`promoFilter_${which}`)}
            <span className="tabular-nums opacity-80">{count(which)}</span>
          </button>
        ))}
      </div>

      <Card className="divide-y divide-border p-0">
        {shown.length === 0 ? (
          <EmptyState title={t("promoEmpty")} />
        ) : (
          shown.map((row) => {
            const title = row.promo.title[locale === "en" ? "en" : "km"] || t("noTitle");
            return (
              <div key={`${row.pageKey}-${row.promo.id}`} className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{title}</span>
                    <Pill className={STATUS_STYLE[row.status]}>{t(`promoFilter_${row.status}`)}</Pill>
                    {row.changed && row.status !== "unpublished" && <Pill className="bg-warning/10 text-warning">{t("promoChanges")}</Pill>}
                  </div>
                  <span className="text-sm text-muted">{where(row)}</span>
                  <span className="text-sm tabular-nums text-muted">{t("promoDates", { start: when(row.promo.startsAt), end: when(row.promo.endsAt) })}</span>
                </div>
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
                <Switch checked={row.promo.visible} onChange={(visible) => setVisible(row, visible)} label={t("promoOn")} />
                <IconButton
                  label={t("promoEditTitle")}
                  onClick={() => {
                    setErrors({});
                    setEditing({ pageKey: row.pageKey, index: row.index, position: row.index, value: row.promo });
                  }}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </IconButton>
                </div>
              </div>
            );
          })
        )}
      </Card>
      <p className="text-xs text-muted">{t("promoKept")}</p>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        closeLabel={t("close")}
        title={editing?.index === null ? t("promoNew") : t("promoEditTitle")}
        placement="side"
        footer={
          <div className="flex flex-col gap-2">
            {Object.keys(errors).length > 0 && <p className="text-sm text-danger">{t("fixBelow")}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} className="flex-1">
                {t("cancel")}
              </Button>
              <Button onClick={save} className="flex-1">
                {t("saveDraft")}
              </Button>
            </div>
          </div>
        }
      >
        {editing && (
          <div className="flex flex-col gap-4">
            {editing.index === null && (
              <Select
                label={t("promoPage")}
                value={editing.pageKey}
                onChange={(e) => {
                  const pageKey = SITE_PAGE_KEYS.find((key) => key === e.target.value) ?? "home";
                  const afterHero = website.pages[pageKey].draft.sections.findIndex((section) => section.type === "hero") + 1;
                  setEditing({ ...editing, pageKey, position: afterHero });
                }}
                options={SITE_PAGE_KEYS.map((key) => ({ value: key, label: pageName(key) }))}
              />
            )}
            <Select
              label={t("promoPosition")}
              value={String(editing.position)}
              onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })}
              options={[
                { value: "0", label: t("promoTop") },
                ...positionSections.map((section, i) => ({
                  value: String(i + 1),
                  label: `${i + 1}. ${typeName(section)}`,
                })),
              ]}
            />
            <SchemaFields
              schema={SITE_SECTION_SCHEMAS.promotion}
              value={editing.value}
              onChange={(value) => setEditing({ ...editing, value: value as Promotion })}
              path=""
              errors={errors}
            />
            {editing.index !== null && (
              <Link href={`/${locale}/mockup/admin/website/${editing.pageKey}`} className="flex min-h-touch items-center text-sm font-medium text-brand">
                {pageName(editing.pageKey)} →
              </Link>
            )}
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={publishing !== null}
        title={publishing ? t("promoPublishPage", { page: pageName(publishing) }) : ""}
        body={publishing ? t("promoPublishBody", { page: pageName(publishing) }) : ""}
        confirmLabel={t("publish")}
        cancelLabel={t("cancel")}
        onConfirm={() => publishing && publish(publishing)}
        onClose={() => setPublishing(null)}
      />
    </>
  );
}
