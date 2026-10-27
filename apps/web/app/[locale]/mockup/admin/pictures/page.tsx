"use client";

import { sitePictureDetailsSchema, toFieldErrors, type FormErrorCode } from "@khmio/shared";
import { BottomSheet, Button, Card, cn, ConfirmDialog } from "@khmio/ui";
import { ImagePlus, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { ACCEPTED_IMAGE_TYPES, compressImage } from "@/components/compress-image";
import { focusFirstInvalidField } from "@/components/form-ui";
import type { MockPicture } from "@/mock/mock-site";
import { useWebsite, type PictureUse } from "../../website-context";
import { EmptyState, PageHeader, Pill } from "../admin-ui";
import { IconButton, SchemaFields } from "../website/site-form";

// A12. Pictures (design/screens.md A12): the website's picture library. Every
// picture has a description in both languages; uploads are made smaller in
// the browser first; a picture in use can't be deleted; replacing one updates
// every page that uses it. Pages point to a picture as "library:<id>".

type Alt = MockPicture["alt"];
type NewFile = Pick<MockPicture, "file" | "width" | "height" | "bytes">;

/** Shrinks a chosen file and measures it. The mockup keeps it as a data URL. */
async function readPicture(file: File): Promise<NewFile> {
  const dataUrl = await compressImage(file, 1200, 0.8);
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("not an image"));
    image.src = dataUrl;
  });
  // A data URL's text is about 4/3 of the file's bytes.
  const bytes = Math.round(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
  return { file: dataUrl, ...size, bytes };
}

type Sheet = { kind: "new"; file: NewFile | null; alt: Alt } | { kind: "edit"; id: string; alt: Alt };

