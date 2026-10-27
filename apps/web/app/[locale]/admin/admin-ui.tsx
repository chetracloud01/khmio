"use client";

import type { SubscriptionStatus } from "@khmio/shared";
import { ErrorState, LoadingBlocks, TONE_STYLES } from "@khmio/ui";
import { useTranslations } from "next-intl";

// The live admin's blocks come from the shared kit (packages/ui blocks.tsx),
// the same ones its mockup uses; only admin-specific pieces live here.
export { PageHeader, SectionTitle, StatCard, StatusPill as Pill } from "@khmio/ui";

export const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  trialing: TONE_STYLES.brand,
  active: TONE_STYLES.success,
  grace: TONE_STYLES.warning,
  paused: TONE_STYLES.danger,
};

/** Loading, and "can't reach the server" with a retry. */
export function LoadState({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const t = useTranslations("App");
  return failed ? <ErrorState title={t("offlineTitle")} retryLabel={t("retry")} onRetry={onRetry} /> : <LoadingBlocks label={t("loading")} />;
}
