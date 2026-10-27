"use client";

import {
  kycIdTypeSchema,
  kycSubmissionSchema,
  toFieldErrors,
  type FormErrorCode,
  type KycIdType,
} from "@khmio/shared";
import { Card, cn, Input, SegmentedControl } from "@khmio/ui";
import { AlertCircle, BadgeCheck, Camera, Clock, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useAdmin } from "../../admin-context";
import { ACCEPTED_IMAGE_TYPES, compressImage } from "@/components/compress-image";
import { FormActions, FormSection, focusFirstInvalidField, useFormErrorText } from "@/components/form-ui";

interface Draft {
  idType: KycIdType;
  fullName: string;
  idNumber: string;
  frontPhoto: string;
  backPhoto: string;
}

type Field = keyof Draft;

const EMPTY_DRAFT: Draft = { idType: "national_id", fullName: "", idNumber: "", frontPhoto: "", backPhoto: "" };

export default function DashboardVerificationPage() {
  const { hydrated } = useAdmin();
  return hydrated ? <Verification /> : null;
}

/** Tap to take or pick a photo of one side of the ID; shows the photo once chosen. */
function PhotoPicker({
  label,
  hint,
  value,
  error,
  chooseLabel,
  replaceLabel,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  error?: string;
  chooseLabel: string;
  replaceLabel: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const messageId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium text-fg">
        {label}
      </span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-labelledby={labelId}
        aria-describedby={messageId}
        data-invalid={error ? "true" : undefined}
        className={cn(
          "flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-DEFAULT border border-dashed bg-border/10 text-sm text-muted focus:outline-none focus:ring-2 focus:ring-brand",
          error ? "border-danger" : "border-border",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview of the merchant's own photo
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1">
            <Camera className="h-6 w-6" aria-hidden="true" />
            {chooseLabel}
          </span>
        )}
      </button>
      {value && (
        <button type="button" onClick={() => inputRef.current?.click()} className="min-h-touch self-start text-sm font-medium text-brand">
          {replaceLabel}
        </button>
      )}
      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} capture="environment" className="hidden" onChange={onChange} />
      {error ? (
        <p id={messageId} className="flex items-center gap-1 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        <p id={messageId} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function Verification() {
  const t = useTranslations("Kyc");
  const errorText = useFormErrorText();
  const { demoKycStatus: status, demoKyc, submitDemoKyc } = useAdmin();
  const formRef = useRef<HTMLDivElement>(null);

  // After a rejection, start from what was sent (minus the photos, which usually need retaking).
  const [draft, setDraft] = useState<Draft>(() =>
    demoKyc.submission
      ? { ...EMPTY_DRAFT, idType: demoKyc.submission.idType, fullName: demoKyc.submission.fullName, idNumber: demoKyc.submission.idNumber }
      : EMPTY_DRAFT,
  );
  const [startDraft] = useState(draft);
  const [errors, setErrors] = useState<Partial<Record<Field, FormErrorCode>>>({});
  const [photoFailed, setPhotoFailed] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(startDraft);

  function update<K extends Field>(field: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function toInput(value: Draft) {
    return {
      idType: value.idType,
      fullName: value.fullName,
      idNumber: value.idNumber,
      frontPhoto: value.frontPhoto,
      backPhoto: value.idType === "national_id" && value.backPhoto ? value.backPhoto : undefined,
    };
  }

  function checkField(field: Field) {
    const result = kycSubmissionSchema.safeParse(toInput(draft));
    setErrors((prev) => ({ ...prev, [field]: result.success ? undefined : toFieldErrors(result.error)[field] }));
  }

  function handlePhoto(field: "frontPhoto" | "backPhoto") {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setPhotoFailed(false);
      compressImage(file)
        .then((dataUrl) => update(field, dataUrl))
        .catch(() => setPhotoFailed(true));
    };
  }

  function handleSubmit() {
    const result = kycSubmissionSchema.safeParse(toInput(draft));
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      focusFirstInvalidField(formRef.current);
      return;
    }
    submitDemoKyc(result.data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const statusCard = {
    not_submitted: { icon: ShieldAlert, tone: "border-border bg-bg", iconTone: "text-muted", title: t("statusNotSubmitted"), body: t("statusNotSubmittedBody") },
    pending: { icon: Clock, tone: "border-warning/40 bg-warning/5", iconTone: "text-warning", title: t("statusPending"), body: t("statusPendingBody") },
    approved: { icon: BadgeCheck, tone: "border-success/40 bg-success/5", iconTone: "text-success", title: t("statusApproved"), body: t("statusApprovedBody") },
    rejected: { icon: AlertCircle, tone: "border-danger/40 bg-danger/5", iconTone: "text-danger", title: t("statusRejected"), body: t("statusRejectedBody") },
  }[status];
  const StatusIcon = statusCard.icon;
  const canSubmit = status === "not_submitted" || status === "rejected";

  return (
    <div ref={formRef} className="mx-auto flex max-w-[720px] flex-col gap-5 p-4 text-fg md:p-6">
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      <div className={cn("flex gap-3 rounded-DEFAULT border p-4", statusCard.tone)} role="status">
        <StatusIcon className={cn("mt-0.5 h-5 w-5 shrink-0", statusCard.iconTone)} aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-semibold">{statusCard.title}</p>
          <p className="text-sm text-muted">{statusCard.body}</p>
          {status === "rejected" && demoKyc.rejection && (
            <div className="mt-2 rounded-DEFAULT bg-bg p-3 text-sm">
              <p className="font-medium">{t(`reason_${demoKyc.rejection.reason}`)}</p>
              {demoKyc.rejection.note && <p className="mt-1 text-muted">{demoKyc.rejection.note}</p>}
            </div>
          )}
          {status === "pending" && demoKyc.submission && (
            <p className="mt-1 text-sm">
              {t(`idType_${demoKyc.submission.idType}`)} · {demoKyc.submission.fullName}
            </p>
          )}
        </div>
      </div>

      {canSubmit && (
        <Card className="flex flex-col p-4 md:p-6">
          <FormSection stacked title={t("sectionId")} description={t("sectionIdHelp")}>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg">{t("idTypeLabel")}</span>
              <SegmentedControl
                value={draft.idType}
                onChange={(next) => {
                  const parsed = kycIdTypeSchema.safeParse(next);
                  if (parsed.success) update("idType", parsed.data);
                }}
                options={kycIdTypeSchema.options.map((value) => ({ value, label: t(`idType_${value}`) }))}
              />
            </div>
            <Input
              label={t("fullNameLabel")}
              placeholder={t("fullNamePlaceholder")}
              autoComplete="name"
              value={draft.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              onBlur={() => checkField("fullName")}
              error={errorText(errors.fullName)}
            />
            <Input
              label={t("idNumberLabel")}
              placeholder={draft.idType === "national_id" ? "012345678" : "N1234567"}
              autoCapitalize="characters"
              value={draft.idNumber}
              onChange={(e) => update("idNumber", e.target.value)}
              onBlur={() => checkField("idNumber")}
              error={errorText(errors.idNumber)}
            />
          </FormSection>

          <FormSection stacked title={t("sectionPhotos")} description={t("sectionPhotosHelp")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <PhotoPicker
                label={draft.idType === "national_id" ? t("frontPhotoLabel") : t("passportPhotoLabel")}
                hint={t("photoHint")}
                value={draft.frontPhoto}
                error={errorText(errors.frontPhoto)}
                chooseLabel={t("choosePhoto")}
                replaceLabel={t("replacePhoto")}
                onChange={handlePhoto("frontPhoto")}
              />
              {draft.idType === "national_id" && (
                <PhotoPicker
                  label={t("backPhotoLabel")}
                  hint={t("photoHint")}
                  value={draft.backPhoto}
                  error={errorText(errors.backPhoto)}
                  chooseLabel={t("choosePhoto")}
                  replaceLabel={t("replacePhoto")}
                  onChange={handlePhoto("backPhoto")}
                />
              )}
            </div>
            {photoFailed && <p className="text-sm text-danger">{t("photoUnreadable")}</p>}
            <p className="text-xs text-muted">{t("privacyNote")}</p>
          </FormSection>

          <FormActions
            dirty={dirty}
            onCancel={() => {
              setDraft(startDraft);
              setErrors({});
            }}
            onSave={handleSubmit}
            saveLabel={t("submit")}
            cancelLabel={t("cancel")}
            className="bottom-above-nav -mb-4 rounded-b-DEFAULT md:bottom-0 md:-mb-6"
          />
        </Card>
      )}
    </div>
  );
}