export default function AdminPicturesPage() {
  const t = useTranslations("SiteEditor");
  const tNav = useTranslations("AdminNav");
  const locale = useLocale() === "en" ? "en" : "km";
  const website = useWebsite();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const [reading, setReading] = useState(false);
  const [fileProblem, setFileProblem] = useState("");
  const [replacing, setReplacing] = useState<{ id: string; file: NewFile } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const newFileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceFor = useRef<string | null>(null);

  const labelOfUse = (use: PictureUse) => t(`picUse_${use.where}`, { page: t(`page_${use.pageKey}`) });

  async function choose(file: File | undefined, then: (picture: NewFile) => void) {
    if (!file) return;
    setFileProblem("");
    setReading(true);
    try {
      then(await readPicture(file));
    } catch {
      setFileProblem(t("picNotImage"));
    } finally {
      setReading(false);
    }
  }

  function save() {
    if (!sheet) return;
    const result = sitePictureDetailsSchema.safeParse({ alt: sheet.alt });
    if (sheet.kind === "new" && !sheet.file) setFileProblem(t("picNeedFile"));
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(document.querySelector<HTMLElement>("[role=dialog]"));
      return;
    }
    if (sheet.kind === "new") {
      if (!sheet.file) return;
      website.addPicture({ ...sheet.file, alt: result.data.alt });
    } else {
      website.updatePictureAlt(sheet.id, result.data.alt);
    }
    setSheet(null);
    setNotice(t("picSaved"));
  }

  const replacingUses = replacing ? website.pictureUses(replacing.id) : [];

  return (
    <>
      <PageHeader
        title={tNav("pictures")}
        description={tNav("picturesDescription")}
        actions={
          <Button
            onClick={() => {
              setErrors({});
              setFileProblem("");
              setSheet({ kind: "new", file: null, alt: { km: "", en: "" } });
            }}
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            {t("picUpload")}
          </Button>
        }
      />
      <p className="text-xs text-muted">{t("picMockNote")}</p>
      <p role="status" aria-live="polite" className={cn("text-sm text-success", !notice && "sr-only")}>
        {notice}
      </p>

      {website.pictures.length === 0 ? (
        <Card>
          <EmptyState title={t("picEmpty")} />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {website.pictures.map((picture) => {
            const uses = website.pictureUses(picture.id);
            return (
              <li key={picture.id}>
                <Card className="flex h-full flex-col gap-3 p-3">
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-DEFAULT bg-canvas">
                    {/* eslint-disable-next-line @next/next/no-img-element -- library files are data URLs in the mockup */}
                    <img src={picture.file} alt={picture.alt[locale]} className="max-h-full max-w-full object-contain" />
                  </div>
                  <p className="text-sm font-medium">{picture.alt[locale] || t("noTitle")}</p>
                  <p className="text-xs tabular-nums text-muted">
                    {t("picSize", { width: picture.width, height: picture.height, kb: Math.max(1, Math.round(picture.bytes / 1024)) })}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs font-semibold text-muted">{t("picUsedOn")}:</span>
                    {uses.length === 0 ? (
                      <span className="text-xs text-muted">{t("picUnused")}</span>
                    ) : (
                      uses.map((use) => (
                        <Pill key={`${use.pageKey}-${use.where}`} className={use.where === "live" ? "bg-success/10 text-success" : "bg-border/40 text-muted"}>
                          {labelOfUse(use)}
                        </Pill>
                      ))
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-end gap-1 border-t border-border pt-2">
                    <IconButton
                      label={t("picEditTitle")}
                      onClick={() => {
                        setErrors({});
                        setSheet({ kind: "edit", id: picture.id, alt: picture.alt });
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={t("picReplace")}
                      onClick={() => {
                        replaceFor.current = picture.id;
                        replaceInput.current?.click();
                      }}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={uses.length > 0 ? t("picInUse") : t("picDelete")}
                      disabled={uses.length > 0}
                      onClick={() => setDeleting(picture.id)}
                      className="hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* One hidden file box for "Replace file" on any card. */}
      <input
        ref={replaceInput}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        onChange={(e) => {
          const id = replaceFor.current;
          const file = e.target.files?.[0];
          e.target.value = "";
          if (id) void choose(file, (picture) => setReplacing({ id, file: picture }));
        }}
      />
      {fileProblem && !sheet && <p className="text-sm text-danger">{fileProblem}</p>}

      <BottomSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        closeLabel={t("close")}
        title={sheet?.kind === "new" ? t("picUpload") : t("picEditTitle")}
        placement="side"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSheet(null)} className="flex-1">
              {t("cancel")}
            </Button>
            <Button onClick={save} disabled={reading} className="flex-1">
              {t("picSave")}
            </Button>
          </div>
        }
      >
        {sheet && (
          <div className="flex flex-col gap-4">
            {sheet.kind === "new" && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">{t("picFile")}</span>
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-DEFAULT border border-dashed border-border bg-canvas">
                  {sheet.file ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a just-chosen file as a data URL
                    <img src={sheet.file.file} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <ImagePlus className="h-8 w-8 text-muted" aria-hidden="true" />
                  )}
                </div>
                <Button variant="secondary" onClick={() => newFileInput.current?.click()} loading={reading}>
                  {reading ? t("picReading") : t("picChooseFile")}
                </Button>
                <input
                  ref={newFileInput}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  className="hidden"
                  aria-label={t("picFile")}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    void choose(file, (picture) => setSheet((current) => (current?.kind === "new" ? { ...current, file: picture } : current)));
                  }}
                />
                <p className="text-xs text-muted">{t("picFileHint")}</p>
                {fileProblem && <p className="text-sm text-danger">{fileProblem}</p>}
                {sheet.file && (
                  <p className="text-xs tabular-nums text-muted">
                    {t("picSize", { width: sheet.file.width, height: sheet.file.height, kb: Math.max(1, Math.round(sheet.file.bytes / 1024)) })}
                  </p>
                )}
              </div>
            )}
            {sheet.kind === "edit" && (() => {
              const picture = website.pictures.find((candidate) => candidate.id === sheet.id);
              return picture ? (
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-DEFAULT bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element -- library file */}
                  <img src={picture.file} alt="" className="max-h-full max-w-full object-contain" />
                </div>
              ) : null;
            })()}
            <p className="text-sm text-muted">{t("picDescriptionHint")}</p>
            <SchemaFields
              schema={sitePictureDetailsSchema}
              value={{ alt: sheet.alt }}
              onChange={(value) => setSheet({ ...sheet, alt: (value as { alt: Alt }).alt })}
              path=""
              errors={errors}
            />
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={replacing !== null}
        title={t("picReplaceTitle")}
        body={
          replacingUses.length > 0
            ? t("picReplaceBody", { pages: replacingUses.map(labelOfUse).join(", ") })
            : t("picReplaceUnused")
        }
        confirmLabel={t("picReplace")}
        cancelLabel={t("cancel")}
        onConfirm={() => {
          if (replacing) website.replacePictureFile(replacing.id, replacing.file);
          setReplacing(null);
          setNotice(t("picReplaced"));
        }}
        onClose={() => setReplacing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t("picDeleteTitle")}
        body={t("picDeleteBody")}
        confirmLabel={t("picDelete")}
        cancelLabel={t("cancel")}
        danger
        onConfirm={() => {
          // Checked again at the moment of deleting: never remove a picture a page needs.
          if (deleting && website.pictureUses(deleting).length === 0) {
            website.deletePicture(deleting);
            setNotice(t("picDeleted"));
          }
          setDeleting(null);
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
