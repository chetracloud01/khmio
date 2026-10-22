"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { TrackForm, type TrackOutcome } from "@/components/invoice/track-form";
import { api, ApiError, type TrackedOrder } from "@/lib/api";

// Track my order (design/screens.md B8): for buyers without Telegram. The API
// answers with the order link only when the code and the phone both match.
export default function TrackPage() {
  const locale = useLocale();
  const router = useRouter();

  async function find(code: string, phone: string): Promise<TrackOutcome> {
    try {
      const { token } = await api<TrackedOrder>("/public/track", { method: "POST", body: { code, phone } });
      router.push(`/${locale}/o/${encodeURIComponent(token)}`);
      return "found";
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) return "not_found";
      if (failure instanceof ApiError && failure.status === 429) return "too_many";
      return "offline";
    }
  }

  return <TrackForm find={find} />;
}
