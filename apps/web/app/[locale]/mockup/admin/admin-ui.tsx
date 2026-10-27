"use client";

import type { SubscriptionStatus } from "@khmio/shared";
import { TONE_STYLES } from "@khmio/ui";
import type { MockKycStatus } from "@/mock/mock-data";

// The mockup admin's blocks come from the shared kit (packages/ui blocks.tsx),
// the same ones the live admin uses; only the mockup's status colours live here.
// Form blocks (FormSection, FormActions, ReadOnlyField) are shared with the
// merchant dashboard — see ../form-ui.tsx.
export { EmptyState, PageHeader, SectionTitle, StatCard, StatusPill as Pill } from "@khmio/ui";

export const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  trialing: TONE_STYLES.brand,
  active: TONE_STYLES.success,
  grace: TONE_STYLES.warning,
  paused: TONE_STYLES.danger,
};

export const KYC_STYLES: Record<MockKycStatus, string> = {
  not_submitted: TONE_STYLES.muted,
  pending: TONE_STYLES.warning,
  approved: TONE_STYLES.success,
  rejected: TONE_STYLES.danger,
};
