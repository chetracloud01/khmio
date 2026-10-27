"use client";

import {
  kycRejectReasonSchema,
  kycRejectionSchema,
  toFieldErrors,
  type FormErrorCode,
  type KycRejectReason,
} from "@khmio/shared";
import { BottomSheet, Button, Card, Input, Select } from "@khmio/ui";
import { IdCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormErrorText } from "@/components/form-ui";
import { EmptyState, PageHeader, Pill, STATUS_STYLES } from "../admin-ui";
import { useAdminData, useTimeAgo, type AdminRow } from "../use-admin-data";

/** One side of the ID. The example stores have no real photo, so they show a labelled placeholder. */
function DocumentPhoto({ src, label, sampleLabel }: { src?: string; label: string; sampleLabel: string }) {
  return (
    <figure className="flex flex-col gap-1">
      <div className="flex aspect-[3/2] items-center justify-center overflow-hidden rounded-DEFAULT border border-border bg-border/10">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- merchant's own upload preview, not a remote image
          <img src={src} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted">
            <IdCard className="h-6 w-6" aria-hidden="true" />
            {sampleLabel}
          </span>
        )}
      </div>
      <figcaption className="text-xs text-muted">{label}</figcaption>
    </figure>
  );
}

export default function AdminKycPage() {
  const t = useTranslations("Admin");
  const tNav = useTranslations("AdminNav");
  const tKyc = useTranslations("Kyc");
  const tPlan = useTranslations("Plans");
  const tType = useTranslations("BusinessType");
  const tBilling = useTranslations("Billing");
  const errorText = useFormErrorText();
  const timeAgo = useTimeAgo();
  const { rows, storeName, approveKyc, rejectKyc } = useAdminData();

  const [rejecting, setRejecting] = useState<AdminRow | null>(null);
  const [reason, setReason] = useState<KycRejectReason>("photo_unclear");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<FormErrorCode | undefined>();

  // Oldest applications first — they've been waiting longest.
  const queue = rows
    .filter((row) => row.kycStatus === "pending")
    .sort((a, b) => (b.kyc?.submission?.submittedMinutesAgo ?? 0) - (a.kyc?.submission?.submittedMinutesAgo ?? 0));

  function openReject(row: AdminRow) {
    setRejecting(row);
    setReason("photo_unclear");
    setNote("");
    setNoteError(undefined);
  }

  function handleReject() {
    if (!rejecting) return;
    const result = kycRejectionSchema.safeParse({ reason, note });
    if (!result.success) {
      setNoteError(toFieldErrors(result.error).note);
      return;
    }
    rejectKyc(rejecting, result.data);
    setRejecting(null);
  }

  return (
    <>
      <PageHeader title={tNav("kyc")} description={t("kycDescription")} />

      {queue.length === 0 ? (
        <Card className="p-0">
          <EmptyState title={t("kycQueueEmpty")} body={t("kycQueueEmptyBody")} />
        </Card>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {queue.map((row) => {
            const submission = row.kyc?.submission;
            return (
              <li key={row.id}>
                <Card className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{storeName(row)}</p>
                      <p className="truncate text-xs text-muted">
                        {row.ownerName} · @{row.telegramUsername}
                      </p>
                    </div>
                    {submission && (
                      <span className="shrink-0 text-xs text-muted">{timeAgo(submission.submittedMinutesAgo)}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Pill className="bg-border/20 text-fg">{tType(row.businessType)}</Pill>
                    <Pill className="bg-border/20 text-fg">{tPlan(row.plan)}</Pill>
                    <Pill className={STATUS_STYLES[row.status]}>{tBilling(`status_${row.status}`)}</Pill>
                  </div>

                  {submission ? (
                    <>
                      <dl className="grid grid-cols-2 gap-3 rounded-DEFAULT bg-border/10 p-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-xs text-muted">{tKyc("idTypeLabel")}</dt>
                          <dd className="font-medium">{tKyc(`idType_${submission.idType}`)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted">{tKyc("idNumberLabel")}</dt>
                          <dd className="font-medium tabular-nums">{submission.idNumber}</dd>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <dt className="text-xs text-muted">{tKyc("fullNameLabel")}</dt>
                          <dd className="font-medium">{submission.fullName}</dd>
                        </div>
                      </dl>
                      <div className="grid grid-cols-2 gap-3">
                        <DocumentPhoto src={submission.frontPhoto} label={tKyc("frontPhotoLabel")} sampleLabel={t("kycSamplePhoto")} />
                        {submission.idType === "national_id" && (
                          <DocumentPhoto src={submission.backPhoto} label={tKyc("backPhotoLabel")} sampleLabel={t("kycSamplePhoto")} />
                        )}
                      </div>
                      <p className="text-xs text-muted">{t("kycCheckHint")}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted">{t("kycNoDocuments")}</p>
                  )}

                  <div className="mt-auto flex gap-2">
                    <Button variant="secondary" onClick={() => openReject(row)} className="w-full">
                      {t("kycReject")}
                    </Button>
                    <Button variant="primary" onClick={() => approveKyc(row)} disabled={!submission} className="w-full">
                      {t("kycApprove")}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <BottomSheet
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        closeLabel={t("cancel")}
        title={rejecting ? t("kycRejectConfirmTitle", { store: storeName(rejecting) }) : undefined}
        placement="side"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t("kycRejectConfirmBody")}</p>
          <Select
            label={t("kycRejectReasonLabel")}
            value={reason}
            onChange={(e) => {
              const parsed = kycRejectReasonSchema.safeParse(e.target.value);
              if (parsed.success) setReason(parsed.data);
              setNoteError(undefined);
            }}
            options={kycRejectReasonSchema.options.map((value) => ({ value, label: tKyc(`reason_${value}`) }))}
          />
          <Input
            label={reason === "other" ? t("kycRejectNoteRequired") : t("kycRejectNoteLabel")}
            placeholder={t("kycRejectNotePlaceholder")}
            maxLength={200}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteError(undefined);
            }}
            error={errorText(noteError)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setRejecting(null)} className="w-full">
              {t("cancel")}
            </Button>
            <Button variant="danger" onClick={handleReject} className="w-full">
              {t("kycReject")}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
