"use client";

import { ErrorState, LoadingBlocks } from "@khmio/ui";
import { useTranslations } from "next-intl";

// The dashboard's loading and offline states: the shared kit's blocks
// (packages/ui blocks.tsx) with the dashboard's own words.

/** Grey blocks while a dashboard page's data is on its way. */
export function PageLoading() {
  const t = useTranslations("App");
  return (
    <div className="p-4">
      <LoadingBlocks label={t("loading")} rows={2} />
    </div>
  );
}

/** The API can't be reached: say so plainly and offer to try again. */
export function PageOffline({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("App");
  return (
    <div className="p-4">
      <ErrorState title={t("offlineTitle")} body={t("offlineBody")} retryLabel={t("retry")} onRetry={onRetry} />
    </div>
  );
}
