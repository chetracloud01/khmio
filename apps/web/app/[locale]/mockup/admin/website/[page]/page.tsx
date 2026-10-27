"use client";

import {
  sitePageSchema,
  SITE_SECTION_SCHEMAS,
  SITE_SECTION_TYPES,
  siteSeoSchema,
  toFieldErrors,
  type FormErrorCode,
  type LocalizedText,
  type SitePage,
  type SiteSection,
  type SiteSectionType,
} from "@khmio/shared";
import { BottomSheet, Button, buttonVariants, Card, cn, ConfirmDialog, SegmentedControl, Switch } from "@khmio/ui";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";
import { useAdmin } from "../../../admin-context";
import { SITE_PAGE_INFO, SITE_PAGE_KEYS, useWebsite, type SitePageKey } from "../../../website-context";
import { PageHeader, Pill, SectionTitle } from "../../admin-ui";
import { useTimeAgo } from "../../use-admin-data";
import { emptyFor, IconButton, minutesSince, SchemaFields, useSiteFieldLabel } from "../site-form";

// A10. One website page in the admin (design/screens.md A10): its sections in
// order — on/off, move, edit, add, remove — and its link preview, all in a
// draft; Preview shows the draft as visitors would see it; Publish checks it
// and puts it live; History brings back any earlier version.

type Editing =
  | { kind: "section"; index: number | null; value: SiteSection }
  | { kind: "seo"; value: SitePage["seo"] };

/** The first text in a section that says what it is, for the list. */
function summaryOf(section: SiteSection, locale: "km" | "en"): string | null {
  const record = section as unknown as Record<string, unknown>;
  for (const key of ["headline", "title", "text", "name"]) {
    const value = record[key] as LocalizedText | undefined;
    if (value && typeof value === "object" && typeof value[locale] === "string" && value[locale]) return value[locale];
  }
  return null;
}

export default function AdminWebsitePageEditor() {
  const params = useParams<{ page: string }>();
  const key = SITE_PAGE_KEYS.find((candidate) => candidate === params.page);
  if (!key) notFound();
  return <PageEditor pageKey={key} />;
}

