"use client";

import { BottomSheet, Button, FileButton, Notice } from "@khmio/ui";
import { HelpCircle, QrCode, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ChangeEvent } from "react";
import { ACCEPTED_IMAGE_TYPES } from "@/components/compress-image";

/** The guide's steps, in order: each a key under Counter.qrGuide_*. */
const GUIDE_STEPS = ["open", "find", "account", "noAmount", "save", "upload", "test"] as const;

/**
 * "How to get your payment QR": where a seller finds the KHQR their own bank
 * app makes, so buyers at the counter can scan it (design/screens.md P2).
 */
export function PaymentQrGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("Counter");
  return (
    <BottomSheet open={open} onClose={onClose} closeLabel={t("close")} title={t("qrGuideTitle")} placement="center">
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-muted">{t("qrGuideIntro")}</p>
        <ol className="flex flex-col gap-3">
          {GUIDE_STEPS.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand" aria-hidden="true">
                {index + 1}
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block font-medium">{t(`qrGuide_${step}`)}</span>
                <span className="block text-muted">{t(`qrGuide_${step}Hint`)}</span>
              </span>
            </li>
          ))}
        </ol>
        <Notice tone="warning" icon={ShieldAlert}>
          {t("qrGuideSafety")}
        </Notice>
      </div>
    </BottomSheet>
  );
}

/**
 * The seller's own payment QR — a picture of the KHQR their bank app makes —
 * shown to buyers paying at the counter (design/screens.md P2). The page
 * keeps the picture; this shows it, takes a new one and links the guide.
 */
export function PaymentQrField({
  previewUrl,
  busy = false,
  onFile,
  onRemove,
}: {
  previewUrl: string | null;
  busy?: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("Counter");
  const [guideOpen, setGuideOpen] = useState(false);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-fg">{t("qrLabel")}</span>
      <p className="text-xs text-muted">{t("qrHint")}</p>
      <div className="flex items-center gap-4">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-paper">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the seller's own uploaded QR picture
            <img src={previewUrl} alt={t("qrAlt")} className="h-full w-full object-contain" />
          ) : (
            <QrCode className="h-10 w-10 text-paper-muted" aria-hidden="true" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <FileButton accept={ACCEPTED_IMAGE_TYPES} busy={busy} onChange={pick}>
            {previewUrl ? t("qrReplace") : t("qrUpload")}
          </FileButton>
          {previewUrl && (
            <Button variant="ghost" tone="danger" size="sm" onClick={onRemove}>
              {t("qrRemove")}
            </Button>
          )}
        </div>
      </div>
      <Button variant="ghost" size="sm" className="self-start" onClick={() => setGuideOpen(true)}>
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
        {t("qrGuideOpen")}
      </Button>
      <PaymentQrGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
