"use client";

import { useLocale } from "next-intl";
import { UpgradePrompt as SharedUpgradePrompt, type UpgradePromptProps } from "@/components/upgrade-prompt";

/** The mockup's upgrade message, linking to its own Plan & billing. */
export function UpgradePrompt(props: Omit<UpgradePromptProps, "href">) {
  const locale = useLocale();
  return <SharedUpgradePrompt {...props} href={`/${locale}/mockup/dashboard/billing`} />;
}
