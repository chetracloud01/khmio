"use client";

import type { JobCardStatus } from "@khmio/shared";
import { StatusPill, type Tone } from "@khmio/ui";
import { useTranslations } from "next-intl";

/** One colour per job card status, for the list and the card. */
export const JOB_CARD_TONE: Record<JobCardStatus, Tone> = {
  open: "info",
  in_progress: "warning",
  ready: "success",
  handed_over: "muted",
  cancelled: "danger",
};

export function JobCardStatusPill({ status }: { status: JobCardStatus }) {
  const t = useTranslations("JobCards");
  return <StatusPill tone={JOB_CARD_TONE[status]}>{t(`status_${status}`)}</StatusPill>;
}