function PageEditor({ pageKey }: { pageKey: SitePageKey }) {
  const t = useTranslations("SiteEditor");
  const locale = useLocale() === "en" ? "en" : "km";
  const errorText = useFormErrorText();
  const timeAgo = useTimeAgo();
  const fieldLabel = useSiteFieldLabel();
  const website = useWebsite();
  const { logWebsiteChange } = useAdmin();

  const state = website.pages[pageKey];
  const draft = state.draft;
  const changes = website.hasChanges(pageKey);
  const by = t("mockBy");

  const [editing, setEditing] = useState<Editing | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, FormErrorCode>>({});
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<"publish" | "discard" | { restore: number } | null>(null);
  const [problems, setProblems] = useState<{ path: string; code: string }[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [notice, setNotice] = useState("");

  const setSections = (sections: SiteSection[]) => website.saveDraft(pageKey, { ...draft, sections });
  const typeLabel = (type: SiteSectionType) => t(`type_${type}`);

  function move(index: number, to: number) {
    const sections = [...draft.sections];
    const [section] = sections.splice(index, 1);
    if (!section) return;
    sections.splice(to, 0, section);
    setSections(sections);
  }

  function startAdd(type: SiteSectionType) {
    const blank = emptyFor(SITE_SECTION_SCHEMAS[type]) as SiteSection;
    const taken = new Set(draft.sections.map((section) => section.id));
    let n = 1;
    while (taken.has(`${type}-${n}`)) n += 1;
    setAdding(false);
    setFormErrors({});
    setEditing({ kind: "section", index: null, value: { ...blank, id: `${type}-${n}`, type, visible: true } as SiteSection });
  }

  /** Shows the problems, then moves to the first one (design standard §5). */
  function showFormErrors(errors: Record<string, FormErrorCode>) {
    setFormErrors(errors);
    focusFirstInvalidField(document.querySelector<HTMLElement>("[role=dialog]"));
  }

  function saveEditing() {
    if (!editing) return;
    if (editing.kind === "seo") {
      const result = siteSeoSchema.safeParse(editing.value);
      if (!result.success) return showFormErrors(toFieldErrors(result.error));
      website.saveDraft(pageKey, { ...draft, seo: result.data });
    } else {
      const result = SITE_SECTION_SCHEMAS[editing.value.type].safeParse(editing.value);
      if (!result.success) return showFormErrors(toFieldErrors(result.error));
      const section = result.data as SiteSection;
      setSections(editing.index === null ? [...draft.sections, section] : draft.sections.map((current, i) => (i === editing.index ? section : current)));
    }
    setEditing(null);
    setFormErrors({});
    setNotice(t("savedDraft"));
  }

  function tryPublish() {
    const result = sitePageSchema.safeParse(draft);
    if (!result.success) return setProblems(result.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.message })));
    setConfirm("publish");
  }

  function doPublish() {
    const next = (state.history[0]?.version ?? 0) + 1;
    const outcome = website.publish(pageKey, by);
    setConfirm(null);
    if (!outcome.ok) return setProblems(outcome.issues);
    logWebsiteChange("websitePublished", pageKey, next);
    setNotice(t("publishedNow"));
  }

  /** "Hero · Headline (Khmer) — Please fill this in." */
  function describeProblem(problem: { path: string; code: string }): string {
    const parts = problem.path.split(".");
    const lang = parts.at(-1) === "km" ? t("khmer") : parts.at(-1) === "en" ? t("english") : null;
    const field = [...parts].reverse().find((part) => part !== "km" && part !== "en" && !/^\d+$/.test(part));
    const where =
      parts[0] === "sections"
        ? (() => {
            const section = draft.sections[Number(parts[1])];
            return section ? `${typeLabel(section.type)}${summaryOf(section, locale) ? ` “${summaryOf(section, locale)}”` : ""}` : "";
          })()
        : t("problemSeo");
    const fieldName = field && field !== "sections" && field !== "seo" ? fieldLabel(field) : "";
    const message = errorText(problem.code as FormErrorCode) ?? problem.code;
    return [where, [fieldName, lang && `(${lang})`].filter(Boolean).join(" "), message].filter(Boolean).join(" · ");
  }

  const sitePath = SITE_PAGE_INFO[pageKey].path;
  const liveHref = `/${locale}/mockup/site${sitePath === "/" ? "" : sitePath}`;

  return (
    <>
      <Link href={`/${locale}/mockup/admin/website`} className="-mb-2 flex min-h-touch items-center gap-1 self-start text-sm font-medium text-brand">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("allPages")}
      </Link>
      <PageHeader
        title={t(`page_${pageKey}`)}
        description={`khmio.com${sitePath === "/" ? "" : sitePath}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPreviewing(true)}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              {t("preview")}
            </Button>
            {changes && (
              <Button variant="secondary" onClick={() => setConfirm("discard")}>
                {t("discard")}
              </Button>
            )}
            <Button onClick={tryPublish} disabled={!changes}>
              {t("publish")}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Pill className={changes ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}>{changes ? t("statusChanges") : t("statusPublished")}</Pill>
        {state.history[0] && <span className="text-muted">{t("publishedBy", { time: timeAgo(minutesSince(state.history[0].at)), name: state.history[0].by })}</span>}
        <a href={liveHref} target="_blank" rel="noopener noreferrer" className="flex min-h-touch items-center gap-1 font-medium text-brand">
          {t("viewLive")}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
      {changes && <p className="rounded-DEFAULT bg-warning/10 px-3 py-2 text-sm text-warning">{t("draftNote")}</p>}
      <p role="status" aria-live="polite" className={cn("text-sm text-success", !notice && "sr-only")}>
        {notice}
      </p>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        <SectionTitle aside={<span className="text-xs text-muted">{t("sectionsHint")}</span>}>{t("sectionsTitle")}</SectionTitle>
        <Card className="divide-y divide-border p-0">
          {draft.sections.map((section, index) => {
            const summary = summaryOf(section, locale);
            return (
              <div key={section.id} className={cn("flex flex-wrap items-center gap-2 p-3 sm:p-4", !section.visible && "bg-canvas/60")}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-border/40 text-xs font-semibold text-muted">{index + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">{typeLabel(section.type)}</span>
                  <span className={cn("truncate font-medium", !section.visible && "text-muted line-through")}>
                    {summary ?? (section.type === "productCards" || section.type === "plans" ? t("fromSystem") : t("noTitle"))}
                  </span>
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-1 sm:w-auto">
                  <Switch
                    checked={section.visible}
                    onChange={(visible) => setSections(draft.sections.map((current, i) => (i === index ? ({ ...current, visible } as SiteSection) : current)))}
                    label={t("showOnSite")}
                    className="mr-2"
                  />
                  <div className="flex items-center">
                    <IconButton label={t("moveUp")} disabled={index === 0} onClick={() => move(index, index - 1)}>
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton label={t("moveDown")} disabled={index === draft.sections.length - 1} onClick={() => move(index, index + 1)}>
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={t("edit")}
                      onClick={() => {
                        setFormErrors({});
                        setEditing({ kind: "section", index, value: section });
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                    {/* Promotions are switched off, never removed: the record of what ran when is kept (A11). */}
                    <IconButton
                      label={section.type === "promotion" ? t("promoKept") : t("removeSection")}
                      disabled={section.type === "promotion"}
                      onClick={() => setRemoving(index)}
                      className="hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
        <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("addSection")}
        </Button>
      </div>

      {/* Link preview */}
      <div className="flex flex-col gap-3">
        <SectionTitle aside={<span className="text-xs text-muted">{t("seoHint")}</span>}>{t("seoTitle")}</SectionTitle>
        <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-semibold text-info">{draft.seo.title[locale]}</span>
            <span className="text-sm text-muted">{draft.seo.description[locale]}</span>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setFormErrors({});
              setEditing({ kind: "seo", value: draft.seo });
            }}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {t("editSeo")}
          </Button>
        </Card>
      </div>

      {/* History */}
      <div className="flex flex-col gap-3">
        <SectionTitle aside={<span className="text-xs text-muted">{t("historyHint")}</span>}>{t("historyTitle")}</SectionTitle>
        <Card className="divide-y divide-border p-0">
          {state.history.map((entry, index) => (
            <div key={entry.version} className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 font-semibold">
                  {t("version", { number: entry.version })}
                  {index === 0 && <Pill className="bg-success/10 text-success">{t("live")}</Pill>}
                </span>
                <span className="text-xs text-muted">{t("publishedBy", { time: timeAgo(minutesSince(entry.at)), name: entry.by })}</span>
              </div>
              {index > 0 && (
                <Button variant="secondary" onClick={() => setConfirm({ restore: entry.version })}>
                  {t("restore")}
                </Button>
              )}
            </div>
          ))}
        </Card>
      </div>

      {/* Add a section: the site kit */}
      <BottomSheet open={adding} onClose={() => setAdding(false)} closeLabel={t("close")} title={t("addSection")} placement="side">
        <div className="flex flex-col gap-2">
          {SITE_SECTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => startAdd(type)}
              className="flex min-h-touch flex-col items-start gap-0.5 rounded-DEFAULT border border-border p-3 text-left hover:border-brand hover:bg-brand/5"
            >
              <span className="font-semibold">{typeLabel(type)}</span>
              <span className="text-sm text-muted">{t(`typeHint_${type}`)}</span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Edit a section or the link preview: the form is built from its schema */}
      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        closeLabel={t("close")}
        title={editing?.kind === "seo" ? t("editSeo") : editing ? t("editSection", { section: typeLabel(editing.value.type) }) : ""}
        placement="side"
        footer={
          <div className="flex flex-col gap-2">
            {Object.keys(formErrors).length > 0 && <p className="text-sm text-danger">{t("fixBelow")}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} className="flex-1">
                {t("cancel")}
              </Button>
              <Button onClick={saveEditing} className="flex-1">
                {t("saveDraft")}
              </Button>
            </div>
          </div>
        }
      >
        {editing && (
          <SchemaFields
            schema={editing.kind === "seo" ? siteSeoSchema : SITE_SECTION_SCHEMAS[editing.value.type]}
            value={editing.value}
            onChange={(value) => setEditing(editing.kind === "seo" ? { ...editing, value: value as SitePage["seo"] } : { ...editing, value: value as SiteSection })}
            path=""
            errors={formErrors}
          />
        )}
      </BottomSheet>

      <ConfirmDialog
        open={removing !== null}
        title={t("removeTitle")}
        body={t("removeBody")}
        confirmLabel={t("removeSection")}
        cancelLabel={t("cancel")}
        danger
        onConfirm={() => {
          if (removing !== null) setSections(draft.sections.filter((_, i) => i !== removing));
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      />
      <ConfirmDialog
        open={confirm === "publish"}
        title={t("publishTitle")}
        body={t("publishBody")}
        confirmLabel={t("publish")}
        cancelLabel={t("cancel")}
        onConfirm={doPublish}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "discard"}
        title={t("discardTitle")}
        body={t("discardBody")}
        confirmLabel={t("discard")}
        cancelLabel={t("cancel")}
        danger
        onConfirm={() => {
          website.discardDraft(pageKey);
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={typeof confirm === "object" && confirm !== null}
        title={typeof confirm === "object" && confirm ? t("restoreTitle", { number: confirm.restore }) : ""}
        body={t("restoreBody")}
        confirmLabel={t("restore")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          if (typeof confirm === "object" && confirm) {
            website.restore(pageKey, confirm.restore);
            logWebsiteChange("websiteRestored", pageKey, confirm.restore);
            setNotice(t("restoredNow", { number: confirm.restore }));
          }
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />

      {/* Publish refused: say exactly what to fix */}
      <BottomSheet open={problems !== null} onClose={() => setProblems(null)} closeLabel={t("close")} title={t("problemsTitle")} placement="center">
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted">{t("problemsBody")}</p>
          <ul className="flex flex-col gap-2">
            {problems?.map((problem, index) => (
              <li key={index} className="rounded-DEFAULT bg-danger/10 px-3 py-2 text-danger">
                {describeProblem(problem)}
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => setProblems(null)}>
            {t("close")}
          </Button>
        </div>
      </BottomSheet>

      {previewing && <PreviewDialog pageKey={pageKey} onClose={() => setPreviewing(false)} />}
    </>
  );
}

/** The draft, exactly as visitors would see it, at phone or desktop width. */
function PreviewDialog({ pageKey, onClose }: { pageKey: SitePageKey; onClose: () => void }) {
  const t = useTranslations("SiteEditor");
  const locale = useLocale();
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const box = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(1280);
  const src = `/${locale}/mockup/site/preview/${pageKey}`;

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBoxWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A desktop page is drawn 1280 px wide, then shrunk to fit the window.
  const width = device === "phone" ? 390 : 1280;
  const scale = device === "desktop" ? Math.min(1, boxWidth / 1280) : 1;
  const height = 760;

  return (
    <div role="dialog" aria-modal="true" aria-label={t("previewTitle")} className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg px-4 py-2">
        <span className="mr-auto font-semibold">{t("previewTitle")}</span>
        <SegmentedControl
          value={device}
          onChange={(value) => setDevice(value === "desktop" ? "desktop" : "phone")}
          options={[
            { value: "phone", label: t("phone") },
            { value: "desktop", label: t("desktop") },
          ]}
        />
        <a href={src} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary" })}>
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t("openNewTab")}</span>
        </a>
        <IconButton label={t("close")} onClick={onClose}>
          <X className="h-5 w-5" aria-hidden="true" />
        </IconButton>
      </div>
      <div ref={box} className="flex flex-1 justify-center overflow-auto p-4">
        <div style={{ width: width * scale, height: height * scale }} className="shrink-0 overflow-hidden rounded-2xl border border-border bg-bg shadow-raised">
          <iframe
            title={t("previewFrame")}
            src={src}
            style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
            className="border-0"
          />
        </div>
      </div>
    </div>
  );
}
